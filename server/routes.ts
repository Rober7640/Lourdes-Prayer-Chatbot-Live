import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  generateResponse,
  getWelcomeMessages,
  getBucketAcknowledgment,
  classifyPrayerIntent,
  classifyEmailIntent,
  classifyPaymentIntent,
  type BucketType,
  type PrayerSubPhase,
  type EmailIntent,
  type PaymentIntent,
} from "./services/claude";
import {
  createSession,
  getSession,
  updateSession,
  addToHistory,
  addAssistantMessages,
  setBucket,
  updateExtracted,
  setReadyForPayment,
  setPhase,
  setPrayerSubPhase,
  incrementInappropriate,
  setCrisisFlag,
  savePrayerIntention,
} from "./services/session";
import {
  createUpsellSession,
  getUpsellSession,
  getUpsellSessionByOriginalId,
  addToUpsellHistory,
  addUpsellAssistantMessages,
  setPurchaseType,
  setUpsellPhase,
  setUpsell2Phase,
  setUpsell2PurchaseType,
  type Upsell1Outcome,
} from "./services/upsell-session";
import {
  getInitialUpsellMessages,
  handleUpsellAction,
  advanceUpsellPhase,
  handleUpsellMessage,
  type UpsellAction,
} from "./services/claude-upsell";
import {
  startUpsell2,
  advanceUpsell2Phase,
  handleUpsell2Action,
  type Upsell2Action,
} from "./services/claude-upsell2";
import {
  createCheckoutSession,
  createUpsellCheckoutSession,
  chargeOneClickUpsell,
  constructWebhookEvent,
  handleWebhookEvent,
  isStripeEnabled,
  getUpsellAmount,
  updateStripeCustomerShipping,
  retrieveCheckoutSession,
  updatePaymentIntentShipping,
  type PaymentTier,
  type UpsellType,
} from "./services/stripe";
import {
  addToFreeList,
  addToCustomerList,
  captureEmailLead,
  isAweberEnabled,
  parseMagicLinkToken,
  updateMedalShippingAddress,
} from "./services/aweber";
import {
  isGoogleSheetsEnabled,
  appendToAllLeads,
  appendToLourdesGrotto,
  updateCandleStatus,
  updatePendantStatus,
} from "./services/googleSheets";
import {
  isFacebookEnabled,
  sendEvent,
  extractFbRequestData,
} from "./services/facebook";
import * as dbStorage from "./services/db-storage";

// ============================================================================
// HELPER FUNCTIONS FOR PRAYER EXTRACTION
// ============================================================================

/**
 * Check if the assistant's response acknowledges a user-written prayer
 * This should only match when the bot is directly affirming the user just wrote a prayer
 */
function isUserPrayerAcknowledgment(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("that's a beautiful prayer") ||
    lower.includes("thats a beautiful prayer") ||
    lower.includes("that's a heartfelt prayer") ||
    lower.includes("beautiful prayer, straight from your heart") ||
    lower.includes("carry those exact words") ||
    lower.includes("your prayer is perfect") ||
    lower.includes("i'll carry your words") ||
    lower.includes("i will carry your words")
  );
}

/**
 * Check if the response indicates the bot is using the user's original prayer
 * (after user said "use my own", "my version", etc.)
 */
function isUsingUserOriginalPrayer(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("exactly as you wrote") ||
    lower.includes("your own words") ||
    lower.includes("your original prayer") ||
    lower.includes("the prayer you wrote")
  );
}

/**
 * Check if user's message is a confirmation to use their original prayer
 * (not the reformatted/Claude version)
 */
function isUserChoosingOwnPrayer(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "use my own" ||
    lower === "my own" ||
    lower === "my version" ||
    lower === "my prayer" ||
    lower === "the original" ||
    lower === "original" ||
    lower === "original one" ||
    lower === "my original" ||
    lower === "use mine" ||
    lower === "mine" ||
    lower.includes("use my own") ||
    lower.includes("my version") ||
    lower.includes("my original") ||
    lower.includes("the one i wrote") ||
    lower.includes("what i wrote")
  );
}

/**
 * Extract quoted prayer text from bot message like: Your prayer: "I want him to rest in peace..."
 */
function extractQuotedPrayer(text: string): string | null {
  // Look for pattern: Your prayer: "..." or Your prayer: '...'
  const quotePatterns = [
    /your prayer:\s*[""]([^""]+)[""]/i,
    /your prayer:\s*['']([^'']+)['']/i,
    /your prayer:\s*"([^"]+)"/i,
    /your prayer:\s*'([^']+)'/i,
  ];

  for (const pattern of quotePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Check if the response indicates the prayer is confirmed
 * (e.g., "I'll carry this prayer" after user said "yes")
 */
function isPrayerConfirmation(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("i'll carry this prayer") ||
    lower.includes("i will carry this prayer") ||
    lower.includes("beautiful. i'll carry") ||
    lower.includes("i'll carry your prayer") ||
    lower.includes("i will carry your prayer")
  );
}

/**
 * Find the user's original prayer from conversation history
 * Looks for the message after bot asked them to share their prayer
 */
function findUserOriginalPrayer(
  conversationHistory: Array<{ role: string; content: string }>
): string | null {
  // Look for "please share your prayer" or similar, then find the next user message
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 15); i--) {
    const entry = conversationHistory[i];
    if (entry.role === "assistant") {
      const lower = entry.content.toLowerCase();
      if (
        lower.includes("please share your prayer") ||
        lower.includes("share your prayer from your heart") ||
        lower.includes("i'm listening") // Often follows "share your prayer"
      ) {
        // Find the next user message after this
        for (let j = i + 1; j < conversationHistory.length; j++) {
          const nextEntry = conversationHistory[j];
          if (nextEntry.role === "user") {
            // Make sure it's not a short confirmation like "yes" or "use my own"
            if (nextEntry.content.length > 20 && !isUserChoosingOwnPrayer(nextEntry.content)) {
              return nextEntry.content;
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Extract the prayer text from messages or conversation history
 * Priorities:
 * 1. If bot quotes back user's prayer like 'Your prayer: "..."', use that
 * 2. If user chose their own version ("use my own"), find their original prayer
 * 3. If this is a confirmation, look back for quoted/original prayer
 * 4. If bot acknowledges user-written prayer (and user message IS a prayer), use it
 * 5. If current messages have a bot-composed prayer, use that
 * 6. Look in history for quoted prayers or acknowledgments
 */
function extractPrayerText(
  currentMessages: string[],
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage?: string
): string | null {
  const combinedResponse = currentMessages.join(" ");

  // Priority 1: Check if bot quotes back the user's prayer in current response
  const quotedPrayer = extractQuotedPrayer(combinedResponse);
  if (quotedPrayer) {
    return quotedPrayer;
  }

  // Priority 2: If user said "use my own" or similar, find their original prayer
  if (userMessage && isUserChoosingOwnPrayer(userMessage)) {
    // First check if bot quoted it back in the response
    const quoted = extractQuotedPrayer(combinedResponse);
    if (quoted) return quoted;

    // Check history for quoted prayer
    for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 6); i--) {
      if (conversationHistory[i].role === "assistant") {
        const historyQuoted = extractQuotedPrayer(conversationHistory[i].content);
        if (historyQuoted) return historyQuoted;
      }
    }

    // Find their original prayer from history
    const originalPrayer = findUserOriginalPrayer(conversationHistory);
    if (originalPrayer) return originalPrayer;
  }

  // Priority 3: If this is a confirmation response, look back for the prayer
  if (isPrayerConfirmation(combinedResponse) || isUsingUserOriginalPrayer(combinedResponse)) {
    // Look in recent history for quoted prayer
    for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 6); i--) {
      const entry = conversationHistory[i];
      if (entry.role === "assistant") {
        const quoted = extractQuotedPrayer(entry.content);
        if (quoted) return quoted;
      }
    }
    // Find user's original prayer
    const originalPrayer = findUserOriginalPrayer(conversationHistory);
    if (originalPrayer) return originalPrayer;
  }

  // Priority 4: Check if current response acknowledges a user-written prayer
  // BUT only if the user's message actually looks like a prayer (not a confirmation)
  if (isUserPrayerAcknowledgment(combinedResponse) && userMessage && looksLikePrayer(userMessage)) {
    return userMessage;
  }

  // Priority 5: Check current assistant messages for a bot-composed prayer
  for (const msg of currentMessages) {
    if (looksLikePrayer(msg)) {
      return extractPrayerPortion(msg);
    }
  }

  // Priority 6: Check user's message if they wrote their own prayer
  if (userMessage && looksLikePrayer(userMessage)) {
    return userMessage;
  }

  // Priority 7: Look in history for quoted prayers
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 10); i--) {
    const entry = conversationHistory[i];
    if (entry.role === "assistant") {
      const quoted = extractQuotedPrayer(entry.content);
      if (quoted) return quoted;
    }
  }

  // Priority 7: Check if any assistant message in history acknowledges a user prayer
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 10); i--) {
    const entry = conversationHistory[i];
    if (entry.role === "assistant" && isUserPrayerAcknowledgment(entry.content)) {
      // Find the user message right before this acknowledgment
      for (let j = i - 1; j >= 0; j--) {
        if (conversationHistory[j].role === "user") {
          return conversationHistory[j].content;
        }
      }
    }
  }

  // Priority 8: Look for any prayer-like content in history (fallback)
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 10); i--) {
    const entry = conversationHistory[i];
    if (looksLikePrayer(entry.content)) {
      if (entry.role === "user") {
        return entry.content;
      }
      return extractPrayerPortion(entry.content);
    }
  }

  return null;
}

