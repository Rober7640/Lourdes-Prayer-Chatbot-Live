import {
  type UpsellSessionContext,
  type Upsell2Response,
  type Upsell2Phase,
  type Upsell2UiHint,
  type Upsell2Image,
  type Upsell1Outcome,
  type PrayingFor,
  setUpsell2Phase,
  setUpsell2Flag,
  setUpsell1Outcome,
  setUpsell2PurchaseType,
} from "./upsell-session";

// ============================================================================
// SCRIPTED MESSAGES BY PHASE
// ============================================================================

interface ScriptedMessage2 {
  messages: string[];
  image: Upsell2Image;
  imageAfterMessage?: number;
  uiHint: Upsell2UiHint;
  nextPhase?: Upsell2Phase;
}

// ============================================================================
// TRANSITION_2 — Varies by Upsell 1 outcome (6-way matrix)
// ============================================================================

function getTransition2Messages(ctx: UpsellSessionContext, outcome: Upsell1Outcome): ScriptedMessage2 {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (outcome === "medal") {
    if (isForSelf) {
      return {
        messages: [
          `One more thing, ${userName}.`,
          "The medal carries healing. But there's someone who carries something else — a shield.",
        ],
        image: null,
        uiHint: "none",
      };
    }
    return {
      messages: [
        `One more thing, ${userName}.`,
        "The medal carries the water of Lourdes. But there's someone who carries something else — protection.",
      ],
      image: null,
      uiHint: "none",
    };
  }

  if (outcome === "candle") {
    if (isForSelf) {
      return {
        messages: [
          `One more thing, ${userName}.`,
          "The candle will burn for you at the Grotto. Day and night.",
          "But there's someone I want to tell you about.",
        ],
        image: null,
        uiHint: "none",
      };
    }
    return {
      messages: [
        `One more thing, ${userName}.`,
        `The candle will burn for ${personName} at the Grotto. Day and night.`,
        `But there's someone I think ${personName} should know about.`,
      ],
      image: null,
      uiHint: "none",
    };
  }

  // declined
  if (isForSelf) {
    return {
      messages: [
        `${userName} — before you go.`,
        "I'm not going to offer you anything else. I promise.",
        "But there's someone I always tell people about. Especially people carrying what you're carrying.",
      ],
      image: null,
      uiHint: "none",
    };
  }
  return {
    messages: [
      `${userName} — before you go.`,
      "I'm not going to offer you anything else. I promise.",
      "But there's someone I always tell people about before they leave. Someone who watches over the people we pray for.",
    ],
    image: null,
    uiHint: "none",
  };
}

// ============================================================================
// MICHAEL_STORY — 6 msgs + michael_pendant after msg 1
// ============================================================================

function getMichaelStoryMessages(ctx: UpsellSessionContext): ScriptedMessage2 {
  const isForSelf = ctx.flags.prayingFor === "self";

  const messages = [
    "This is Archangel Michael.",
    "His name means 'Who is like God?' It was a battle cry — the words he spoke when he stood against darkness itself.",
    "In Scripture, he is the protector. The one God sends when His people are under attack.",
    "He is the patron saint of the sick. Of soldiers. Of anyone facing a battle they didn't choose.",
    "People have prayed to Michael for two thousand years. Not for healing — for protection. For strength to endure what's coming.",
  ];

  if (isForSelf) {
    messages.push("For someone standing guard when you feel like you're facing this alone.");
  } else {
    messages.push("For someone standing guard when you can't be there.");
  }

  return {
    messages,
    image: "michael_pendant",
    imageAfterMessage: 1,
    uiHint: "none",
  };
}

// ============================================================================
// SHOW_PENDANT — 3 msgs + michael_pendant after msg 1
// ============================================================================

function getShowPendantMessages(): ScriptedMessage2 {
  return {
    messages: [
      "This is the Archangel Michael Pendant.",
      "Michael in full armor — sword raised, wings spread. Ready.",
      "On the back — the St. Michael Prayer. The same prayer Catholics have spoken for over a hundred years.",
    ],
    image: "michael_pendant",
    imageAfterMessage: 1,
    uiHint: "none",
  };
}

