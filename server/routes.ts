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
        `${personName}'s prayer will be written by hand on blessed parchment.`,
        "Each week, our pilgrims walk to the sacred Grotto at Lourdes, France — the very place where Our Lady appeared to Saint Bernadette.",
        "Your prayer will be placed in the waters of the spring, where countless miracles have been recorded.",
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

  return httpServer;
}
