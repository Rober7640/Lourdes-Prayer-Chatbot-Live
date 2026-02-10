import { randomUUID } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export type UpsellPhase =
  | "transition"
  | "introduction"
  | "show_front"
  | "bernadette_story"
  | "water_reveal"
  | "social_proof"
  | "the_giving"
  | "the_ask"
  | "handle_response"
  | "tell_me_more"
  | "downsell"
  | "complete";

export type UpsellUiHint =
  | "none"
  | "continue_or_go"
  | "show_offer"
  | "show_offer_self"
  | "tell_me_more"
  | "show_candle_offer"
  | "show_shipping_form"
  | "show_thank_you_prayer"
  | "show_thank_you_candle"
  | "show_thank_you_medal";

export type UpsellImage =
  | "medal_front"
  | "medal_back"
  | "bernadette_portrait"
  | "testimonial_medal"
  | "testimonial_medal_self"
  | "candle_grotto"
  | "certificate"
  | null;

export type PrayingFor = "self" | "other" | "both";

export interface UpsellFlags {
  prayingFor: PrayingFor;
  userEngaged: boolean;
  offerShown: boolean;
  userAccepted: boolean;
  userDeclined: boolean;
  downsellShown: boolean;
}

export type PurchaseType = "prayer" | "candle" | "medal" | "pendant" | null;

// ============================================================================
// UPSELL 2 TYPES
// ============================================================================

export type Upsell2Phase =
  | "not_started"
  | "transition_2"
  | "michael_story"
  | "show_pendant"
  | "protection"
  | "the_ask_2"
  | "handle_response_2"
  | "complete_2";

export type Upsell2UiHint =
  | "none"
  | "show_pendant_offer"
  | "show_pendant_offer_self"
  | "show_pendant_shipping_form"
  | "show_thank_you_pendant"
  | "show_thank_you_close";

export type Upsell2Image =
  | "michael_portrait"
  | "pendant_front"
  | "testimonial_michael"
  | "testimonial_michael_self"
  | null;

export type Upsell1Outcome = "medal" | "candle" | "declined";

export interface Upsell2Flags {
  prayingFor: PrayingFor;
  pendantOfferShown: boolean;
  pendantAccepted: boolean;
  pendantDeclined: boolean;
  shippingAlreadyCollected: boolean;
}

export interface Upsell2Response {
  messages: string[];
  image: Upsell2Image;
  imageAfterMessage?: number;
  uiHint: Upsell2UiHint;
  phase: Upsell2Phase;
  upsell2Flags: Upsell2Flags;
}

export interface UpsellSessionContext {
  upsellSessionId: string;
  sessionId: string; // Original prayer session ID
  phase: UpsellPhase;
  userName: string | null;
  userEmail: string | null;
  personName: string | null;
  relationship: string | null;
  situation: string | null;
  bucket: string | null;
  prayerText: string | null;
  flags: UpsellFlags;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  messageIndex: number; // Track which message we're on in the flow
  purchaseType: PurchaseType; // What the user purchased
  // Upsell 2 fields
  upsell2Phase: Upsell2Phase;
  upsell1Outcome: Upsell1Outcome | null;
  upsell2Flags: Upsell2Flags;
  upsell2MessageIndex: number;
  upsell2PurchaseType: PurchaseType;
}

export interface UpsellResponse {
  messages: string[];
  image: UpsellImage;
  imageAfterMessage?: number; // Show image after this message index (1-indexed). Default: after all messages
  uiHint: UpsellUiHint;
  phase: UpsellPhase;
  flags: UpsellFlags;
  purchaseType?: PurchaseType;
}

// ============================================================================
// IN-MEMORY SESSION STORE
// ============================================================================

const upsellSessions = new Map<string, UpsellSessionContext>();

// Map from original sessionId to upsellSessionId for lookup
const sessionToUpsell = new Map<string, string>();

// ============================================================================
// SESSION CRUD
// ============================================================================

export interface CreateUpsellSessionParams {
  sessionId: string;
  userName?: string | null;
  userEmail?: string | null;
  personName?: string | null;
  relationship?: string | null;
  situation?: string | null;
  bucket?: string | null;
  prayerText?: string | null;
  prayingFor?: PrayingFor;
}

export function createUpsellSession(params: CreateUpsellSessionParams): UpsellSessionContext {
  const upsellSessionId = randomUUID();

  // Determine prayingFor based on relationship/personName
  let prayingFor: PrayingFor = params.prayingFor || "other";
  if (!prayingFor) {
    const relationship = params.relationship?.toLowerCase() || "";
    if (relationship === "self" || relationship === "myself" || relationship === "me") {
      prayingFor = "self";
    } else {
      prayingFor = "other";
    }
  }

  const session: UpsellSessionContext = {
    upsellSessionId,
    sessionId: params.sessionId,
    phase: "transition",
    userName: params.userName || null,
    userEmail: params.userEmail || null,
    personName: params.personName || null,
    relationship: params.relationship || null,
    situation: params.situation || null,
    bucket: params.bucket || null,
    prayerText: params.prayerText || null,
    flags: {
      prayingFor,
      userEngaged: false,
      offerShown: false,
      userAccepted: false,
      userDeclined: false,
      downsellShown: false,
    },
    conversationHistory: [],
    messageIndex: 0,
    purchaseType: "prayer", // Default: they've paid for prayer before reaching upsell
    // Upsell 2 defaults
    upsell2Phase: "not_started",
    upsell1Outcome: null,
    upsell2Flags: {
      prayingFor,
      pendantOfferShown: false,
      pendantAccepted: false,
      pendantDeclined: false,
      shippingAlreadyCollected: false,
    },
    upsell2MessageIndex: 0,
    upsell2PurchaseType: null,
  };

  upsellSessions.set(upsellSessionId, session);
  sessionToUpsell.set(params.sessionId, upsellSessionId);

  return session;
}