// ============================================================================
// PROTECTION — testimonial + situation bridge
// ============================================================================

function getProtectionMessages(ctx: UpsellSessionContext): ScriptedMessage2 {
  const isForSelf = ctx.flags.prayingFor === "self";
  const bucket = ctx.bucket || "";

  const messages: string[] = [];
  let image: Upsell2Image;

  // Testimonial
  if (isForSelf) {
    messages.push("This is Daniel. He wore the pendant through his treatment last year.");
    image = "testimonial_michael_self";
    messages.push("He told us:");
    messages.push('"I\'m not a very religious person. But holding it before each appointment — it reminded me that something bigger was fighting alongside me."');
  } else {
    messages.push("This is Maria. Her son was deployed overseas.");
    image = "testimonial_michael";
    messages.push("She told us:");
    messages.push('"I gave him the pendant before he left. He said he kept it in his chest pocket the whole time. He said it felt like I was still protecting him — even from thousands of miles away."');
  }

  // Situation-specific bridge
  const bridge = getSituationBridge(bucket, isForSelf);
  if (bridge) {
    messages.push(bridge);
  }

  return {
    messages,
    image,
    imageAfterMessage: 1,
    uiHint: "none",
  };
}

function getSituationBridge(bucket: string, isForSelf: boolean): string | null {
  switch (bucket) {
    case "healing_health":
      return isForSelf
        ? "When you're the one fighting — you need to know someone is standing guard."
        : "When someone you love is fighting for their health — you want someone standing guard over them.";
    case "grief":
      return isForSelf
        ? "Michael is also the angel who carries souls safely home. Many people find peace in knowing that."
        : "Michael is also the angel who guides souls to heaven. Many people find comfort in that.";
    case "protection":
      return isForSelf
        ? "You already know what it feels like to need protection. Michael has been doing that since the beginning."
        : "You already know what it means to want someone protected. Michael has been doing that since the beginning.";
    case "family_reconciliation":
      return "Families go through battles too. Michael doesn't just protect bodies — he protects the bonds between people.";
    case "guidance":
      return "When the path ahead isn't clear, Michael is the one who cuts through the darkness so you can see the next step.";
    default:
      // Generic fallback
      return isForSelf
        ? "When you're the one fighting — you need to know someone is standing guard."
        : "When someone you love is facing something hard — you want someone standing guard over them.";
  }
}

// ============================================================================
// THE_ASK_2 — 2 msgs, shows pendant offer card
// ============================================================================

function getTheAsk2Messages(ctx: UpsellSessionContext): ScriptedMessage2 {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        `I can send this to you, ${userName}.`,
        "Something to carry with you. A reminder that you're not fighting this alone.",
      ],
      image: null,
      uiHint: "show_pendant_offer_self",
    };
  }

  return {
    messages: [
      `I can send this to you — for ${personName}.`,
      "Something they can hold onto. A reminder that someone is watching over them.",
    ],
    image: null,
    uiHint: "show_pendant_offer",
  };
}

// ============================================================================
// ACCEPT_PENDANT — 3 msgs, shipping form or thank-you
// ============================================================================

function getAcceptPendantMessages(ctx: UpsellSessionContext): ScriptedMessage2 {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";
  const shippingCollected = ctx.upsell2Flags.shippingAlreadyCollected;

  const messages: string[] = [];

  if (isForSelf) {
    messages.push(`Thank you, ${userName}.`);
    messages.push("The pendant will arrive within 7-14 days. Something to carry with you through this.");
    messages.push("Michael will be watching over you.");
  } else {
    messages.push(`Thank you, ${userName}.`);
    messages.push(`The pendant will arrive within 7-14 days. Something to place in ${personName}'s hands — a protector to carry with them.`);
    messages.push(`Michael will be watching over ${personName}.`);
  }

  return {
    messages,
    image: null,
    uiHint: shippingCollected ? "show_thank_you_pendant" : "show_pendant_shipping_form",
  };
}

// ============================================================================
// DECLINE_PENDANT — 2 msgs, blessing close
// ============================================================================

