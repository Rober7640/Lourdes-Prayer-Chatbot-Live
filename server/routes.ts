import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  generateResponse,
  getWelcomeMessages,
  getBucketAcknowledgment,
  type BucketType,
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
  incrementInappropriate,
  setCrisisFlag,
} from "./services/session";

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
      const session = createSession();
      const welcome = getWelcomeMessages();

      // Add welcome messages to history
      addAssistantMessages(session.sessionId, welcome.messages);

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
      setBucket(sessionId, bucket);

      // Add user's bucket selection to history
      const bucketLabels: Record<string, string> = {
        family_reconciliation: "A Family Wound",
        healing_health: "Healing for Someone ill",
        protection: "Protection for a Loved One",
        grief: "Grief or Loss",
        guidance: "Guidance in a Difficult Season",
      };
      addToHistory(sessionId, "user", `[Selected: ${bucketLabels[bucket]}]`);

      // Get acknowledgment for this bucket (pass userName for personalization)
      const acknowledgment = getBucketAcknowledgment(bucket, session.userName);
      addAssistantMessages(sessionId, acknowledgment.messages);

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
      updateExtracted(sessionId, { userEmail: email });

      // Add to history
      addToHistory(sessionId, "user", `[Email: ${email}]`);

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

      addAssistantMessages(sessionId, followUp);

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
      addToHistory(sessionId, "user", message);

      // Generate Claude response
      const response = await generateResponse(message, session);

      // Update session with extracted data
      if (response.extracted.userName || response.extracted.personName || response.extracted.relationship || response.extracted.userEmail) {
        updateExtracted(sessionId, response.extracted);
      }

      // Handle flags
      if (response.flags.readyForPayment) {
        setReadyForPayment(sessionId);
      }
      if (response.flags.conversationComplete) {
        setPhase(sessionId, "complete");
      }

      // Add assistant messages to history
      addAssistantMessages(sessionId, response.messages);

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

      addAssistantMessages(sessionId, paymentTransitionMessages);

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
