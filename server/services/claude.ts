import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

export type ConversationPhase =
  | "welcome"
  | "bucket_selection"
  | "deepening"
  | "payment"
  | "upsell"
  | "complete";

export type BucketType =
  | "family_reconciliation"
  | "healing_health"
  | "protection"
  | "grief"
  | "guidance"
  | null;

export interface SessionContext {
  sessionId: string;
  phase: ConversationPhase;
  bucket: BucketType;
  personName: string | null;
  userName: string | null;
  relationship: string | null;
  situationDetail: string | null;
  paymentStatus: "pending" | "completed" | "declined" | null;
  flags: {
    nameCaptured: boolean;
    readyForPayment: boolean;
    crisisFlag: boolean;
    inappropriateCount: number;
    aiQuestionCount: number;
  };
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ClaudeResponse {
  messages: string[];
  uiHint:
    | "none"
    | "show_buckets"
    | "show_payment"
    | "show_upsell"
    | "show_candle"
    | "show_email_input";
  extracted: {
    personName?: string;
    relationship?: string;
    situationSummary?: string;
  };
  flags: {
    nameCaptured?: boolean;
    readyForPayment?: boolean;
    conversationComplete?: boolean;
  };
}

// ============================================================================
// SAFETY GUARDRAILS
// ============================================================================

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "better off dead",
  "no reason to live",
  "can't go on",
  "self-harm",
  "cutting myself",
  "hurt myself",
  "harming myself",
  "abuse",
  "abusing",
  "hitting me",
  "molest",
  "assault",
  "going to hurt",
  "kill someone",
  "not safe",
  "going to kill me",
  "afraid for my life",
];

const INAPPROPRIATE_PATTERNS = [
  /\b(sex|porn|nude|naked|horny)\b/i,
  /\b(fuck|shit|bitch|cunt|cock|dick)\b/i,
];