function getDeclinePendantMessages(ctx: UpsellSessionContext): ScriptedMessage2 {
  const userName = ctx.userName || "friend";
  const personName = ctx.personName || "your loved one";
  const isForSelf = ctx.flags.prayingFor === "self";

  if (isForSelf) {
    return {
      messages: [
        "Of course.",
        `God bless you, ${userName}. You're in good hands — including His.`,
      ],
      image: null,
      uiHint: "show_thank_you_close",
    };
  }

  return {
    messages: [
      "Of course.",
      `God bless you, ${userName}. ${personName} is in good hands — including His.`,
    ],
    image: null,
    uiHint: "show_thank_you_close",
  };
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type Upsell2Action = "accept_pendant" | "decline_pendant";

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Start Upsell 2 flow — called when Upsell 1 completes
 */
export function startUpsell2(
  ctx: UpsellSessionContext,
  upsell1Outcome: Upsell1Outcome
): Upsell2Response {
  const id = ctx.upsellSessionId;

  // Set outcome and phase
  setUpsell1Outcome(id, upsell1Outcome);
  setUpsell2Phase(id, "transition_2");

  // If medal was purchased, shipping is already collected
  if (upsell1Outcome === "medal") {
    setUpsell2Flag(id, "shippingAlreadyCollected", true);
  }

  const scripted = getTransition2Messages(ctx, upsell1Outcome);

  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: "transition_2",
    upsell2Flags: ctx.upsell2Flags,
  };
}

/**
 * Advance to the next phase in the Upsell 2 auto-advance flow
 */
export function advanceUpsell2Phase(ctx: UpsellSessionContext): Upsell2Response {
  const id = ctx.upsellSessionId;
  let scripted: ScriptedMessage2;
  let newPhase: Upsell2Phase = ctx.upsell2Phase;

  switch (ctx.upsell2Phase) {
    case "transition_2":
      newPhase = "michael_story";
      setUpsell2Phase(id, newPhase);
      scripted = getMichaelStoryMessages(ctx);
      break;

    case "michael_story":
      newPhase = "show_pendant";
      setUpsell2Phase(id, newPhase);
      scripted = getShowPendantMessages();
      break;

    case "show_pendant":
      newPhase = "protection";
      setUpsell2Phase(id, newPhase);
      scripted = getProtectionMessages(ctx);
      break;

    case "protection":
      newPhase = "the_ask_2";
      setUpsell2Phase(id, newPhase);
      setUpsell2Flag(id, "pendantOfferShown", true);
      scripted = getTheAsk2Messages(ctx);
      break;

    default:
      // At the_ask_2 or complete_2 — no auto-advance
      scripted = {
        messages: [],
        image: null,
        uiHint: "none",
      };
  }

  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: newPhase,
    upsell2Flags: ctx.upsell2Flags,
  };
}

/**
 * Handle accept/decline actions for pendant
 */
export function handleUpsell2Action(
  ctx: UpsellSessionContext,
  action: Upsell2Action
): Upsell2Response {
  const id = ctx.upsellSessionId;
  let scripted: ScriptedMessage2;
  let newPhase: Upsell2Phase;

  switch (action) {
    case "accept_pendant":
      setUpsell2Flag(id, "pendantAccepted", true);
      newPhase = "handle_response_2";
      setUpsell2Phase(id, newPhase);
      scripted = getAcceptPendantMessages(ctx);
      break;

    case "decline_pendant":
      setUpsell2Flag(id, "pendantDeclined", true);
      newPhase = "complete_2";
      setUpsell2Phase(id, newPhase);
      scripted = getDeclinePendantMessages(ctx);
      break;

    default:
      newPhase = "complete_2";
      setUpsell2Phase(id, newPhase);
      scripted = getDeclinePendantMessages(ctx);
  }

  return {
    messages: scripted.messages,
    image: scripted.image,
    imageAfterMessage: scripted.imageAfterMessage,
    uiHint: scripted.uiHint,
    phase: newPhase,
    upsell2Flags: ctx.upsell2Flags,
  };
}
