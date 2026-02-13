import Anthropic from "@anthropic-ai/sdk";
import {
  type UpsellSessionContext,
  type UpsellResponse,
  type UpsellPhase,
  type UpsellUiHint,
  type UpsellImage,
  type PrayingFor,
  type PurchaseType,
  setUpsellPhase,
  setUpsellFlag,
  incrementMessageIndex,
  setPurchaseType,
} from "./upsell-session";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// SCRIPTED MESSAGES BY PHASE
// ============================================================================

// The upsell flow is primarily scripted with phase-based messages
// We use Claude for handling free-form user responses

interface ScriptedMessage {
  messages: string[];
  image: UpsellImage;
  imageAfterMessage?: number; // 0 = before all, 1 = after first msg, etc. Default: after all
  uiHint: UpsellUiHint;
  nextPhase?: UpsellPhase;
}

function getTransitionMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        `Thank you, ${userName}.`,
        "Your prayer is in our hands now. It will be placed at the Grotto within seven days.",
        "You'll receive a photo when it's done.",
        "Before you go — may I show you something?",
      ],
      image: null,
      uiHint: "continue_or_go",
    };
  }

  return {
    messages: [
      `Thank you, ${userName}.`,
      `${personName}'s prayer is in our hands now. It will be placed at the Grotto within seven days.`,
      "You'll receive a photo when it's done.",
      "Before you go — may I show you something?",
    ],
    image: null,
    uiHint: "continue_or_go",
  };
}

function getIntroductionMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const personName = ctx.personName || "them";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "I'm glad you asked.",
        "You can't go to Lourdes right now.",
        "The distance is too far. The cost too high. Life doesn't stop — especially when you're the one carrying this.",
        "But there's another way.",
        "You can bring Lourdes to you.",
      ],
      image: null,
      uiHint: "none",
      nextPhase: "show_front",
    };
  }

  return {
    messages: [
      "I'm glad you asked.",
      `You can't bring ${personName} to Lourdes.`,
      "The distance is too far. The cost too high. Life doesn't stop.",
      "But there's another way.",
      `You can bring Lourdes to ${personName}.`,
    ],
    image: null,
    uiHint: "none",
    nextPhase: "show_front",
  };
}

function getShowFrontMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const isForSelf = ctx.flags.prayingFor === "self";

  const baseMessages = [
    "This is the Lourdes Healing Medal.",
    "On the front — a young woman kneeling before a cave. That's Bernadette.",
    "And above her — Our Lady, appearing in the rock.",
    "Look at her hands. Folded in prayer. Just like yours right now.",
  ];

  if (isForSelf) {
    baseMessages.push("This is the moment that has brought hope to millions — including those who couldn't make the journey.");
  } else {
    baseMessages.push("This is the moment that changed everything.");
  }

  return {
    messages: baseMessages,
    image: "medal_front",
    imageAfterMessage: 1, // Show image after "This is the Lourdes Healing Medal"
    uiHint: "none",
    nextPhase: "bernadette_story",
  };
}

function getBernadetteStoryMessages(): ScriptedMessage {
  return {
    messages: [
      "Let me tell you about Bernadette.",
      "She was 14 years old. The daughter of a miller who had lost everything.",
      "Her family lived in a single room — a former jail cell. They had nothing.",
      "She was small, sickly, and couldn't read. The last person anyone would expect God to choose.",
      "On February 11, 1858, she went to gather firewood by the river Gave.",
      "That's when she saw a lady dressed in white, standing in the grotto.",
      "The lady appeared to her 18 times. She told Bernadette to dig in the mud. And when she did — a spring appeared.",
      "When Bernadette asked the lady who she was, she answered: \"I am the Immaculate Conception.\"",
      "Bernadette suffered from asthma her whole life. She knew what it meant to carry pain.",
      "She died at 35. But here's the remarkable thing — her body has never decayed. You can still see her today, in Nevers, France. Perfectly preserved.",
    ],
    image: "bernadette_portrait",
    imageAfterMessage: 1, // Show portrait after "Let me tell you about Bernadette"
    uiHint: "none",
    nextPhase: "water_reveal",
  };
}

function getWaterRevealMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  const messages = [
    "That spring still flows today. Millions come to touch it every year.",
    "Now — turn the medal over.",
    "You see that small window? Inside it — water from the spring at Lourdes.",
    "70 healings have been verified by the Church. Doctors couldn't explain them. The investigations took years.",
    "If you ever go to the Grotto, you'll see it — pilgrims kneeling by the water in silence. Touching it. Praying.",
  ];

  if (isForSelf) {
    messages.push("The same water Bernadette uncovered with her hands. The same water your prayer will be placed beside.");
    messages.push("You can carry that water with you — wherever you go, whatever you're facing.");
  } else {
    messages.push(`The same water Bernadette uncovered with her hands. The same water your prayer for ${personName} will be placed beside.`);
    messages.push(`${personName} can carry that water with them.`);
  }

  return {
    messages,
    image: "medal_back",
    imageAfterMessage: 2, // Show medal_back after "Now — turn the medal over."
    uiHint: "none",
    nextPhase: "social_proof",
  };
}

function getSocialProofMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "This is Elena. She wore the medal during her treatment last year.",
        "She told us:",
        '"I held it every time I walked into the hospital. It reminded me I wasn\'t facing this alone."',
      ],
      image: "testimonial_medal_self",
      imageAfterMessage: 1, // Show testimonial after "This is Elena..."
      uiHint: "none",
      nextPhase: "the_giving",
    };
  }

  return {
    messages: [
      "This is Rosa. She sent a medal to her mother before surgery.",
      "She told us:",
      '"My mother held it the whole time she was in the hospital. She said it made her feel like I was there with her."',
    ],
    image: "testimonial_medal",
    imageAfterMessage: 1, // Show testimonial after "This is Rosa..."
    uiHint: "none",
    nextPhase: "the_giving",
  };
}

function getTheGivingMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const personName = ctx.personName || "them";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "When the medal arrives, you can wear it around your neck.",
        "Or keep it in your pocket. By your bedside. Wherever you need it close.",
        "Some people hold it and pray:",
        '"Our Lady of Lourdes, I carry your water with me. Walk with me through this. I\'m not alone."',
        "Or they don't say anything at all. They just hold it — and feel the weight of something sacred in their hands.",
        "Some people tell us it was the first moment they felt they weren't carrying this alone.",
        "I should tell you — there are many Lourdes medals sold online. Most are mass-produced. Some don't even contain real Lourdes water.",
        "This one is different. It's crafted by artisans in Europe and ships directly from France — not from a warehouse in China.",
        "It comes with a Certificate of Authenticity confirming the water inside is from the sacred spring at Lourdes.",
      ],
      image: "certificate",
      imageAfterMessage: 9, // Show certificate after the last message
      uiHint: "none",
      nextPhase: "the_ask",
    };
  }

  return {
    messages: [
      `When the medal arrives, you can give it to ${personName} yourself.`,
      "Or send it to them with a note.",
      "Some people place it in their loved one's hands and say a simple blessing:",
      '"This water comes from the spring where Our Lady appeared. I\'m praying for you. You\'re not alone."',
      "Or they say nothing at all. They just give it — and let the medal speak.",
      "You don't have to say anything. Just place it in their hands.",
      "Some people tell us it was the first time they saw their loved one cry.",
      "I should tell you — there are many Lourdes medals sold online. Most are mass-produced. Some don't even contain real Lourdes water.",
      "This one is different. It's crafted by artisans in Europe and ships directly from France — not from a warehouse in China.",
      "It comes with a Certificate of Authenticity confirming the water inside is from the sacred spring at Lourdes.",
    ],
    image: "certificate",
    imageAfterMessage: 10, // Show certificate after the last message
    uiHint: "none",
    nextPhase: "the_ask",
  };
}

function getTheAskMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        `This isn't something we sell in a shop, ${userName}.`,
        "Each medal is sent to one person, for one intention.",
        "Would you like me to send one to you — something to carry through this?",
      ],
      image: null,
      uiHint: "show_offer_self",
    };
  }

  return {
    messages: [
      `This isn't something we sell in a shop, ${userName}.`,
      "Each medal is sent to one person, for one intention.",
      `Would you like me to send one to you — for ${personName}?`,
    ],
    image: null,
    uiHint: "show_offer",
  };
}

function getAcceptanceMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const userName = ctx.userName || "friend";

  return {
    messages: [
      `Almost there, ${userName}! Just need your shipping address so we can send the medal directly from France.`,
      "Make sure your address is correct — it ships internationally and arrives in 7-10 days.",
    ],
    image: null,
    uiHint: "show_shipping_form",
  };
}

function getTellMeMoreMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  const messages = [
    "Of course.",
    "The medal is 14k silver plated and crafted by artisans in Europe. This isn't something mass-produced in a factory overseas.",
    "You can feel the difference when you hold it. The weight. The detail. It's made to last a lifetime.",
    "The water inside is drawn from the spring at Lourdes — the same source where 70 Church-verified healings have occurred.",
    "Every medal comes with a Certificate of Authenticity. There are many fakes sold online — medals with no real Lourdes water, or water of unknown origin.",
    "This certificate confirms your water is from the sacred spring at Lourdes, France.",
    "It ships directly from France to you — free of charge. It can be worn around the neck, carried in a pocket, or placed by a bedside.",
  ];

  if (isForSelf) {
    messages.push("Would you like me to send one to you?");
  } else {
    messages.push(`Would you like me to send one for ${personName}?`);
  }

  return {
    messages,
    image: null,
    uiHint: isForSelf ? "show_offer_self" : "show_offer",
  };
}

function getDeclineGracefulClose(ctx: UpsellSessionContext): ScriptedMessage {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "I understand.",
        "Your prayer will still be placed at the Grotto. That's what matters most.",
        `God bless you, ${userName}. I'll be praying for you too.`,
      ],
      image: null,
      uiHint: "none",
      nextPhase: "complete",
    };
  }

  return {
    messages: [
      "I understand.",
      `${personName}'s prayer will still be placed at the Grotto. That's what matters most.`,
      `God bless you, ${userName}. I'll be praying for ${personName} too.`,
    ],
    image: null,
    uiHint: "none",
    nextPhase: "complete",
  };
}

function getDownsellMessages(ctx: UpsellSessionContext): ScriptedMessage {
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "I understand completely.",
        "Your prayer will still be carried to the Grotto — that I promise you.",
        "One small thing, if I may —",
        "Would you like us to light a candle for you at the Grotto?",
        "It burns among thousands, day and night. We'll send you a photo of it lit.",
      ],
      image: "candle_grotto",
      imageAfterMessage: 4, // Show candle after asking about lighting one
      uiHint: "show_candle_offer",
    };
  }

  return {
    messages: [
      "I understand completely.",
      `${personName}'s prayer will still be carried to the Grotto — that I promise you.`,
      "One small thing, if I may —",
      `Would you like us to light a candle for ${personName} at the Grotto?`,
      "It burns among thousands, day and night. We'll send you a photo of it lit.",
    ],
    image: "candle_grotto",
    imageAfterMessage: 4, // Show candle after asking about lighting one
    uiHint: "show_candle_offer",
  };
}

function getCandleAcceptanceMessages(ctx: UpsellSessionContext): ScriptedMessage {
  // Candle purchase shows thank you card
  return {
    messages: [],
    image: null,
    uiHint: "show_thank_you_candle",
    nextPhase: "complete",
  };
}

function getCandleDeclineMessages(ctx: UpsellSessionContext): ScriptedMessage {
  // Final decline shows thank you card for prayer only
  return {
    messages: [],
    image: null,
    uiHint: "show_thank_you_prayer",
    nextPhase: "complete",
  };
}

function getEarlyExitMessages(ctx: UpsellSessionContext): ScriptedMessage {
  // Early exit shows thank you card for prayer only
  return {
    messages: [],
    image: null,
    uiHint: "show_thank_you_prayer",
    nextPhase: "complete",
  };
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type UpsellAction =
  | "continue"      // User clicked "Yes, please" on transition
  | "go"            // User clicked "I need to go" on transition
  | "accept_medal"  // User accepted medal offer
  | "decline_medal" // User declined medal offer
  | "tell_me_more"  // User wants more info
  | "accept_candle" // User accepted candle downsell
  | "decline_candle"; // User declined candle downsell

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get the initial upsell messages for when confirmation page loads
 */
export function getInitialUpsellMessages(ctx: UpsellSessionContext): UpsellResponse {
  const scripted = getTransitionMessages(ctx);

  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: "transition",
    flags: ctx.flags,
  };
}

/**
 * Handle button actions in the upsell flow
 */
export function handleUpsellAction(
  ctx: UpsellSessionContext,
  action: UpsellAction
): UpsellResponse {
  let scripted: ScriptedMessage;
  let newPhase: UpsellPhase = ctx.phase;

  switch (action) {
    case "continue":
      // User wants to see more - set to introduction phase
      setUpsellFlag(ctx.upsellSessionId, "userEngaged", true);
      newPhase = "introduction";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getIntroductionMessages(ctx);
      break;

    case "go":
      // User needs to leave
      newPhase = "complete";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getEarlyExitMessages(ctx);
      break;

    case "accept_medal":
      setUpsellFlag(ctx.upsellSessionId, "userAccepted", true);
      newPhase = "handle_response";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getAcceptanceMessages(ctx);
      break;

    case "decline_medal":
      setUpsellFlag(ctx.upsellSessionId, "userDeclined", true);
      setUpsellFlag(ctx.upsellSessionId, "downsellShown", true);
      newPhase = "downsell";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getDownsellMessages(ctx);
      break;

    case "tell_me_more":
      newPhase = "tell_me_more";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getTellMeMoreMessages(ctx);
      break;

    case "accept_candle":
      setUpsellFlag(ctx.upsellSessionId, "userAccepted", true);
      setPurchaseType(ctx.upsellSessionId, "candle");
      newPhase = "complete";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getCandleAcceptanceMessages(ctx);
      break;

    case "decline_candle":
      // User declined everything - stays as prayer only
      newPhase = "complete";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getCandleDeclineMessages(ctx);
      break;

    default:
      // Default to graceful close
      newPhase = "complete";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getDeclineGracefulClose(ctx);
  }

  // DO NOT advance to nextPhase here - let the frontend call /advance to get next phase's messages
  // This ensures each phase's messages are actually shown

  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: newPhase,
    flags: ctx.flags,
  };
}