/**
 * Prayer address patterns to identify where a prayer starts
 */
const PRAYER_ADDRESSES = [
  "blessed mother",
  "holy mary",
  "our lady",
  "dear god",
  "dear lord",
  "mother mary",
  "heavenly father",
  "lord jesus",
  "jesus christ",
  "loving god",
  "merciful god",
  "almighty god",
  "gracious god",
  "o mary",
  "hail mary",
  "most holy",
  "dearest mother",
  "virgin mary",
];

/**
 * Check if a message looks like a prayer
 * More flexible matching to catch user-written prayers
 */
function looksLikePrayer(text: string): boolean {
  const lower = text.toLowerCase();
  const hasAmen = lower.includes("amen");
  const hasPrayerAddress = PRAYER_ADDRESSES.some(addr => lower.includes(addr));
  const hasPetition =
    lower.includes("please intercede") ||
    lower.includes("please pray") ||
    lower.includes("i ask") ||
    lower.includes("i pray") ||
    lower.includes("please help") ||
    lower.includes("please protect") ||
    lower.includes("please heal") ||
    lower.includes("please bless") ||
    lower.includes("please guide");

  // Must have Amen OR (prayer address AND petition)
  return hasAmen || (hasPrayerAddress && hasPetition);
}

/**
 * Extract just the prayer portion from text that may contain prefixes/suffixes
 * Finds text from prayer address to "Amen"
 */
function extractPrayerPortion(text: string): string {
  const lower = text.toLowerCase();

  // Find where the prayer starts (earliest prayer address)
  let startIndex = -1;
  for (const addr of PRAYER_ADDRESSES) {
    const idx = lower.indexOf(addr);
    if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
      startIndex = idx;
    }
  }

  // Find where the prayer ends (last "Amen")
  const amenMatch = lower.lastIndexOf("amen");

  if (startIndex !== -1 && amenMatch !== -1 && amenMatch > startIndex) {
    // Extract from prayer address to end of "Amen" (plus any punctuation)
    let endIndex = amenMatch + 4; // "amen" is 4 chars
    // Include trailing punctuation like "." or "!"
    while (endIndex < text.length && /[.!,]/.test(text[endIndex])) {
      endIndex++;
    }
    return text.substring(startIndex, endIndex).trim();
  }

  // If we found a start but no amen, return from start
  if (startIndex !== -1) {
    return text.substring(startIndex).trim();
  }

  // No prayer structure found, return original
  return text;
}

/**
 * Check if the user wrote their own prayer
 * Either by detecting prayer patterns in their message OR
 * by detecting that the assistant acknowledged/quoted their prayer
 */
