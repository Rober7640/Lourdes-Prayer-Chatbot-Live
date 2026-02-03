import { randomUUID } from "crypto";
import type {
  SessionContext,
  ConversationPhase,
  BucketType,
} from "./claude";

// ============================================================================
// IN-MEMORY SESSION STORE (MVP - will migrate to database later)
// ============================================================================

const sessions = new Map<string, SessionContext>();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// ============================================================================
// SESSION CRUD
// ============================================================================

export function createSession(): SessionContext {
  const sessionId = randomUUID();

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

export function addToHistory(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.conversationHistory.push({ role, content });

  // Keep only last 30 turns to prevent memory bloat
  if (session.conversationHistory.length > 30) {
    session.conversationHistory = session.conversationHistory.slice(-30);
  }

  sessions.set(sessionId, session);
}

export function addAssistantMessages(
  sessionId: string,
  messages: string[]
): void {
  // Join messages for history (Claude sees them as one response)
  const combinedContent = messages.join(" ");
  addToHistory(sessionId, "assistant", combinedContent);
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

export function setBucket(
  sessionId: string,
  bucket: BucketType
): SessionContext | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.bucket = bucket;
  session.phase = "deepening";
  sessions.set(sessionId, session);
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

export function updateExtracted(
  sessionId: string,
  extracted: {
    userName?: string;
    personName?: string;
    relationship?: string;
    situationSummary?: string;
    userEmail?: string;
  }
): SessionContext | null {
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
  return session;
}

export function setReadyForPayment(sessionId: string): SessionContext | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.flags.readyForPayment = true;
  session.phase = "payment";
  sessions.set(sessionId, session);
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