/**
 * Advance to the next phase in the auto-advance flow
 * Called after all messages in current phase have been shown
 */
export function advanceUpsellPhase(ctx: UpsellSessionContext): UpsellResponse {
  let scripted: ScriptedMessage;
  let newPhase: UpsellPhase = ctx.phase;
  const currentPhase = ctx.phase;

  switch (currentPhase) {
    case "introduction":
      newPhase = "show_front";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getShowFrontMessages(ctx);
      break;

    case "show_front":
      newPhase = "bernadette_story";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getBernadetteStoryMessages();
      break;

    case "bernadette_story":
      newPhase = "water_reveal";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getWaterRevealMessages(ctx);
      break;

    case "water_reveal":
      newPhase = "social_proof";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getSocialProofMessages(ctx);
      break;

    case "social_proof":
      newPhase = "the_giving";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      scripted = getTheGivingMessages(ctx);
      break;

    case "the_giving":
      newPhase = "the_ask";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      setUpsellFlag(ctx.upsellSessionId, "offerShown", true);
      scripted = getTheAskMessages(ctx);
      break;

    case "tell_me_more":
      // After tell me more, show the ask again
      newPhase = "the_ask";
      setUpsellPhase(ctx.upsellSessionId, newPhase);
      setUpsellFlag(ctx.upsellSessionId, "offerShown", true);
      scripted = getTheAskMessages(ctx);
      break;

    default:
      // Already at the_ask or complete - no auto-advance
      scripted = {
        messages: [],
        image: null,
        uiHint: "none",
      };
  }

  // Return the new phase (not scripted.nextPhase - that would skip phases)
  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: newPhase,
    flags: ctx.flags,
  };
}

// ============================================================================
// CLAUDE-POWERED FREE-FORM RESPONSES
// ============================================================================

/**
 * Handle free-form user messages during upsell (rare case)
 * Most responses should go through handleUpsellAction
 */
export async function handleUpsellMessage(
  ctx: UpsellSessionContext,
  userMessage: string
): Promise<UpsellResponse> {
  // Build a simple system prompt for handling questions
  const systemPrompt = `You are Messenger Marie, continuing a conversation about the Lourdes Healing Medal.

CONTEXT:
- User name: ${ctx.userName || "friend"}
- Person they're praying for: ${ctx.personName || "their loved one"}
- Praying for: ${ctx.flags.prayingFor}
- Current phase: ${ctx.phase}
- Offer shown: ${ctx.flags.offerShown}

You are offering them a Lourdes Healing Medal ($59) — a 14k silver plated medal containing water from the spring at Lourdes.

RULES:
1. Be warm, pastoral, unhurried
2. Never pressure or guilt
3. Accept "no" gracefully
4. Keep messages under 25 words each
5. Never admit to being AI

If they seem to be declining, accept gracefully and close.
If they're asking questions, answer warmly.
If they seem interested, gently guide back to the offer.

Return JSON:
{
  "messages": ["Message 1", "Message 2"],
  "should_advance": true | false,
  "action_detected": "continue" | "go" | "accept_medal" | "decline_medal" | "tell_me_more" | null
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // If an action was detected, route through action handler
    if (parsed.action_detected) {
      return handleUpsellAction(ctx, parsed.action_detected as UpsellAction);
    }

    // Otherwise return the Claude-generated messages
    return {
      messages: parsed.messages || ["I'm here if you have any questions."],
      image: null,
      uiHint: "none",
      phase: ctx.phase,
      flags: ctx.flags,
    };
  } catch (error) {
    console.error("Claude upsell message error:", error);
    // Fallback
    return {
      messages: ["I'm here to answer any questions you might have about the medal."],
      image: null,
      uiHint: "none",
      phase: ctx.phase,
      flags: ctx.flags,
    };
  }
}