function didUserWritePrayer(
  userMessage: string,
  responseMessages?: string[],
  conversationHistory?: Array<{ role: string; content: string }>
): boolean {
  // Check if user's message looks like a prayer
  if (looksLikePrayer(userMessage)) {
    return true;
  }

  // Check if user chose to use their own prayer (e.g., "use my own")
  if (isUserChoosingOwnPrayer(userMessage)) {
    return true;
  }

  if (responseMessages) {
    const combinedResponse = responseMessages.join(" ");

    // Check if response contains quoted user prayer (Your prayer: "...")
    if (extractQuotedPrayer(combinedResponse)) {
      return true;
    }

    // Check if the response acknowledges a user-written prayer
    if (isUserPrayerAcknowledgment(combinedResponse)) {
      return true;
    }

    // Check if response indicates using user's original prayer
    if (isUsingUserOriginalPrayer(combinedResponse)) {
      return true;
    }

    // Check if this is a confirmation and there was a quoted prayer or original prayer earlier
    if (isPrayerConfirmation(combinedResponse) && conversationHistory) {
      for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 6); i--) {
        if (conversationHistory[i].role === "assistant") {
          if (extractQuotedPrayer(conversationHistory[i].content)) {
            return true;
          }
          if (isUsingUserOriginalPrayer(conversationHistory[i].content)) {
            return true;
          }
        }
      }
      // Also check if there's an original user prayer in history
      if (findUserOriginalPrayer(conversationHistory)) {
        return true;
      }
    }
  }

  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ========================================================================
  // CHAT API ENDPOINTS
  // ========================================================================

  /**
   * POST /api/chat/start
   * Initialize a new chat session and return welcome messages
   */
  app.post("/api/chat/start", async (req, res) => {
    try {
      const session = await createSession();
      const welcome = getWelcomeMessages();

      // Add welcome messages to history
      await addAssistantMessages(session.sessionId, welcome.messages);

      res.json({
        sessionId: session.sessionId,
        messages: welcome.messages,
        uiHint: welcome.uiHint,
        phase: session.phase,
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      res.status(500).json({ error: "Failed to start chat session" });
    }
  });

  /**
   * POST /api/chat/bucket
   * Handle bucket selection
   */
  app.post("/api/chat/bucket", async (req, res) => {
    try {
      const { sessionId, bucket } = req.body;

      if (!sessionId || !bucket) {
        return res.status(400).json({ error: "Missing sessionId or bucket" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate bucket type
      const validBuckets: BucketType[] = [
        "family_reconciliation",
        "healing_health",
        "protection",
        "grief",
        "guidance",
      ];

      if (!validBuckets.includes(bucket)) {
        return res.status(400).json({ error: "Invalid bucket type" });
      }

      // Update session with bucket
      await setBucket(sessionId, bucket);

      // Add user's bucket selection to history
      const bucketLabels: Record<string, string> = {
        family_reconciliation: "A Family Wound",
        healing_health: "Healing for Someone ill",
        protection: "Protection for a Loved One",
        grief: "Grief or Loss",
        guidance: "Guidance in a Difficult Season",
      };
      await addToHistory(sessionId, "user", `[Selected: ${bucketLabels[bucket]}]`);

      // Get acknowledgment for this bucket (pass userName for personalization)
      const acknowledgment = getBucketAcknowledgment(bucket, session.userName);
      await addAssistantMessages(sessionId, acknowledgment.messages);

      res.json({
        messages: acknowledgment.messages,
        uiHint: acknowledgment.uiHint,
        phase: "deepening",
        bucket,
      });
    } catch (error) {
      console.error("Error selecting bucket:", error);
      res.status(500).json({ error: "Failed to process bucket selection" });
    }
  });

  /**
   * POST /api/chat/email
   * Capture user's email address
   */
  app.post("/api/chat/email", async (req, res) => {
    try {
      const { sessionId, email } = req.body;

      if (!sessionId || !email) {
        return res.status(400).json({ error: "Missing sessionId or email" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Update session with email
      await updateExtracted(sessionId, { userEmail: email });

      // Add to history
      await addToHistory(sessionId, "user", `[Email: ${email}]`);

      // Capture email as lead in AWeber (async, don't block response)
      if (isAweberEnabled()) {
        captureEmailLead(email, {
          name: session.userName || undefined,
          sessionId,
          bucket: session.bucket || undefined,
          personName: session.personName || undefined,
        }).catch((err) => console.error("AWeber lead capture failed:", err));
      }

      // Note: Lead event fires when prayer is saved, not on email capture

      // Get the follow-up question based on bucket
      const userName = session.userName || "dear";
      const bucketFollowUps: Record<string, string[]> = {
        family_reconciliation: [
          "Thank you.",
          `Now ${userName}, tell me about this family wound. Is it about someone you've lost touch with, or a relationship that's become strained?`,
        ],
        healing_health: [
          "Thank you.",
          `Now ${userName}, is this healing intention for yourself, or for someone you love?`,
        ],
        protection: [
          "Thank you.",
          `Now ${userName}, who is it you're seeking protection for?`,
        ],
        grief: [
          "Thank you.",
          `Now ${userName}, may I ask who you're grieving?`,
        ],
        guidance: [
          "Thank you.",
          `Now ${userName}, what decision or season are you navigating right now?`,
        ],
      };

      const followUp = bucketFollowUps[session.bucket || ""] || [
        "Thank you.",
        `Now ${userName}, tell me what brings you here today.`,
      ];

      await addAssistantMessages(sessionId, followUp);

      res.json({
        messages: followUp,
        uiHint: "none",
        phase: "deepening",
        emailCaptured: true,
      });
    } catch (error) {
      console.error("Error capturing email:", error);
      res.status(500).json({ error: "Failed to capture email" });
    }
  });

  /**
   * POST /api/chat/message
   * Process a user message and return Claude's response
   */
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({ error: "Missing sessionId or message" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Reject user-written prayer if it exceeds 500 characters
      if (session.phase === "deepening" && message.length > 500) {
        // Check if this looks like a prayer (contains prayer-like patterns or is in prayer sub-phase)
        const inPrayerPhase = ["asking_preference", "simple_offered", "detailed_offered", "both_offered"].includes(session.prayerSubPhase);
        if (inPrayerPhase) {
          await addToHistory(sessionId, "user", message);
          const rejectMsg = `Your prayer is ${message.length} characters long. Please shorten it to 500 characters or less so we can carry it to the Grotto. Take your time — every word matters.`;
          await addAssistantMessages(sessionId, [rejectMsg]);
          return res.json({
            messages: [rejectMsg],
            uiHint: "none",
            phase: session.phase,
            extracted: {},
            flags: { readyForPayment: false },
          });
        }
      }

      // Add user message to history
      await addToHistory(sessionId, "user", message);

      // Generate Claude response
      const response = await generateResponse(message, session);

      // Update session with extracted data
      if (response.extracted.userName || response.extracted.personName || response.extracted.relationship || response.extracted.userEmail) {
        await updateExtracted(sessionId, response.extracted);
      }

      // Handle flags
      if (response.flags.readyForPayment) {
        await setReadyForPayment(sessionId);

        // Extract and save the confirmed prayer
        // Look for the prayer in recent conversation history, current response, or user's message
        let prayerText = extractPrayerText(response.messages, session.conversationHistory, message);
        if (prayerText) {
          // Determine if prayer was user-written or Claude-composed
          const userWrotePrayer = didUserWritePrayer(message, response.messages, session.conversationHistory);

          // Enforce 600 char limit on Claude-composed prayers (user prayers are rejected upfront at 500)
          if (!userWrotePrayer && prayerText.length > 600) {
            prayerText = prayerText.substring(0, 600).trim();
          }
          await savePrayerIntention(
            sessionId,
            prayerText,
            userWrotePrayer ? "user" : "claude"
          );

          // Add to AWeber free list when prayer is finalized
          if (session.userEmail && isAweberEnabled()) {
            addToFreeList(session.userEmail, {
              name: session.userName || undefined,
              prayer: prayerText,
              sessionId,
              bucket: session.bucket || undefined,
            }).catch((err) => console.error("Failed to add to AWeber free list:", err));
          }

          // Facebook CAPI Lead event — fires when prayer is saved
          if (isFacebookEnabled()) {
            const fbData = extractFbRequestData(req);
            sendEvent({
              eventName: "Lead",
              eventId: req.body.fbEventId || `lead_${sessionId}`,
              email: session.userEmail || undefined,
              userName: session.userName || undefined,
              ...fbData,
              customData: { content_name: "prayer_intention" },
            }).catch((err) => console.error("Facebook CAPI Lead failed:", err));
          }

          // Add to Google Sheet "all leads" (once per session)
          if (isGoogleSheetsEnabled() && !session.addedToAllLeads) {
            session.addedToAllLeads = true;
            appendToAllLeads({
              name: session.userName || "",
              email: session.userEmail || "",
              prayer: prayerText,
            }).catch((err) => console.error("Google Sheets all leads append failed:", err));
          }
        }
      }
      if (response.flags.conversationComplete) {
        setPhase(sessionId, "complete");
      }

      // Track prayer sub-phase transitions based on response content
      if (session.phase === "deepening") {
        const combinedResponse = response.messages.join(" ").toLowerCase();

        // Detect prayer sub-phase from response patterns
        if (combinedResponse.includes("would you like to write the prayer") ||
            combinedResponse.includes("would you like me to help you find the words")) {
          setPrayerSubPhase(sessionId, "asking_preference");
        } else if (combinedResponse.includes("here's a simple") ||
                   combinedResponse.includes("here is a simple") ||
                   (combinedResponse.includes("amen") && combinedResponse.includes("would you like to see") && combinedResponse.includes("detailed"))) {
          setPrayerSubPhase(sessionId, "simple_offered");
        } else if (combinedResponse.includes("here's a more detailed") ||
                   combinedResponse.includes("here is a more detailed") ||
                   combinedResponse.includes("here's the detailed")) {
          setPrayerSubPhase(sessionId, "detailed_offered");
        } else if (combinedResponse.includes("which prayer speaks to your heart") ||
                   combinedResponse.includes("which version") ||
                   combinedResponse.includes("which one")) {
          setPrayerSubPhase(sessionId, "both_offered");
        } else if (combinedResponse.includes("is this the prayer you'd like me to carry") ||
                   combinedResponse.includes("is this what you'd like me to carry")) {
          setPrayerSubPhase(sessionId, "awaiting_confirm");
        }
      }

      // Add assistant messages to history
      await addAssistantMessages(sessionId, response.messages);

      // Get updated session for phase info
      const updatedSession = getSession(sessionId);

      res.json({
        messages: response.messages,
        uiHint: response.uiHint,
        phase: updatedSession?.phase,
        extracted: response.extracted,
        flags: response.flags,
      });
    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  /**
   * GET /api/chat/session/:id
   * Get current session state (for reconnection)
   */
  app.get("/api/chat/session/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = getSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({
        sessionId: session.sessionId,
        phase: session.phase,
        bucket: session.bucket,
        personName: session.personName,
        flags: session.flags,
        historyLength: session.conversationHistory.length,
      });
    } catch (error) {
      console.error("Error getting session:", error);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  /**
   * POST /api/chat/payment-ready
   * Signal that we're ready to show payment (called by frontend when ready)
   */
  app.post("/api/chat/payment-ready", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Missing sessionId" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      setPhase(sessionId, "payment");

      const personName = session.personName || "your loved one";
      const paymentTransitionMessages = [
        `${personName}'s prayer will be carefully printed and prepared for the journey.`,
        "Each week, our messengers walk to the sacred Grotto at Lourdes, France — the very place where Our Lady appeared to Saint Bernadette.",
        "Your prayer will be placed in the waters of the spring, where countless miracles have been recorded.",
        "You'll receive a photo of your prayer at the Grotto within 7 days.",
        "We ask only a small offering to help cover the pilgrimage and materials.",
      ];

      await addAssistantMessages(sessionId, paymentTransitionMessages);

      res.json({
        messages: paymentTransitionMessages,
        uiHint: "show_payment",
        phase: "payment",
      });
    } catch (error) {
      console.error("Error transitioning to payment:", error);
      res.status(500).json({ error: "Failed to transition to payment" });
    }
  });

  // ========================================================================
  // UPSELL API ENDPOINTS
  // ========================================================================

  /**
   * GET /api/confirmation/:sessionId
   * Load confirmation/upsell page data
   * Creates upsell session if doesn't exist
   */
  app.get("/api/confirmation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Get the original prayer session
      const originalSession = getSession(sessionId);
      if (!originalSession) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if upsell session already exists
      let upsellSession = getUpsellSessionByOriginalId(sessionId);

      if (!upsellSession) {
        // Create new upsell session with data from original session
        upsellSession = createUpsellSession({
          sessionId,
          userName: originalSession.userName,
          userEmail: originalSession.userEmail,
          personName: originalSession.personName,
          relationship: originalSession.relationship,
          situation: originalSession.situationDetail,
          bucket: originalSession.bucket,
        });
      }

      // Get initial messages
      const response = getInitialUpsellMessages(upsellSession);

      // Add to history
      addUpsellAssistantMessages(upsellSession.upsellSessionId, response.messages);

      res.json({
        upsellSessionId: upsellSession.upsellSessionId,
        sessionId: upsellSession.sessionId,
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        flags: response.flags,
        // Context for UI
        userName: upsellSession.userName,
        personName: upsellSession.personName,
        prayingFor: upsellSession.flags.prayingFor,
        situation: upsellSession.situation,
        userEmail: upsellSession.userEmail,
      });
    } catch (error) {
      console.error("Error loading confirmation:", error);
      res.status(500).json({ error: "Failed to load confirmation page" });
    }
  });

  /**
   * POST /api/upsell/action
   * Handle button clicks in upsell flow
   */
  app.post("/api/upsell/action", async (req, res) => {
    try {
      const { upsellSessionId, action } = req.body;

      if (!upsellSessionId || !action) {
        return res.status(400).json({ error: "Missing upsellSessionId or action" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      // Validate action
      const validActions: UpsellAction[] = [
        "continue",
        "go",
        "accept_medal",
        "decline_medal",
        "tell_me_more",
        "accept_candle",
        "decline_candle",
      ];

      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Add user action to history
      addToUpsellHistory(upsellSessionId, "user", `[Action: ${action}]`);

      // Handle the action
      const response = handleUpsellAction(session, action as UpsellAction);

      // Add response to history
      addUpsellAssistantMessages(upsellSessionId, response.messages);

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        flags: response.flags,
      });
    } catch (error) {
      console.error("Error handling upsell action:", error);
      res.status(500).json({ error: "Failed to process action" });
    }
  });

  /**
   * POST /api/upsell/advance
   * Auto-advance to next phase after messages are shown
   */
  app.post("/api/upsell/advance", async (req, res) => {
    try {
      const { upsellSessionId } = req.body;

      if (!upsellSessionId) {
        return res.status(400).json({ error: "Missing upsellSessionId" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      // Advance to next phase
      const response = advanceUpsellPhase(session);

      // Add response to history if there are messages
      if (response.messages.length > 0) {
        addUpsellAssistantMessages(upsellSessionId, response.messages);
      }

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        flags: response.flags,
      });
    } catch (error) {
      console.error("Error advancing upsell phase:", error);
      res.status(500).json({ error: "Failed to advance phase" });
    }
  });

  /**
   * POST /api/upsell/message
   * Handle free-form messages in upsell (rare case)
   */
  app.post("/api/upsell/message", async (req, res) => {
    try {
      const { upsellSessionId, message } = req.body;

      if (!upsellSessionId || !message) {
        return res.status(400).json({ error: "Missing upsellSessionId or message" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      // Add user message to history
      addToUpsellHistory(upsellSessionId, "user", message);

      // Handle message with Claude
      const response = await handleUpsellMessage(session, message);

      // Add response to history
      addUpsellAssistantMessages(upsellSessionId, response.messages);

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        flags: response.flags,
      });
    } catch (error) {
      console.error("Error handling upsell message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  /**
   * POST /api/upsell/medal
   * Process medal purchase with shipping address
   */
  app.post("/api/upsell/medal", async (req, res) => {
    try {
      const { upsellSessionId, shipping } = req.body;

      if (!upsellSessionId || !shipping) {
        return res.status(400).json({ error: "Missing upsellSessionId or shipping" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      // Validate shipping fields
      const requiredFields = ["name", "address1", "city", "postal", "country"];
      for (const field of requiredFields) {
        if (!shipping[field]) {
          return res.status(400).json({ error: `Missing shipping ${field}` });
        }
      }

      const originalSessionId = session.sessionId;
      const originalSession = getSession(originalSessionId);
      if (!originalSession) {
        return res.status(404).json({ error: "Original session not found" });
      }

      // Try one-click charge
      if (isStripeEnabled()) {
        const result = await chargeOneClickUpsell({ sessionId: originalSessionId, upsellType: "medal" });

        if (result.success) {
          console.log(`Medal one-click charge successful: ${result.paymentIntentId}`);

          // Save shipping address to session & database
          updateSession(originalSessionId, {
            shippingName: shipping.name,
            shippingAddressLine1: shipping.address1,
            shippingAddressLine2: shipping.address2 || null,
            shippingCity: shipping.city,
            shippingState: shipping.state || null,
            shippingPostalCode: shipping.postal,
            shippingCountry: shipping.country,
          });

          const DB_ENABLED = !!process.env.DATABASE_URL;
          if (DB_ENABLED) {
            dbStorage.updateSession(originalSessionId, {
              shippingName: shipping.name,
              shippingAddressLine1: shipping.address1,
              shippingAddressLine2: shipping.address2 || null,
              shippingCity: shipping.city,
              shippingState: shipping.state || null,
              shippingPostalCode: shipping.postal,
              shippingCountry: shipping.country,
            }).catch((err) => console.error("Failed to save shipping to DB:", err));
          }

          // Update Stripe payment intent with shipping address
          if (result.paymentIntentId) {
            updatePaymentIntentShipping(result.paymentIntentId, {
              name: shipping.name,
              addressLine1: shipping.address1,
              addressLine2: shipping.address2 || null,
              city: shipping.city,
              state: shipping.state || null,
              postalCode: shipping.postal,
              country: shipping.country,
            }).catch((err) => console.error("Failed to update Stripe shipping:", err));
          }

          // Add to AWeber upsell list, then update shipping address
          if (originalSession.userEmail && isAweberEnabled()) {
            addToCustomerList(originalSession.userEmail, "medal", {
              name: originalSession.userName || undefined,
              stripePaymentId: result.paymentIntentId || undefined,
            }).then(() => {
              // Update shipping address after subscriber is added to the list
              return updateMedalShippingAddress(originalSession.userEmail!, {
                name: shipping.name,
                addressLine1: shipping.address1,
                addressLine2: shipping.address2 || null,
                city: shipping.city,
                state: shipping.state || null,
                postalCode: shipping.postal,
                country: shipping.country,
              });
            }).catch((err) => console.error("AWeber medal list/shipping update failed:", err));
          }

          // Facebook CAPI Purchase event
          if (isFacebookEnabled() && result.paymentIntentId) {
            const fbData = extractFbRequestData(req);
            sendEvent({
              eventName: "Purchase",
              eventId: result.paymentIntentId,
              email: originalSession.userEmail || undefined,
              userName: originalSession.userName || undefined,
              ...fbData,
              customData: { value: 79, currency: "USD", content_type: "product", content_ids: ["upsell_medal"] },
            }).catch((err) => console.error("Facebook CAPI Purchase (medal) failed:", err));
          }

          // Set purchase type and phase
          setPurchaseType(upsellSessionId, "medal");
          setUpsellPhase(upsellSessionId, "complete");

          return res.json({
            success: true,
            oneClick: true,
            uiHint: "show_thank_you_medal",
            phase: "complete",
          });
        }

        // One-click failed — create Stripe checkout session as fallback
        console.log("Medal one-click failed, creating checkout fallback");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const successUrl = `${baseUrl}/confirmation/${originalSessionId}?upsell=medal`;
        const cancelUrl = `${baseUrl}/confirmation/${originalSessionId}`;

        const checkoutResult = await createUpsellCheckoutSession({
          sessionId: originalSessionId,
          upsellType: "medal",
          email: originalSession.userEmail!,
          successUrl,
          cancelUrl,
          requiresShipping: true,
        });

        if (!checkoutResult) {
          return res.status(500).json({ error: "Failed to create checkout session" });
        }

        return res.json({
          success: false,
          oneClick: false,
          requiresCheckout: true,
          checkoutUrl: checkoutResult.url,
        });
      }

      // Stripe not enabled — just log
      console.log("Stripe not enabled, medal order logged only:", { upsellSessionId, shipping });
      setPurchaseType(upsellSessionId, "medal");
      setUpsellPhase(upsellSessionId, "complete");

      res.json({
        success: true,
        uiHint: "show_thank_you_medal",
        phase: "complete",
      });
    } catch (error) {
      console.error("Error processing medal order:", error);
      res.status(500).json({ error: "Failed to process medal order" });
    }
  });

  // ========================================================================
  // SESSION RESUME ENDPOINTS
  // ========================================================================

  /**
   * GET /api/chat/resume/:token
   * Resume a session from a magic link token
   */
  app.get("/api/chat/resume/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Parse the magic link token
      const parsed = parseMagicLinkToken(token);
      if (!parsed) {
        return res.status(400).json({ error: "Invalid resume token" });
      }

      const { sessionId, timestamp } = parsed;

      // Check if token is expired (7 days)
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp > SEVEN_DAYS_MS) {
        return res.json({
          status: "expired",
          message: "This link has expired. Please start a new conversation.",
        });
      }

      // Try to find session - first in memory, then in database
      let session = getSession(sessionId);
      let messages: Array<{ role: string; content: string }> = [];

      const DB_ENABLED = !!process.env.DATABASE_URL;

      if (!session && DB_ENABLED) {
        // Try to restore from database
        try {
          const dbSession = await dbStorage.getSession(sessionId);
          if (dbSession) {
            // Check if already converted
            if (dbSession.paymentStatus === "completed") {
              return res.json({
                status: "converted",
                message: "This prayer has already been submitted. Check your email for updates.",
              });
            }

            // Load messages from database
            const dbMessages = await dbStorage.getSessionMessages(sessionId);
            messages = dbMessages.map((m) => ({
              role: m.role,
              content: m.content,
            }));

            // Return session data for restoration
            return res.json({
              status: "valid",
              sessionId,
              phase: dbSession.phase,
              bucket: dbSession.bucket,
              userName: dbSession.userName,
              userEmail: dbSession.userEmail,
              messages,
            });
          }
        } catch (error) {
          console.error("Error loading session from DB:", error);
        }
      }

      if (session) {
        // Check if already converted
        if (session.paymentStatus === "completed") {
          return res.json({
            status: "converted",
            message: "This prayer has already been submitted. Check your email for updates.",
          });
        }

        return res.json({
          status: "valid",
          sessionId: session.sessionId,
          phase: session.phase,
          bucket: session.bucket,
          userName: session.userName,
          userEmail: session.userEmail,
          personName: session.personName,
          messages: session.conversationHistory,
        });
      }

      return res.json({
        status: "not_found",
        message: "Session not found. Please start a new conversation.",
      });
    } catch (error) {
      console.error("Error resuming session:", error);
      res.status(500).json({ error: "Failed to resume session" });
    }
  });

  /**
   * POST /api/upsell/candle
   * Process candle purchase (no shipping needed)
   */
  app.post("/api/upsell/candle", async (req, res) => {
    try {
      const { upsellSessionId } = req.body;

      if (!upsellSessionId) {
        return res.status(400).json({ error: "Missing upsellSessionId" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      const originalSessionId = session.sessionId;
      const originalSession = getSession(originalSessionId);
      if (!originalSession) {
        return res.status(404).json({ error: "Original session not found" });
      }

      // Try one-click charge
      if (isStripeEnabled()) {
        const result = await chargeOneClickUpsell({ sessionId: originalSessionId, upsellType: "candle" });

        if (result.success) {
          console.log(`Candle one-click charge successful: ${result.paymentIntentId}`);

          // Add to AWeber upsell list
          if (originalSession.userEmail && isAweberEnabled()) {
            addToCustomerList(originalSession.userEmail, "candle", {
              name: originalSession.userName || undefined,
              stripePaymentId: result.paymentIntentId || undefined,
            }).catch((err) => console.error("AWeber candle upsell list add failed:", err));
          }

          // Update candle status in Google Sheet
          if (originalSession.userEmail && isGoogleSheetsEnabled()) {
            updateCandleStatus(originalSession.userEmail)
              .catch((err) => console.error("Google Sheets candle update failed:", err));
          }

          // Facebook CAPI Purchase event
          if (isFacebookEnabled() && result.paymentIntentId) {
            const fbData = extractFbRequestData(req);
            sendEvent({
              eventName: "Purchase",
              eventId: result.paymentIntentId,
              email: originalSession.userEmail || undefined,
              userName: originalSession.userName || undefined,
              ...fbData,
              customData: { value: 19, currency: "USD", content_type: "product", content_ids: ["upsell_candle"] },
            }).catch((err) => console.error("Facebook CAPI Purchase (candle) failed:", err));
          }

          // Set purchase type and phase
          setPurchaseType(upsellSessionId, "candle");
          setUpsellPhase(upsellSessionId, "complete");

          return res.json({
            success: true,
            oneClick: true,
            uiHint: "show_thank_you_candle",
            phase: "complete",
          });
        }

        // One-click failed — create Stripe checkout session as fallback
        console.log("Candle one-click failed, creating checkout fallback");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const successUrl = `${baseUrl}/confirmation/${originalSessionId}?upsell=candle`;
        const cancelUrl = `${baseUrl}/confirmation/${originalSessionId}`;

        const checkoutResult = await createUpsellCheckoutSession({
          sessionId: originalSessionId,
          upsellType: "candle",
          email: originalSession.userEmail!,
          successUrl,
          cancelUrl,
          requiresShipping: false,
        });

        if (!checkoutResult) {
          return res.status(500).json({ error: "Failed to create checkout session" });
        }

        return res.json({
          success: false,
          oneClick: false,
          requiresCheckout: true,
          checkoutUrl: checkoutResult.url,
        });
      }

      // Stripe not enabled — just log
      console.log("Stripe not enabled, candle order logged only:", { upsellSessionId });
      setPurchaseType(upsellSessionId, "candle");
      setUpsellPhase(upsellSessionId, "complete");

      res.json({
        success: true,
        uiHint: "show_thank_you_candle",
        phase: "complete",
      });
    } catch (error) {
      console.error("Error processing candle order:", error);
      res.status(500).json({ error: "Failed to process candle order" });
    }
  });

  // ========================================================================
  // UPSELL 2 API ENDPOINTS
  // ========================================================================

  /**
   * POST /api/upsell2/start
   * Initialize Upsell 2 flow after Upsell 1 completes
   */
  app.post("/api/upsell2/start", async (req, res) => {
    try {
      const { upsellSessionId, upsell1Outcome } = req.body;

      if (!upsellSessionId || !upsell1Outcome) {
        return res.status(400).json({ error: "Missing upsellSessionId or upsell1Outcome" });
      }

      const validOutcomes: Upsell1Outcome[] = ["medal", "candle", "declined"];
      if (!validOutcomes.includes(upsell1Outcome)) {
        return res.status(400).json({ error: "Invalid upsell1Outcome" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      const response = startUpsell2(session, upsell1Outcome);

      addUpsellAssistantMessages(upsellSessionId, response.messages);

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        upsell2Flags: response.upsell2Flags,
      });
    } catch (error) {
      console.error("Error starting upsell 2:", error);
      res.status(500).json({ error: "Failed to start upsell 2" });
    }
  });

  /**
   * POST /api/upsell2/advance
   * Auto-advance Upsell 2 to next phase
   */
  app.post("/api/upsell2/advance", async (req, res) => {
    try {
      const { upsellSessionId } = req.body;

      if (!upsellSessionId) {
        return res.status(400).json({ error: "Missing upsellSessionId" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      const response = advanceUpsell2Phase(session);

      if (response.messages.length > 0) {
        addUpsellAssistantMessages(upsellSessionId, response.messages);
      }

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        upsell2Flags: response.upsell2Flags,
      });
    } catch (error) {
      console.error("Error advancing upsell 2 phase:", error);
      res.status(500).json({ error: "Failed to advance upsell 2 phase" });
    }
  });

  /**
   * POST /api/upsell2/action
   * Handle accept/decline pendant
   */
  app.post("/api/upsell2/action", async (req, res) => {
    try {
      const { upsellSessionId, action } = req.body;

      if (!upsellSessionId || !action) {
        return res.status(400).json({ error: "Missing upsellSessionId or action" });
      }

      const validActions: Upsell2Action[] = ["accept_pendant", "decline_pendant"];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      addToUpsellHistory(upsellSessionId, "user", `[Action: ${action}]`);

      const response = handleUpsell2Action(session, action as Upsell2Action);

      addUpsellAssistantMessages(upsellSessionId, response.messages);

      res.json({
        messages: response.messages,
        image: response.image,
        imageAfterMessage: response.imageAfterMessage,
        uiHint: response.uiHint,
        phase: response.phase,
        upsell2Flags: response.upsell2Flags,
      });
    } catch (error) {
      console.error("Error handling upsell 2 action:", error);
      res.status(500).json({ error: "Failed to process upsell 2 action" });
    }
  });

  /**
   * POST /api/upsell2/pendant
   * Process pendant purchase with optional shipping
   */
  app.post("/api/upsell2/pendant", async (req, res) => {
    try {
      const { upsellSessionId, shipping } = req.body;

      if (!upsellSessionId) {
        return res.status(400).json({ error: "Missing upsellSessionId" });
      }

      const session = getUpsellSession(upsellSessionId);
      if (!session) {
        return res.status(404).json({ error: "Upsell session not found" });
      }

      const originalSessionId = session.sessionId;
      const originalSession = getSession(originalSessionId);
      if (!originalSession) {
        return res.status(404).json({ error: "Original session not found" });
      }

      // Determine shipping data — reuse from session or from body
      let shippingData: { name: string; address1: string; address2?: string; city: string; state?: string; postal: string; country: string };

      if (session.upsell2Flags.shippingAlreadyCollected) {
        // Reuse shipping from original session (medal purchase)
        if (!originalSession.shippingName || !originalSession.shippingAddressLine1) {
          return res.status(400).json({ error: "Shipping data not found in session" });
        }
        shippingData = {
          name: originalSession.shippingName,
          address1: originalSession.shippingAddressLine1,
          address2: originalSession.shippingAddressLine2 || undefined,
          city: originalSession.shippingCity || "",
          state: originalSession.shippingState || undefined,
          postal: originalSession.shippingPostalCode || "",
          country: originalSession.shippingCountry || "",
        };
      } else {
        // Need shipping from body
        if (!shipping) {
          return res.status(400).json({ error: "Missing shipping data" });
        }
        const requiredFields = ["name", "address1", "city", "postal", "country"];
        for (const field of requiredFields) {
          if (!shipping[field]) {
            return res.status(400).json({ error: `Missing shipping ${field}` });
          }
        }
        shippingData = shipping;
      }

      // Try one-click charge
      if (isStripeEnabled()) {
        const result = await chargeOneClickUpsell({ sessionId: originalSessionId, upsellType: "pendant" });

        if (result.success) {
          console.log(`Pendant one-click charge successful: ${result.paymentIntentId}`);

          // Save shipping if it's new (not already collected from medal)
          if (!session.upsell2Flags.shippingAlreadyCollected) {
            updateSession(originalSessionId, {
              shippingName: shippingData.name,
              shippingAddressLine1: shippingData.address1,
              shippingAddressLine2: shippingData.address2 || null,
              shippingCity: shippingData.city,
              shippingState: shippingData.state || null,
              shippingPostalCode: shippingData.postal,
              shippingCountry: shippingData.country,
            });

            const DB_ENABLED = !!process.env.DATABASE_URL;
            if (DB_ENABLED) {
              dbStorage.updateSession(originalSessionId, {
                shippingName: shippingData.name,
                shippingAddressLine1: shippingData.address1,
                shippingAddressLine2: shippingData.address2 || null,
                shippingCity: shippingData.city,
                shippingState: shippingData.state || null,
                shippingPostalCode: shippingData.postal,
                shippingCountry: shippingData.country,
              }).catch((err) => console.error("Failed to save pendant shipping to DB:", err));
            }
          }

          // Update Stripe payment intent with shipping address
          if (result.paymentIntentId) {
            updatePaymentIntentShipping(result.paymentIntentId, {
              name: shippingData.name,
              addressLine1: shippingData.address1,
              addressLine2: shippingData.address2 || null,
              city: shippingData.city,
              state: shippingData.state || null,
              postalCode: shippingData.postal,
              country: shippingData.country,
            }).catch((err) => console.error("Failed to update Stripe shipping for pendant:", err));
          }

          // Add to AWeber upsell list
          if (originalSession.userEmail && isAweberEnabled()) {
            addToCustomerList(originalSession.userEmail, "pendant", {
              name: originalSession.userName || undefined,
              stripePaymentId: result.paymentIntentId || undefined,
            }).catch((err) => console.error("AWeber pendant upsell list add failed:", err));
          }

          // Update pendant status in Google Sheet
          if (originalSession.userEmail && isGoogleSheetsEnabled()) {
            updatePendantStatus(originalSession.userEmail)
              .catch((err) => console.error("Google Sheets pendant update failed:", err));
          }

          // Facebook CAPI Purchase event
          if (isFacebookEnabled() && result.paymentIntentId) {
            const fbData = extractFbRequestData(req);
            sendEvent({
              eventName: "Purchase",
              eventId: result.paymentIntentId,
              email: originalSession.userEmail || undefined,
              userName: originalSession.userName || undefined,
              ...fbData,
              customData: { value: 49, currency: "USD", content_type: "product", content_ids: ["upsell_pendant"] },
            }).catch((err) => console.error("Facebook CAPI Purchase (pendant) failed:", err));
          }

          // Set purchase type and phase
          setUpsell2PurchaseType(upsellSessionId, "pendant");
          setUpsell2Phase(upsellSessionId, "complete_2");

          return res.json({
            success: true,
            oneClick: true,
            uiHint: "show_thank_you_pendant",
            phase: "complete_2",
          });
        }

        // One-click failed — create Stripe checkout session as fallback
        console.log("Pendant one-click failed, creating checkout fallback");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const successUrl = `${baseUrl}/confirmation/${originalSessionId}?upsell=pendant`;
        const cancelUrl = `${baseUrl}/confirmation/${originalSessionId}`;

        const checkoutResult = await createUpsellCheckoutSession({
          sessionId: originalSessionId,
          upsellType: "pendant",
          email: originalSession.userEmail!,
          successUrl,
          cancelUrl,
          requiresShipping: true,
        });

        if (!checkoutResult) {
          return res.status(500).json({ error: "Failed to create checkout session" });
        }

        return res.json({
          success: false,
          oneClick: false,
          requiresCheckout: true,
          checkoutUrl: checkoutResult.url,
        });
      }

      // Stripe not enabled — just log
      console.log("Stripe not enabled, pendant order logged only:", { upsellSessionId, shippingData });
      setUpsell2PurchaseType(upsellSessionId, "pendant");
      setUpsell2Phase(upsellSessionId, "complete_2");

      res.json({
        success: true,
        uiHint: "show_thank_you_pendant",
        phase: "complete_2",
      });
    } catch (error) {
      console.error("Error processing pendant order:", error);
      res.status(500).json({ error: "Failed to process pendant order" });
    }
  });

  /**
   * GET /api/chat/check-returning
   * Check if user has a saved session (by email)
   */
  app.get("/api/chat/check-returning", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email required" });
      }

      const DB_ENABLED = !!process.env.DATABASE_URL;
      if (!DB_ENABLED) {
        return res.json({ hasSession: false });
      }

      try {
        const session = await dbStorage.getSessionByEmail(email);
        if (session && session.paymentStatus !== "completed") {
          return res.json({
            hasSession: true,
            sessionId: session.id,
            phase: session.phase,
          });
        }
      } catch (error) {
        console.error("Error checking returning user:", error);
      }

      return res.json({ hasSession: false });
    } catch (error) {
      console.error("Error checking returning user:", error);
      res.status(500).json({ error: "Failed to check returning user" });
    }
  });

  // ========================================================================
  // PAYMENT API ENDPOINTS
  // ========================================================================

  /**
   * POST /api/payment/create-checkout
   * Create a Stripe checkout session for prayer payment
   */
  app.post("/api/payment/create-checkout", async (req, res) => {
    try {
      const { sessionId, tier } = req.body;

      if (!sessionId || !tier) {
        return res.status(400).json({ error: "Missing sessionId or tier" });
      }

      // Validate tier
      const validTiers: PaymentTier[] = ["hardship", "full", "generous"];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: "Invalid payment tier" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!session.userEmail) {
        return res.status(400).json({ error: "Email not captured - cannot create payment" });
      }

      if (!isStripeEnabled()) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      // Facebook CAPI InitiateCheckout event
      if (isFacebookEnabled() && req.body.fbEventId) {
        const fbData = extractFbRequestData(req);
        const tierAmounts: Record<string, number> = { hardship: 28, full: 35, generous: 55 };
        sendEvent({
          eventName: "InitiateCheckout",
          eventId: req.body.fbEventId,
          email: session.userEmail || undefined,
          userName: session.userName || undefined,
          ...fbData,
          customData: { value: tierAmounts[tier] || 35, currency: "USD", content_type: "product", content_ids: [`prayer_${tier}`] },
        }).catch((err) => console.error("Facebook CAPI InitiateCheckout failed:", err));
      }

      // Build URLs for redirect - include {CHECKOUT_SESSION_ID} placeholder for Stripe
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/confirmation/${sessionId}?checkout_session={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/chat?session=${sessionId}&payment=cancelled`;

      const result = await createCheckoutSession({
        sessionId,
        tier,
        email: session.userEmail,
        successUrl,
        cancelUrl,
      });

      if (!result) {
        return res.status(500).json({ error: "Failed to create checkout session" });
      }

      res.json({
        checkoutUrl: result.url,
        checkoutSessionId: result.checkoutSessionId,
      });
    } catch (error) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  /**
   * POST /api/payment/create-upsell-checkout
   * Create a Stripe checkout session for upsell (medal/candle)
   */
  app.post("/api/payment/create-upsell-checkout", async (req, res) => {
    try {
      const { sessionId, upsellType } = req.body;

      if (!sessionId || !upsellType) {
        return res.status(400).json({ error: "Missing sessionId or upsellType" });
      }

      // Validate upsell type
      const validTypes: UpsellType[] = ["medal", "candle", "pendant"];
      if (!validTypes.includes(upsellType)) {
        return res.status(400).json({ error: "Invalid upsell type" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!session.userEmail) {
        return res.status(400).json({ error: "Email not captured - cannot create payment" });
      }

      if (!isStripeEnabled()) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      // Build URLs for redirect
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/confirmation/${sessionId}?upsell=${upsellType}`;
      const cancelUrl = `${baseUrl}/confirmation/${sessionId}`;

      const result = await createUpsellCheckoutSession({
        sessionId,
        upsellType,
        email: session.userEmail,
        successUrl,
        cancelUrl,
        requiresShipping: upsellType === "medal" || upsellType === "pendant",
      });

      if (!result) {
        return res.status(500).json({ error: "Failed to create upsell checkout session" });
      }

      res.json({
        checkoutUrl: result.url,
        checkoutSessionId: result.checkoutSessionId,
      });
    } catch (error) {
      console.error("Error creating upsell checkout:", error);
      res.status(500).json({ error: "Failed to create upsell checkout session" });
    }
  });

  /**
   * POST /api/payment/one-click-upsell
   * Try one-click charge for upsell, return fallback URL if not possible
   */
  app.post("/api/payment/one-click-upsell", async (req, res) => {
    try {
      const { sessionId, upsellType } = req.body;

      if (!sessionId || !upsellType) {
        return res.status(400).json({ error: "Missing sessionId or upsellType" });
      }

      const validTypes: UpsellType[] = ["medal", "candle", "pendant"];
      if (!validTypes.includes(upsellType)) {
        return res.status(400).json({ error: "Invalid upsell type" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!session.userEmail) {
        return res.status(400).json({ error: "Email not captured" });
      }

      if (!isStripeEnabled()) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      // Try one-click charge
      const result = await chargeOneClickUpsell({ sessionId, upsellType });

      if (result.success) {
        // One-click successful
        console.log(`One-click upsell success: ${upsellType} for session ${sessionId}`);

        // Add to AWeber upsell list
        if (session.userEmail && isAweberEnabled()) {
          addToCustomerList(session.userEmail, upsellType, {
            name: session.userName || undefined,
            stripePaymentId: result.paymentIntentId || undefined,
          }).catch((err) => console.error(`AWeber ${upsellType} upsell list add failed:`, err));
        }

        // Update candle status in Google Sheet
        if (upsellType === "candle" && session.userEmail && isGoogleSheetsEnabled()) {
          updateCandleStatus(session.userEmail)
            .catch((err) => console.error("Google Sheets candle update failed:", err));
        }

        // Update pendant status in Google Sheet
        if (upsellType === "pendant" && session.userEmail && isGoogleSheetsEnabled()) {
          updatePendantStatus(session.userEmail)
            .catch((err) => console.error("Google Sheets pendant update failed:", err));
        }

        // Facebook CAPI Purchase event for one-click upsell
        if (isFacebookEnabled() && result.paymentIntentId) {
          const fbData = extractFbRequestData(req);
          const upsellAmounts: Record<string, number> = { medal: 79, candle: 19, pendant: 49 };
          sendEvent({
            eventName: "Purchase",
            eventId: result.paymentIntentId,
            email: session.userEmail || undefined,
            userName: session.userName || undefined,
            ...fbData,
            customData: { value: upsellAmounts[upsellType] || 0, currency: "USD", content_type: "product", content_ids: [`upsell_${upsellType}`] },
          }).catch((err) => console.error(`Facebook CAPI Purchase (${upsellType}) failed:`, err));
        }

        return res.json({
          success: true,
          oneClick: true,
          paymentIntentId: result.paymentIntentId,
          // For medal/pendant, frontend should show shipping form
          requiresShipping: upsellType === "medal" || upsellType === "pendant",
        });
      }

      // One-click failed, create fallback checkout URL
      console.log(`One-click failed, creating checkout fallback for ${upsellType}`);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/confirmation/${sessionId}?upsell=${upsellType}`;
      const cancelUrl = `${baseUrl}/confirmation/${sessionId}`;

      const checkoutResult = await createUpsellCheckoutSession({
        sessionId,
        upsellType,
        email: session.userEmail,
        successUrl,
        cancelUrl,
        requiresShipping: upsellType === "medal" || upsellType === "pendant",
      });

      if (!checkoutResult) {
        return res.status(500).json({ error: "Failed to create checkout session" });
      }

      res.json({
        success: false,
        oneClick: false,
        requiresCheckout: true,
        checkoutUrl: checkoutResult.url,
      });
    } catch (error) {
      console.error("Error processing one-click upsell:", error);
      res.status(500).json({ error: "Failed to process upsell" });
    }
  });

  /**
   * POST /api/payment/save-shipping
   * Save shipping address after one-click medal purchase
   */
  app.post("/api/payment/save-shipping", async (req, res) => {
    try {
      const { sessionId, shipping, paymentIntentId } = req.body;

      if (!sessionId || !shipping) {
        return res.status(400).json({ error: "Missing sessionId or shipping data" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate required shipping fields
      const { name, addressLine1, city, state, postalCode, country } = shipping;
      if (!name || !addressLine1 || !city || !postalCode || !country) {
        return res.status(400).json({ error: "Missing required shipping fields" });
      }

      const shippingData = {
        name,
        addressLine1,
        addressLine2: shipping.addressLine2 || null,
        city,
        state: state || null,
        postalCode,
        country,
      };

      // Update in-memory session
      updateSession(sessionId, {
        shippingName: name,
        shippingAddressLine1: addressLine1,
        shippingAddressLine2: shipping.addressLine2 || null,
        shippingCity: city,
        shippingState: state || null,
        shippingPostalCode: postalCode,
        shippingCountry: country,
      });

      // Save to database
      const DB_ENABLED = !!process.env.DATABASE_URL;
      if (DB_ENABLED) {
        try {
          await dbStorage.updateSession(sessionId, {
            shippingName: name,
            shippingAddressLine1: addressLine1,
            shippingAddressLine2: shipping.addressLine2 || null,
            shippingCity: city,
            shippingState: state || null,
            shippingPostalCode: postalCode,
            shippingCountry: country,
          });
        } catch (error) {
          console.error("Failed to save shipping to DB:", error);
        }
      }

      // Sync shipping address to Stripe customer
      if (session.stripeCustomerId) {
        try {
          await updateStripeCustomerShipping(session.stripeCustomerId, shippingData);
          console.log(`Shipping synced to Stripe customer ${session.stripeCustomerId}`);
        } catch (error) {
          console.error("Failed to sync shipping to Stripe customer:", error);
        }
      }

      // Update PaymentIntent with shipping (so it shows in Stripe dashboard payment details)
      if (paymentIntentId) {
        try {
          await updatePaymentIntentShipping(paymentIntentId, shippingData);
          console.log(`Shipping synced to PaymentIntent ${paymentIntentId}`);
        } catch (error) {
          console.error("Failed to sync shipping to PaymentIntent:", error);
        }
      }

      // Update AWeber medal upsell subscriber with shipping address
      if (session.userEmail && isAweberEnabled()) {
        updateMedalShippingAddress(session.userEmail, shippingData)
          .then((success) => {
            if (success) {
              console.log(`AWeber shipping address updated for ${session.userEmail}`);
            }
          })
          .catch((err) => console.error("Failed to update AWeber shipping address:", err));
      }

      console.log(`Shipping saved for session ${sessionId}`);

      res.json({
        success: true,
        message: "Shipping address saved",
      });
    } catch (error) {
      console.error("Error saving shipping:", error);
      res.status(500).json({ error: "Failed to save shipping address" });
    }
  });

  /**
   * GET /api/payment/status/:sessionId
   * Check payment status for a session
   */
  app.get("/api/payment/status/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({
        paymentStatus: session.paymentStatus || "none",
        readyForPayment: session.flags.readyForPayment,
      });
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  /**
   * POST /api/payment/verify-checkout
   * Verify and finalize payment after returning from Stripe checkout.
   * This retrieves the payment_intent from the checkout session and updates the database.
   */
  app.post("/api/payment/verify-checkout", async (req, res) => {
    try {
      const { sessionId, checkoutSessionId } = req.body;

      if (!sessionId || !checkoutSessionId) {
        return res.status(400).json({ error: "Missing sessionId or checkoutSessionId" });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!isStripeEnabled()) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      // Retrieve checkout session from Stripe to get payment_intent
      const checkoutDetails = await retrieveCheckoutSession(checkoutSessionId);
      if (!checkoutDetails) {
        return res.status(400).json({ error: "Could not retrieve checkout session" });
      }

      console.log(`Verifying checkout: sessionId=${sessionId}, paymentIntentId=${checkoutDetails.paymentIntentId}, status=${checkoutDetails.paymentStatus}`);

      const DB_ENABLED = !!process.env.DATABASE_URL;

      if (checkoutDetails.paymentStatus === "paid" && DB_ENABLED) {
        try {
          // Find payment record by stripe_session_id and update with payment_intent
          const payment = await dbStorage.getPaymentByStripeSession(checkoutSessionId);
          if (payment) {
            await dbStorage.updatePayment(payment.id, {
              stripePaymentId: checkoutDetails.paymentIntentId,
              status: "completed",
              completedAt: new Date(),
            });
            console.log(`Payment record ${payment.id} updated: stripePaymentId=${checkoutDetails.paymentIntentId}`);
          }

          // Update session with payment status and customer ID
          const sessionUpdate: Record<string, any> = {
            paymentStatus: "completed",
          };
          if (checkoutDetails.customerId) {
            sessionUpdate.stripeCustomerId = checkoutDetails.customerId;
          }
          await dbStorage.updateSession(sessionId, sessionUpdate);

          // Update in-memory session
          updateSession(sessionId, sessionUpdate);

          // Update prayer intention status
          const prayer = await dbStorage.getPrayerBySession(sessionId);
          if (prayer) {
            await dbStorage.updatePrayerIntention(prayer.id, {
              status: "paid",
            });
          }

          // Add to AWeber paid list
          if (session.userEmail && isAweberEnabled()) {
            const payment = await dbStorage.getPaymentByStripeSession(checkoutSessionId);
            addToCustomerList(session.userEmail, "prayer", {
              name: session.userName || undefined,
              prayer: session.prayerText || undefined,
              tier: payment?.tier || undefined,
              stripePaymentId: checkoutDetails.paymentIntentId || undefined,
            }).catch((err) => console.error("AWeber paid list add failed:", err));
          }

          // Add to Google Sheet "lourdes grotto" (once per session)
          if (isGoogleSheetsEnabled() && !session.addedToLourdesGrotto) {
            session.addedToLourdesGrotto = true;
            appendToLourdesGrotto({
              orderId: checkoutDetails.paymentIntentId || "",
              name: session.userName || "",
              email: session.userEmail || "",
              prayer: session.prayerText || "",
            }).catch((err) => console.error("Google Sheets lourdes grotto append failed:", err));
          }

          // Facebook CAPI Purchase event
          if (isFacebookEnabled() && checkoutDetails.paymentIntentId) {
            const fbData = extractFbRequestData(req);
            const tierAmounts: Record<string, number> = { hardship: 28, full: 35, generous: 55 };
            sendEvent({
              eventName: "Purchase",
              eventId: checkoutDetails.paymentIntentId,
              email: session.userEmail || undefined,
              userName: session.userName || undefined,
              ...fbData,
              customData: { value: tierAmounts[payment?.tier as string] || 35, currency: "USD", content_type: "product", content_ids: ["prayer_petition"] },
            }).catch((err) => console.error("Facebook CAPI Purchase failed:", err));
          }
        } catch (error) {
          console.error("Error updating payment records:", error);
        }
      }

      // Look up tier for client-side pixel
      let verifiedTier: string | undefined;
      const DB_ENABLED_FOR_TIER = !!process.env.DATABASE_URL;
      if (DB_ENABLED_FOR_TIER) {
        try {
          const paymentRecord = await dbStorage.getPaymentByStripeSession(checkoutSessionId);
          verifiedTier = paymentRecord?.tier || undefined;
        } catch (_) { /* ignore */ }
      }

      res.json({
        success: true,
        paymentStatus: checkoutDetails.paymentStatus,
        paymentIntentId: checkoutDetails.paymentIntentId,
        customerId: checkoutDetails.customerId,
        tier: verifiedTier,
      });
    } catch (error) {
      console.error("Error verifying checkout:", error);
      res.status(500).json({ error: "Failed to verify checkout" });
    }
  });

  // ========================================================================
  // STRIPE WEBHOOK
  // ========================================================================

  /**
   * POST /api/webhook/stripe
   * Handle Stripe webhook events
   */
  app.post("/api/webhook/stripe", async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      console.error("Missing Stripe signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Get raw body (set by express.json verify function in index.ts)
    const rawBody = (req as any).rawBody as Buffer;
    if (!rawBody) {
      console.error("Missing raw body for webhook");
      return res.status(400).json({ error: "Missing raw body" });
    }

    const event = constructWebhookEvent(rawBody, signature);
    if (!event) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    console.log(`Stripe webhook received: ${event.type}`);

    const result = await handleWebhookEvent(event);

    // If payment completed, add to appropriate AWeber list
    if (result.success && result.sessionId && result.type) {
      const session = getSession(result.sessionId);
      if (session?.userEmail && isAweberEnabled()) {
        // Determine purchase type for email sequence
        const purchaseType = result.type === "medal" ? "medal" :
                            result.type === "candle" ? "candle" :
                            result.type === "pendant" ? "pendant" : "prayer";

        // Get prayer text, tier, and payment ID for the AWeber custom fields
        const aweberData: { name?: string; prayer?: string; tier?: string; stripePaymentId?: string } = {
          name: session.userName || undefined,
        };

        // Include stripe_payment_id for all purchase types (paid, medal, candle)
        if (result.paymentIntentId) {
          aweberData.stripePaymentId = result.paymentIntentId; // pi_xxx
        }
        // Include prayer and tier for paid list only
        if (purchaseType === "prayer") {
          if (session.prayerText) {
            aweberData.prayer = session.prayerText;
          }
          if (result.tier) {
            aweberData.tier = result.tier; // hardship, full, or generous
          }
        }

        addToCustomerList(session.userEmail, purchaseType, aweberData)
          .catch((err) => console.error("AWeber customer add failed:", err));

        // Update candle status in Google Sheet
        if (purchaseType === "candle" && session.userEmail && isGoogleSheetsEnabled()) {
          updateCandleStatus(session.userEmail)
            .catch((err) => console.error("Google Sheets candle update failed:", err));
        }

        // Update pendant status in Google Sheet
        if (purchaseType === "pendant" && session.userEmail && isGoogleSheetsEnabled()) {
          updatePendantStatus(session.userEmail)
            .catch((err) => console.error("Google Sheets pendant update failed:", err));
        }
      }

      // Facebook CAPI Purchase event from webhook (no browser context)
      if (isFacebookEnabled() && result.paymentIntentId) {
        const fbPurchaseType = result.type === "medal" ? "medal" :
                               result.type === "candle" ? "candle" :
                               result.type === "pendant" ? "pendant" : "prayer";
        const webhookAmountMap: Record<string, number> = { prayer: 35, medal: 79, candle: 19, pendant: 49 };
        let fbAmount = webhookAmountMap[fbPurchaseType] || 35;
        if (fbPurchaseType === "prayer" && result.tier) {
          const tierAmounts: Record<string, number> = { hardship: 28, full: 35, generous: 55 };
          fbAmount = tierAmounts[result.tier] || 35;
        }
        sendEvent({
          eventName: "Purchase",
          eventId: result.paymentIntentId,
          email: session?.userEmail || undefined,
          userName: session?.userName || undefined,
          customData: { value: fbAmount, currency: "USD", content_type: "product", content_ids: [fbPurchaseType === "prayer" ? "prayer_petition" : `upsell_${fbPurchaseType}`] },
        }).catch((err) => console.error("Facebook CAPI Purchase (webhook) failed:", err));
      }
    }

    if (result.success) {
      res.json({ received: true });
    } else {
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  return httpServer;
}
