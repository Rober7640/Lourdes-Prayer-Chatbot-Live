import { randomUUID } from "crypto";
import type {
  SessionContext,
  ConversationPhase,
  BucketType,
  PrayerSubPhase,
} from "./claude";
import * as dbStorage from "./db-storage";

// ============================================================================
// IN-MEMORY SESSION STORE (fast access cache)
// Database is used for persistence; in-memory for working data
// ============================================================================

const sessions = new Map<string, SessionContext>();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Flag to enable/disable database persistence
const DB_ENABLED = !!process.env.DATABASE_URL;

// ============================================================================
// SESSION CRUD
// ============================================================================

export async function createSession(): Promise<SessionContext> {
  let sessionId: string;

  // Create session in database first (if enabled) to get the ID
  if (DB_ENABLED) {
    try {
      const dbSession = await dbStorage.createSession({
        phase: "welcome",
        status: "active",
      });
      sessionId = dbSession.id;
    } catch (error) {
      console.error("Failed to create DB session, using local ID:", error);
      sessionId = randomUUID();
    }
  } else {
    sessionId = randomUUID();
  }

  const session: SessionContext = {
    sessionId,
    phase: "welcome",
    bucket: null,
    personName: null,
    userName: null,
    userEmail: null,
    relationship: null,
    situationDetail: null,
    paymentStatus: null,
    prayerSubPhase: "gathering_info",
    prayerText: null,
    flags: {
      userNameCaptured: false,
      nameCaptured: false,
      emailCaptured: false,
      readyForPayment: false,
      crisisFlag: false,
      inappropriateCount: 0,
      aiQuestionCount: 0,
    },
    conversationHistory: [],
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): SessionContext | null {
  return sessions.get(sessionId) || null;
}

export function updateSession(
  sessionId: string,
  updates: Partial<SessionContext>
): SessionContext | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const updated = { ...session, ...updates };
  sessions.set(sessionId, updated);
  return updated;
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// ============================================================================
// CONVERSATION HISTORY
// ============================================================================

export async function addToHistory(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.conversationHistory.push({ role, content });

  // Keep only last 30 turns to prevent memory bloat
  if (session.conversationHistory.length > 30) {
    session.conversationHistory = session.conversationHistory.slice(-30);
  }

  sessions.set(sessionId, session);

  // Persist message to database
  if (DB_ENABLED) {
    try {
      await dbStorage.saveMessage({
        sessionId,
        role,
        content,
        phase: session.phase,
      });
    } catch (error) {
      console.error("Failed to save message to DB:", error);
    }
  }
}

export async function addAssistantMessages(
  sessionId: string,
  messages: string[]
): Promise<void> {
  // Join messages for history (Claude sees them as one response)
  const combinedContent = messages.join(" ");
  await addToHistory(sessionId, "assistant", combinedContent);
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

export async function setBucket(
  sessionId: string,
  bucket: BucketType
): Promise<SessionContext | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.bucket = bucket;
  session.phase = "deepening";
  sessions.set(sessionId, session);

  // Sync to database
  if (DB_ENABLED) {
    try {
      await dbStorage.updateSession(sessionId, {
        bucket,
        phase: "deepening",
      });
    } catch (error) {
      console.error("Failed to sync bucket to DB:", error);
    }
  }

  return session;
}

export function setPhase(
  sessionId: string,
  phase: ConversationPhase
): SessionContext | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.phase = phase;
  sessions.set(sessionId, session);
  return session;
}

export async function updateExtracted(
  sessionId: string,
  extracted: {
    userName?: string;
    personName?: string;
    relationship?: string;
    situationSummary?: string;
    userEmail?: string;
  }
): Promise<SessionContext | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (extracted.userName) {
    session.userName = extracted.userName;
    session.flags.userNameCaptured = true;
  }
  if (extracted.personName) {
    session.personName = extracted.personName;
    session.flags.nameCaptured = true;
  }
  if (extracted.relationship) {
    session.relationship = extracted.relationship;
  }
  if (extracted.situationSummary) {
    session.situationDetail = extracted.situationSummary;
  }
  if (extracted.userEmail) {
    session.userEmail = extracted.userEmail;
    session.flags.emailCaptured = true;
  }

  sessions.set(sessionId, session);

  // Sync to database
  if (DB_ENABLED) {
    try {
      await dbStorage.updateSession(sessionId, {
        userName: session.userName,
        userEmail: session.userEmail,
        bucket: session.bucket,
        phase: session.phase,
      });
    } catch (error) {
      console.error("Failed to sync session to DB:", error);
    }
  }

  return session;
}

export async function setReadyForPayment(sessionId: string): Promise<SessionContext | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.flags.readyForPayment = true;
  session.phase = "payment";
  session.prayerSubPhase = "confirmed";
  sessions.set(sessionId, session);

  // Sync to database
  if (DB_ENABLED) {
    try {
      await dbStorage.updateSession(sessionId, {
        phase: "payment",
        paymentStatus: "pending",
      });
    } catch (error) {
      console.error("Failed to sync payment ready to DB:", error);
    }
  }

  return session;
}

// ============================================================================
// PRAYER INTENTION PERSISTENCE
// ============================================================================

export async function savePrayerIntention(
  sessionId: string,
  prayerText: string,
  prayerSource: "claude" | "user"
): Promise<number | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Store prayerText on session for AWeber and other uses
  session.prayerText = prayerText;

  if (!DB_ENABLED) {
    console.log("Database not enabled - prayer not persisted");
    return null;
  }

  try {
    const prayer = await dbStorage.savePrayerIntention({
      sessionId,
      personName: session.personName,
      relationship: session.relationship,
      situation: session.situationDetail,
      prayerText,
      prayerSource,
      bucket: session.bucket,
      status: "pending",
    });
    console.log(`Prayer intention saved: ID ${prayer.id}`);
    return prayer.id;
  } catch (error) {
    console.error("Failed to save prayer intention:", error);
    return null;
  }
}

export function setPrayerSubPhase(
  sessionId: string,
  subPhase: PrayerSubPhase
): SessionContext | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.prayerSubPhase = subPhase;
  sessions.set(sessionId, session);
  console.log(`=== PRAYER SUB-PHASE UPDATED: ${subPhase} ===`);
  return session;
}

export function incrementInappropriate(sessionId: string): number {
  const session = sessions.get(sessionId);
  if (!session) return 0;

  session.flags.inappropriateCount++;
  sessions.set(sessionId, session);
  return session.flags.inappropriateCount;
}

export function setCrisisFlag(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.flags.crisisFlag = true;
  sessions.set(sessionId, session);
}

// ============================================================================
// CLEANUP (for production - run periodically)
// ============================================================================

export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  // Note: In MVP, we don't track timestamps.
  // This is a placeholder for when we add proper session management.
  // For now, we'll just log session count

  console.log(`Active sessions: ${sessions.size}`);
  return cleaned;
}

// ============================================================================
// DEBUG
// ============================================================================

export function getSessionCount(): number {
  return sessions.size;
}

export function getAllSessions(): SessionContext[] {
  return Array.from(sessions.values());
}
