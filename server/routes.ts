import type { Express } from "express";
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
} from "./services/upsell-session";
import {
  getInitialUpsellMessages,
  handleUpsellAction,
  advanceUpsellPhase,
  handleUpsellMessage,
  type UpsellAction,
} from "./services/claude-upsell";

// ============================================================================
// HELPER FUNCTIONS FOR PRAYER EXTRACTION
// ============================================================================

/**
 * Extract the prayer text from messages or conversation history
 * Prayers typically contain "Amen" and prayer indicators
 */
function extractPrayerText(
  currentMessages: string[],
  conversationHistory: Array<{ role: string; content: string }>
): string | null {
  // First check current messages for a prayer
  for (const msg of currentMessages) {
    if (looksLikePrayer(msg)) {
      return msg;
    }
  }

  // Then check recent assistant messages in history (look backwards)
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const entry = conversationHistory[i];
    if (entry.role === "assistant" && looksLikePrayer(entry.content)) {
      return entry.content;
    }
    // Don't look back more than 10 messages
    if (conversationHistory.length - i > 10) break;
  }

  return null;
}

/**
 * Check if a message looks like a prayer
 */
function looksLikePrayer(text: string): boolean {
  const lower = text.toLowerCase();
  const hasAmen = lower.includes("amen");
  const hasPrayerAddress =
    lower.includes("blessed mother") ||
    lower.includes("holy mary") ||
    lower.includes("our lady") ||
    lower.includes("dear god") ||
    lower.includes("dear lord");
  const hasPetition =
    lower.includes("please intercede") ||
    lower.includes("please pray") ||
    lower.includes("i ask") ||
    lower.includes("i pray");

  // Must have Amen and at least one other indicator
  return hasAmen && (hasPrayerAddress || hasPetition);
}

/**
 * Check if the user wrote their own prayer
 */
function didUserWritePrayer(userMessage: string): boolean {
  return looksLikePrayer(userMessage);
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
        // Look for the prayer in recent conversation history or current response
        const prayerText = extractPrayerText(response.messages, session.conversationHistory);
        if (prayerText) {
          // Determine if prayer was user-written or Claude-composed
          const userWrotePrayer = didUserWritePrayer(message);
          await savePrayerIntention(
            sessionId,
            prayerText,
            userWrotePrayer ? "user" : "claude"
          );
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

      // TODO: Create Stripe checkout session for $79 medal
      // For now, return success with placeholder
      console.log("Medal order received:", {
        upsellSessionId,
        shipping,
        amount: 7900, // $79 in cents
      });

      // Set purchase type and phase
      setPurchaseType(upsellSessionId, "medal");
      setUpsellPhase(upsellSessionId, "complete");

      res.json({
        success: true,
        message: "Medal order received",
        uiHint: "show_thank_you_medal",
        phase: "complete",
        // In production: stripeSessionUrl for redirect
      });
    } catch (error) {
      console.error("Error processing medal order:", error);
      res.status(500).json({ error: "Failed to process medal order" });
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

      // TODO: Create Stripe checkout session for $19 candle
      // For now, return success with placeholder
      console.log("Candle order received:", {
        upsellSessionId,
        amount: 1900, // $19 in cents
      });

      res.json({
        success: true,
        message: "Candle order received",
        // In production: stripeSessionUrl for redirect
      });
    } catch (error) {
      console.error("Error processing candle order:", error);
      res.status(500).json({ error: "Failed to process candle order" });
    }
  });

  return httpServer;
}