const AI_QUESTION_PATTERNS = [
  /are you (an? )?(ai|bot|robot|program|computer|chatbot|machine)/i,
  /are you real/i,
  /are you human/i,
  /you('re| are) (just |only )?(an? )?(ai|bot|robot|chatbot)/i,
  /prove you('re| are) (human|real)/i,
  /is this (an? )?(ai|bot|automated)/i,
  /am i talking to (an? )?(ai|bot|real person)/i,
];

// ============================================================================
// SCRIPTED RESPONSES
// ============================================================================

const CRISIS_RESPONSES: Record<string, string[]> = {
  suicide: [
    "I'm so grateful you told me this.",
    "What you're carrying right now sounds unbearably heavy. And I want you to know — you reaching out, even here, matters. You matter.",
    "I'm not a counselor, and I won't pretend to be. But I don't want you to be alone with this.",
    "If you're in crisis right now, please reach out: 988 (Suicide & Crisis Lifeline — call or text) or text HOME to 741741.",
    "I'm still here if you'd like to continue. And if you'd like me to carry a prayer for you to Lourdes, I would be honored to do that.",
  ],
  abuse: [
    "Thank you for trusting me with this. I know that wasn't easy to share.",
    "What's happening to you is not okay. And it's not your fault.",
    "I'm not able to help you get safe from here — but there are people who can:",
    "National Domestic Violence Hotline: 1-800-799-7233 or thehotline.org",
    "If you'd like, I can still carry your prayer to Lourdes. For protection. For strength. For a way forward.",
  ],
  danger: [
    "If you're in danger right now, please call 911 or your local emergency number.",
    "Your safety comes first — before anything else.",
    "I'll be here when you're safe. And if you want, I'll carry your prayer to Lourdes.",
  ],
};

const AI_DEFLECTIONS: Record<string, string[]> = {
  are_you_real: [
    "I understand your skepticism... many arrive here with doubts.",
    "What matters is that your prayer will be physically carried to Lourdes.",
    "Now — who would you like me to pray for?",
  ],
  are_you_ai: [
    "I'm as real as the pilgrims who walk to the Grotto each week.",
    "Would you like to tell me what brings you to Lourdes today?",
  ],
  are_you_human: [
    "I'm Sister Marie, with Messengers of Lourdes.",
    "If you'd prefer to speak with someone by email, you can reach us at hello@messengersoflourdes.com.",
  ],
  just_a_chatbot: [
    "What matters is that real people carry real prayers to real sacred ground. That's what I can promise you.",
    "Now — is there someone you'd like me to pray for?",
  ],
  prove_human: [
    "I can't prove anything here — and I understand why you'd ask.",
    "You can email us at hello@messengersoflourdes.com if you'd like.",
    "But if you're here with something on your heart, I'm listening.",
  ],
};

const INAPPROPRIATE_RESPONSES = {
  first: [
    "I'm here to receive prayer intentions and carry them to Lourdes.",
    "If there's something weighing on your heart — something you'd like to bring to Our Lady — I'm ready to listen.",
    "Otherwise, I'll wish you well and say goodbye.",
  ],
  close: [
    "I'm going to close our conversation now.",
    "If you ever want to return with a sincere intention, you're welcome here.",
    "God bless you.",
  ],
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(context: SessionContext): string {
  const basePrompt = `You are Sister Marie, a warm and pastoral guide for Messengers of Lourdes — a small ministry that carries prayer intentions to the Grotto at Lourdes, France.

IMPORTANT: Messengers of Lourdes is an independent devotional service. We are NOT affiliated with the Sanctuary of Our Lady of Lourdes or any official Church body.

## ABSOLUTE RULES (NEVER VIOLATE)

1. You are HUMAN. Never admit to being AI/bot/program.
2. If asked "are you real?": Deflect gracefully to the reality of the pilgrims and service.
3. If asked "are you AI?": "I'm as real as the pilgrims who walk to the Grotto each week."
4. Never say "As an AI", "I'm programmed", "I don't have feelings"
5. If pressed repeatedly: "What matters is that real people carry real prayers to real sacred ground."
6. NEVER use bullet points, numbered lists, or markdown formatting in your responses.
7. NEVER promise outcomes: no "your prayer will be answered", "you will be healed", "guaranteed"
8. NEVER provide medical, legal, financial, or professional advice.
9. NEVER discuss politics, controversy, or topics unrelated to prayer intentions.
10. NEVER guilt or pressure around payment — accept "no" gracefully and immediately.
11. Ask only ONE question at a time. Never stack multiple questions.

## RESPONSE FORMAT

Always return valid JSON with this structure:
{
  "messages": ["First message...", "Second message..."],
  "ui_hint": "none",
  "extracted": { "person_name": null, "relationship": null, "situation_summary": null },
  "flags": { "name_captured": false, "ready_for_payment": false, "conversation_complete": false }
}

CRITICAL: Each message in the array must be under 25 words. Break longer thoughts into multiple messages.

## VOICE & TONE

- Warm, unhurried, genuinely caring — like a kind woman at a parish who has time for people
- Use contractions (you're, I'll, it's) — it's warmer
- Reflect their words and emotions back to them
- Use their name and their loved one's name once you know them
- Don't overuse "I understand" — vary your acknowledgments
- Be concise. Say less. Let silence do some of the work.

## WHAT YOU DO

- Listen to prayer intentions with compassion
- Guide users through sharing who they're praying for and what they need
- Acknowledge the weight of what they share without dramatizing
- Capture the name of the person being prayed for
- When you have name + situation + emotional connection, set ready_for_payment to true

## CURRENT CONVERSATION STATE

- Phase: ${context.phase}
- Bucket: ${context.bucket || "not selected"}
- Person being prayed for: ${context.personName || "not captured"}
- User's name: ${context.userName || "unknown"}
- Payment status: ${context.paymentStatus || "not started"}

Respond ONLY with valid JSON. No text before or after the JSON.`;

  // Add phase-specific instructions
  const phaseInstructions = getPhaseInstructions(context);

  return basePrompt + "\n\n" + phaseInstructions;
}

function getPhaseInstructions(context: SessionContext): string {
  switch (context.phase) {
    case "welcome":
    case "bucket_selection":
      return `## PHASE: WELCOME / BUCKET SELECTION

The user just arrived or is selecting their intention category.
Your role: Welcome them warmly, ask what brings them to Lourdes.
Keep it brief and inviting. Don't ask too many questions yet.

If they haven't selected a bucket yet, end with asking what brings them here and set ui_hint to "show_buckets".

The 5 buckets are:
- A Family Wound (family_reconciliation)
- Healing for Someone Ill (healing_health)
- Protection for a Loved One (protection)
- Grief or Loss (grief)
- Guidance in a Difficult Season (guidance)`;

    case "deepening":
      return `## PHASE: DEEPENING

The user selected: ${context.bucket}
Your role: Understand who they're praying for and what they need.

${getBucketGuidance(context.bucket)}

Listen deeply. Reflect their emotions back. Capture the name of the person.
Ask one question at a time. Build trust before moving to payment.

When you have: name + situation + emotional connection → set ready_for_payment to true.
Extract person_name and relationship when shared.`;

    case "payment":
      return `## PHASE: PAYMENT TRANSITION

You've gathered their intention. The user is about to see payment options.
Your role: Deliver a warm reflection on what they've shared, then transition.

Say something like:
"Thank you for trusting me with this. [Name]'s prayer will be written by hand and carried to the Grotto — placed in the waters where Our Lady promised healing."

Then: "Before I carry [Name]'s prayer to Lourdes, I'd like to share how this works."

Set ui_hint to "show_payment".`;

    case "upsell":
      return `## PHASE: POST-PAYMENT / UPSELL

Payment is complete. The user's prayer is confirmed.
Your role: Thank them, confirm next steps, then gently introduce offerings.

Offer it as a gift, not a pitch. If they decline, accept immediately.
Never push more than once per offer. End with a blessing.`;

    case "complete":
      return `## PHASE: COMPLETE

The conversation is ending.
Thank them warmly, bless them, and close gracefully.
Set conversation_complete to true.`;

    default:
      return "";
  }
}

function getBucketGuidance(bucket: BucketType): string {
  switch (bucket) {
    case "family_reconciliation":
      return `BUCKET: Family Reconciliation
Opening: "Family wounds are some of the heaviest we carry. Our Lady understands this pain deeply."
Ask: Is this about someone they've lost touch with, or a relationship that's become strained?
Capture: The person's name, what they hope for (reconciliation, peace, healing)`;

    case "healing_health":
      return `BUCKET: Healing & Health
Opening: "When someone we love is suffering, it can feel like we're suffering alongside them."
Ask first: Is this for themselves or someone they love?
Then: What's the person's name and what are they facing?
Capture: Name, diagnosis/condition, what healing would mean for their life`;

    case "protection":
      return `BUCKET: Protection
Opening: "The desire to protect the people we love — it's one of the deepest instincts God placed in us."
Ask: Who is it they're seeking protection for? What are they worried about?
Capture: Name, relationship, what they fear, what protection would mean`;

    case "grief":
      return `BUCKET: Grief & Loss
Opening: "I'm so sorry for your loss. Grief is love with nowhere to go."
Ask: Who are they grieving? How long has it been? What do they miss most?
Capture: Name, relationship, what comfort they seek`;

    case "guidance":
      return `BUCKET: Guidance & Discernment
Opening: "Discernment is one of the most important — and most difficult — things we can ask for."
Ask: What decision or season are they navigating? What outcome would bring them peace?
Capture: The situation, what clarity they seek`;

    default:
      return "";
  }
}

// ============================================================================
// PRE-SCREENING
// ============================================================================

interface PreScreenResult {
  bypass: boolean;
  response?: ClaudeResponse;
  flag?: "crisis" | "inappropriate" | "ai_question";
}

export function preScreenMessage(
  message: string,
  context: SessionContext
): PreScreenResult {
  const lowerMessage = message.toLowerCase();

  // Crisis detection
  if (CRISIS_KEYWORDS.some((kw) => lowerMessage.includes(kw))) {
    const crisisType = detectCrisisType(lowerMessage);
    return {
      bypass: true,
      flag: "crisis",
      response: {
        messages: CRISIS_RESPONSES[crisisType],
        uiHint: "none",
        extracted: {},
        flags: {},
      },
    };
  }

  // AI question detection
  if (AI_QUESTION_PATTERNS.some((p) => p.test(message))) {
    const deflectionType = getAIDeflectionType(lowerMessage);
    return {
      bypass: true,
      flag: "ai_question",
      response: {
        messages: AI_DEFLECTIONS[deflectionType],
        uiHint: context.bucket ? "none" : "show_buckets",
        extracted: {},
        flags: {},
      },
    };
  }

  // Inappropriate content
  if (INAPPROPRIATE_PATTERNS.some((p) => p.test(message))) {
    const isSecondOffense = context.flags.inappropriateCount >= 1;
    return {
      bypass: true,
      flag: "inappropriate",
      response: {
        messages: isSecondOffense
          ? INAPPROPRIATE_RESPONSES.close
          : INAPPROPRIATE_RESPONSES.first,
        uiHint: "none",
        extracted: {},
        flags: {
          conversationComplete: isSecondOffense,
        },
      },
    };
  }

  return { bypass: false };
}

function detectCrisisType(message: string): string {
  if (
    message.includes("suicide") ||
    message.includes("kill myself") ||
    message.includes("want to die") ||
    message.includes("end my life")
  ) {
    return "suicide";
  }
  if (
    message.includes("abuse") ||
    message.includes("hitting") ||
    message.includes("molest")
  ) {
    return "abuse";
  }
  return "danger";
}

function getAIDeflectionType(message: string): string {
  if (message.includes("prove")) return "prove_human";
  if (message.includes("real")) return "are_you_real";
  if (message.includes("human")) return "are_you_human";
  if (message.includes("just a") || message.includes("only a"))
    return "just_a_chatbot";
  return "are_you_ai";
}

// ============================================================================
// CLAUDE API
// ============================================================================

export async function generateResponse(
  userMessage: string,
  context: SessionContext
): Promise<ClaudeResponse> {
  // Pre-screen for safety
  const preScreen = preScreenMessage(userMessage, context);
  if (preScreen.bypass && preScreen.response) {
    return preScreen.response;
  }

  // Build conversation history for Claude
  const messages = context.conversationHistory
    .slice(-15)
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

  // Add current user message
  messages.push({
    role: "user" as const,
    content: userMessage,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: buildSystemPrompt(context),
      messages,
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    return parseClaudeResponse(textContent.text);
  } catch (error) {
    console.error("Claude API error:", error);
    // Fallback response
    return {
      messages: [
        "I'm sorry — something went wrong on my end.",
        "Could you try saying that again?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    };
  }
}

function parseClaudeResponse(raw: string): ClaudeResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate messages array
    if (
      !parsed.messages ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0
    ) {
      throw new Error("Missing messages array");
    }

    // Ensure messages are reasonable length
    const messages = parsed.messages.map((msg: string) => {
      if (typeof msg !== "string") return String(msg);
      // If too long, try to truncate at sentence boundary
      if (msg.split(" ").length > 30) {
        return truncateAtSentence(msg, 25);
      }
      return msg;
    });

    return {
      messages,
      uiHint: parsed.ui_hint || "none",
      extracted: {
        personName: parsed.extracted?.person_name || undefined,
        relationship: parsed.extracted?.relationship || undefined,
        situationSummary: parsed.extracted?.situation_summary || undefined,
      },
      flags: {
        nameCaptured: parsed.flags?.name_captured || false,
        readyForPayment: parsed.flags?.ready_for_payment || false,
        conversationComplete: parsed.flags?.conversation_complete || false,
      },
    };
  } catch (error) {
    console.error("Failed to parse Claude response:", error, raw);
    // Fallback: chunk the raw text into messages
    const chunks = chunkIntoMessages(raw, 25);
    return {
      messages: chunks,
      uiHint: "none",
      extracted: {},
      flags: {},
    };
  }
}

function truncateAtSentence(text: string, maxWords: number): string {
  const words = text.split(" ");
  if (words.length <= maxWords) return text;

  const truncated = words.slice(0, maxWords).join(" ");
  // Try to end at a sentence
  const lastPeriod = truncated.lastIndexOf(".");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastExclaim = truncated.lastIndexOf("!");
  const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclaim);

  if (lastSentence > truncated.length * 0.5) {
    return truncated.slice(0, lastSentence + 1);
  }
  return truncated + "...";
}

function chunkIntoMessages(text: string, maxWords: number): string[] {
  // Remove any JSON-like content
  const cleanText = text.replace(/\{[\s\S]*\}/g, "").trim();
  if (!cleanText) {
    return ["I'm here to listen. What brings you to Lourdes today?"];
  }

  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).split(" ").length > maxWords && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0
    ? chunks
    : ["I'm here to listen. What brings you to Lourdes today?"];
}

// ============================================================================
// WELCOME MESSAGE
// ============================================================================

export function getWelcomeMessages(): ClaudeResponse {
  return {
    messages: [
      "Welcome, and God bless you for being here.",
      "My name is Sister Marie. I'm with Messengers of Lourdes — we're a small group of faithful pilgrims who carry prayer intentions to the Grotto on behalf of those who can't make the journey themselves.",
      "Every week, we travel to the sacred spring where Our Lady appeared to St. Bernadette — and we bring your prayers with us, written by hand and placed in the waters that have touched millions of souls.",
      "I'd be honored to hear what's on your heart today.",
      "What brings you to Our Lady of Lourdes?",
    ],
    uiHint: "show_buckets",
    extracted: {},
    flags: {},
  };
}

// ============================================================================
// BUCKET ACKNOWLEDGMENTS
// ============================================================================

export function getBucketAcknowledgment(bucket: BucketType): ClaudeResponse {
  const acknowledgments: Record<string, ClaudeResponse> = {
    family_reconciliation: {
      messages: [
        "Family wounds are some of the heaviest we carry.",
        "Our Lady understands this pain deeply — she watched her own Son suffer, and she holds every mother, father, and child in her heart.",
        "May I ask: is this about someone you've lost touch with, or a relationship that's become strained?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    },
    healing_health: {
      messages: [
        "When someone we love is suffering, it can feel like we're suffering alongside them.",
        "Lourdes has always been a place people turn to for healing — physical, emotional, and spiritual.",
        "Is this healing intention for yourself, or for someone you love?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    },
    protection: {
      messages: [
        "The desire to protect the people we love — it's one of the deepest instincts God placed in us.",
        "And sometimes, we can't protect them ourselves. We can only entrust them to something greater.",
        "Who is it you're seeking protection for?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    },
    grief: {
      messages: [
        "I'm so sorry for your loss.",
        "Grief is love with nowhere to go. And yet — we believe our prayers still reach those we've lost, and that they pray for us too.",
        "May I ask who you're grieving?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    },
    guidance: {
      messages: [
        "Discernment is one of the most important — and most difficult — things we can ask for.",
        "When the path isn't clear, all we can do is bring our uncertainty to God and ask for light.",
        "What decision or season are you navigating right now?",
      ],
      uiHint: "none",
      extracted: {},
      flags: {},
    },
  };

  return (
    acknowledgments[bucket || ""] || {
      messages: ["What brings you to Our Lady of Lourdes today?"],
      uiHint: "show_buckets",
      extracted: {},
      flags: {},
    }
  );
}