export function getUpsellSession(upsellSessionId: string): UpsellSessionContext | null {
  return upsellSessions.get(upsellSessionId) || null;
}

export function getUpsellSessionByOriginalId(sessionId: string): UpsellSessionContext | null {
  const upsellSessionId = sessionToUpsell.get(sessionId);
  if (!upsellSessionId) return null;
  return upsellSessions.get(upsellSessionId) || null;
}

export function updateUpsellSession(
  upsellSessionId: string,
  updates: Partial<UpsellSessionContext>
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  const updated = { ...session, ...updates };
  upsellSessions.set(upsellSessionId, updated);
  return updated;
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

export function setUpsellPhase(
  upsellSessionId: string,
  phase: UpsellPhase
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  session.phase = phase;
  upsellSessions.set(upsellSessionId, session);
  return session;
}

export function setUpsellFlag(
  upsellSessionId: string,
  flag: keyof UpsellFlags,
  value: boolean | PrayingFor
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  if (flag === "prayingFor") {
    session.flags.prayingFor = value as PrayingFor;
  } else if (flag === "userEngaged") {
    session.flags.userEngaged = value as boolean;
  } else if (flag === "offerShown") {
    session.flags.offerShown = value as boolean;
  } else if (flag === "userAccepted") {
    session.flags.userAccepted = value as boolean;
  } else if (flag === "userDeclined") {
    session.flags.userDeclined = value as boolean;
  } else if (flag === "downsellShown") {
    session.flags.downsellShown = value as boolean;
  }

  upsellSessions.set(upsellSessionId, session);
  return session;
}

export function incrementMessageIndex(upsellSessionId: string): number {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return 0;

  session.messageIndex++;
  upsellSessions.set(upsellSessionId, session);
  return session.messageIndex;
}

export function setPurchaseType(
  upsellSessionId: string,
  purchaseType: PurchaseType
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  session.purchaseType = purchaseType;
  upsellSessions.set(upsellSessionId, session);
  return session;
}

// ============================================================================
// UPSELL 2 STATE TRANSITIONS
// ============================================================================

export function setUpsell2Phase(
  upsellSessionId: string,
  phase: Upsell2Phase
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  session.upsell2Phase = phase;
  upsellSessions.set(upsellSessionId, session);
  return session;
}

export function setUpsell2Flag(
  upsellSessionId: string,
  flag: keyof Upsell2Flags,
  value: boolean | PrayingFor
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  if (flag === "prayingFor") {
    session.upsell2Flags.prayingFor = value as PrayingFor;
  } else if (flag === "pendantOfferShown") {
    session.upsell2Flags.pendantOfferShown = value as boolean;
  } else if (flag === "pendantAccepted") {
    session.upsell2Flags.pendantAccepted = value as boolean;
  } else if (flag === "pendantDeclined") {
    session.upsell2Flags.pendantDeclined = value as boolean;
  } else if (flag === "shippingAlreadyCollected") {
    session.upsell2Flags.shippingAlreadyCollected = value as boolean;
  }

  upsellSessions.set(upsellSessionId, session);
  return session;
}

export function setUpsell1Outcome(
  upsellSessionId: string,
  outcome: Upsell1Outcome
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  session.upsell1Outcome = outcome;
  upsellSessions.set(upsellSessionId, session);
  return session;
}

export function setUpsell2PurchaseType(
  upsellSessionId: string,
  purchaseType: PurchaseType
): UpsellSessionContext | null {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return null;

  session.upsell2PurchaseType = purchaseType;
  upsellSessions.set(upsellSessionId, session);
  return session;
}

// ============================================================================
// CONVERSATION HISTORY
// ============================================================================

export function addToUpsellHistory(
  upsellSessionId: string,
  role: "user" | "assistant",
  content: string
): void {
  const session = upsellSessions.get(upsellSessionId);
  if (!session) return;

  session.conversationHistory.push({ role, content });

  // Keep only last 20 turns
  if (session.conversationHistory.length > 20) {
    session.conversationHistory = session.conversationHistory.slice(-20);
  }

  upsellSessions.set(upsellSessionId, session);
}

export function addUpsellAssistantMessages(
  upsellSessionId: string,
  messages: string[]
): void {
  const combinedContent = messages.join(" ");
  addToUpsellHistory(upsellSessionId, "assistant", combinedContent);
}

// ============================================================================
// DEBUG
// ============================================================================

export function getUpsellSessionCount(): number {
  return upsellSessions.size;
}

export function getAllUpsellSessions(): UpsellSessionContext[] {
  return Array.from(upsellSessions.values());
}
