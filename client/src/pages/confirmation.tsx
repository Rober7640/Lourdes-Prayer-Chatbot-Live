import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import {
  sleep,
  generateId,
  getCharacterDelay,
  calculatePauseBetweenMessages,
  calculateThinkingDelay,
} from "@/lib/typing";
import {
  trackPurchase,
  TIER_AMOUNTS,
} from "@/lib/fbTracking";

// Import upsell components
import UpsellImage from "@/components/upsell/UpsellImage";
import ContinueOrGoButtons from "@/components/upsell/ContinueOrGoButtons";
import MedalOfferCard from "@/components/upsell/MedalOfferCard";
import CandleOfferCard from "@/components/upsell/CandleOfferCard";
import ShippingForm, { type ShippingData } from "@/components/upsell/ShippingForm";
import ThankYouCard from "@/components/upsell/ThankYouCard";

// ============================================================================
// TYPES
// ============================================================================

type Role = "sm" | "user";

type UpsellUiHint =
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

type UpsellImage =
  | "medal_front"
  | "medal_back"
  | "bernadette_portrait"
  | "testimonial_medal"
  | "testimonial_medal_self"
  | "candle_grotto"
  | null;

type ThankYouVariant = "prayer" | "candle" | "medal";

type Upsell1Outcome = "medal" | "candle" | "declined";

type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "typing"; text: string; fullText: string }
  | { id: string; role: "sm"; kind: "image"; imageKey: string }
  | { id: string; role: "sm"; kind: "continue_or_go" }
  | { id: string; role: "sm"; kind: "medal_offer" }
  | { id: string; role: "sm"; kind: "candle_offer" }
  | { id: string; role: "sm"; kind: "shipping_form" }
  | { id: string; role: "sm"; kind: "thank_you"; variant: ThankYouVariant };

interface UpsellFlags {
  prayingFor: "self" | "other" | "both";
  userEngaged: boolean;
  offerShown: boolean;
  userAccepted: boolean;
  userDeclined: boolean;
  downsellShown: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function uid(prefix: string) {
  return `${prefix}_${generateId()}`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function AvatarSm() {
  return (
    <div
      className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-card-border bg-white/70 shadow-sm"
      aria-label="Messenger Marie"
    >
      <img
        src={sisterMariePortrait}
        alt="Messenger Marie"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function Bubble({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={[
        "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm",
        isUser
          ? "ml-auto bg-primary text-primary-foreground"
          : "bg-card/85 text-foreground border border-card-border backdrop-blur",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-card-border bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConfirmationPage() {
  // Get sessionId from URL params
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // Session state
  const [upsellSessionId, setUpsellSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("transition");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Context from prayer session
  const [userName, setUserName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [prayingFor, setPrayingFor] = useState<"self" | "other" | "both">("other");
  const [situation, setSituation] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [flags, setFlags] = useState<UpsellFlags | null>(null);

  // Chat state
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showThinkingDots, setShowThinkingDots] = useState(false);
  const [pendingImage, setPendingImage] = useState<UpsellImage>(null);
  const [pendingUiHint, setPendingUiHint] = useState<UpsellUiHint>("none");

  // Refs
  const isMountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-scroll when any content changes in the chat
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    };

    // Scroll on initial mount
    scrollToBottom();

    // Watch for any DOM changes (new messages, typing dots, cards, etc.)
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // ========================================================================
  // TYPING ANIMATION
  // ========================================================================

  const typeMessage = useCallback(
    async (fullText: string): Promise<void> => {
      const messageId = uid("sm");

      // Add complete message directly (WhatsApp style)
      setItems((prev) => [
        ...prev,
        { id: messageId, role: "sm", kind: "text", text: fullText },
      ]);
    },
    []
  );

  const renderMessages = useCallback(
    async (
      messages: string[],
      image: UpsellImage,
      uiHint: UpsellUiHint,
      imageAfterMessage?: number // 1-indexed: show image after this message
    ) => {
      if (!isMountedRef.current) return;

      setIsTyping(true);
      setShowThinkingDots(true);

      await sleep(calculateThinkingDelay());

      if (!isMountedRef.current) return;
      setShowThinkingDots(false);

      // Type out each message, inserting image at the right position
      for (let i = 0; i < messages.length; i++) {
        if (!isMountedRef.current) return;

        await typeMessage(messages[i]);

        // Check if image should appear after this message (1-indexed)
        if (image && imageAfterMessage && imageAfterMessage === i + 1) {
          await sleep(calculatePauseBetweenMessages(messages[i]));
          if (!isMountedRef.current) return;
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "image", imageKey: image },
          ]);
        }

        if (i < messages.length - 1) {
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages(messages[i]));
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);
        }
      }

      // Show image after all messages if no specific position set
      if (image && !imageAfterMessage) {
        await sleep(calculatePauseBetweenMessages(messages[messages.length - 1]));
        if (!isMountedRef.current) return;
        setItems((prev) => [
          ...prev,
          { id: uid("sm"), role: "sm", kind: "image", imageKey: image },
        ]);
      }

      // Handle UI hints after messages and image
      if (uiHint && uiHint !== "none") {
        await sleep(calculatePauseBetweenMessages(messages[messages.length - 1]));
        if (!isMountedRef.current) return;

        if (uiHint === "continue_or_go") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "continue_or_go" },
          ]);
        } else if (uiHint === "show_offer" || uiHint === "show_offer_self") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "medal_offer" },
          ]);
        } else if (uiHint === "show_candle_offer") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "candle_offer" },
          ]);
        } else if (uiHint === "show_shipping_form") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "shipping_form" },
          ]);
        } else if (uiHint === "show_thank_you_prayer") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "thank_you", variant: "prayer" },
          ]);
        } else if (uiHint === "show_thank_you_candle") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "thank_you", variant: "candle" },
          ]);
        } else if (uiHint === "show_thank_you_medal") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "thank_you", variant: "medal" },
          ]);
        }
      }

      setIsTyping(false);
    },
    [typeMessage]
  );

  // ========================================================================
  // API CALLS
  // ========================================================================

  // Initialize upsell session
  useEffect(() => {
    async function loadConfirmation() {
      if (!sessionId) {
        setError("Session ID is required");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Verify checkout session if arriving from Stripe redirect
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutSessionId = urlParams.get("checkout_session");
        if (checkoutSessionId) {
          try {
            const verifyRes = await fetch("/api/payment/verify-checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, checkoutSessionId }),
            });
            const verifyData = await verifyRes.json();
            // Fire client-side Purchase pixel event
            if (verifyData.paymentIntentId) {
              const amount = TIER_AMOUNTS[verifyData.tier] || 35;
              trackPurchase(verifyData.paymentIntentId, amount, "prayer_petition");
            }
          } catch (err) {
            console.error("Failed to verify checkout:", err);
          }
        }

        // Clean query params from URL (checkout_session, upsell, etc.)
        if (window.location.search) {
          window.history.replaceState({}, "", `/confirmation/${sessionId}`);
        }

        const res = await fetch(`/api/confirmation/${sessionId}`);

        if (!res.ok) {
          throw new Error("Failed to load confirmation page");
        }

        const data = await res.json();
        setUpsellSessionId(data.upsellSessionId);
        setPhase(data.phase);
        setUserName(data.userName);
        setPersonName(data.personName);
        setPrayingFor(data.prayingFor || "other");
        setSituation(data.situation || null);
        setUserEmail(data.userEmail || null);
        setFlags(data.flags);
        setIsLoading(false);

        // Render initial messages
        await renderMessages(data.messages, data.image, data.uiHint, data.imageAfterMessage);
      } catch (err) {
        console.error("Failed to load confirmation:", err);
        setError("Unable to load this page. Please try again.");
        setIsLoading(false);
      }
    }

    loadConfirmation();
  }, [sessionId, renderMessages]);

  // Handle action button clicks (Upsell 1)
  async function handleAction(action: string) {
    if (!upsellSessionId || isTyping) return;

    // Remove UI elements
    setItems((prev) => prev.filter((i) =>
      i.kind !== "continue_or_go" &&
      i.kind !== "medal_offer" &&
      i.kind !== "candle_offer"
    ));

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/upsell/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId, action }),
      });

      if (!res.ok) {
        throw new Error("Failed to process action");
      }

      const data = await res.json();
      setPhase(data.phase);
      setFlags(data.flags);
      setShowThinkingDots(false);

      // For candle acceptance, process payment then start Upsell 2
      if (action === "accept_candle") {
        await processCandlePayment();
        return;
      }

      // For "go" (early exit), render closing messages then redirect to thank-you page
      if (action === "go") {
        await renderMessages(data.messages, data.image, "none", data.imageAfterMessage);
        await sleep(2000);
        window.location.href = `/thank-you/${sessionId}`;
        return;
      }

      // For decline_candle: skip the prayer thank-you, redirect to pendant page instead
      if (action === "decline_candle") {
        // Don't render the default decline messages/thank-you
        // Redirect to pendant page (Upsell 2)
        window.location.href = `/confirm-pendant/${sessionId}?outcome=declined`;
        return;
      }

      await renderMessages(data.messages, data.image, data.uiHint, data.imageAfterMessage);

      // Auto-advance if uiHint is "none" and not at terminal phase
      if (data.uiHint === "none" && data.phase !== "complete" && data.phase !== "the_ask") {
        await advancePhase();
      }
    } catch (err) {
      console.error("Action error:", err);
      setShowThinkingDots(false);
      await renderMessages(
        ["I apologize — something went wrong. Please try again."],
        null,
        "none",
        undefined
      );
    }
  }

  // Process candle payment via one-click or checkout fallback
  async function processCandlePayment() {
    if (!upsellSessionId) return;

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/upsell/candle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to process candle payment");
      }

      const data = await res.json();
      setShowThinkingDots(false);

      // If one-click failed and checkout is required, redirect to Stripe
      if (data.requiresCheckout && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Redirect to pendant page (Upsell 2) after candle purchase
      await sleep(1000);
      window.location.href = `/confirm-pendant/${sessionId}?outcome=candle`;
    } catch (err) {
      console.error("Candle payment error:", err);
      setShowThinkingDots(false);
      await renderMessages(
        ["I apologize — there was a problem processing your order. Please try again."],
        null,
        "none",
        undefined
      );
    }
  }

  // Auto-advance to next phase
  async function advancePhase() {
    if (!upsellSessionId || isTyping) return;

    try {
      // Small delay before advancing
      await sleep(800);
      if (!isMountedRef.current) return;

      const res = await fetch("/api/upsell/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to advance phase");
      }

      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setPhase(data.phase);
        setFlags(data.flags);
        await renderMessages(data.messages, data.image, data.uiHint, data.imageAfterMessage);

        // Continue auto-advancing if appropriate
        if (data.uiHint === "none" && data.phase !== "complete" && data.phase !== "the_ask") {
          await advancePhase();
        }
      }
    } catch (err) {
      console.error("Advance error:", err);
    }
  }

  // Handle shipping form submission (medal)
  async function handleShippingSubmit(shipping: ShippingData) {
    if (!upsellSessionId || isTyping) return;

    try {
      const res = await fetch("/api/upsell/medal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId, shipping }),
      });

      if (!res.ok) {
        throw new Error("Failed to process order");
      }

      const data = await res.json();

      // If one-click failed and checkout is required, redirect to Stripe
      if (data.requiresCheckout && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // One-click success — remove shipping form and redirect to pendant page
      setItems((prev) => prev.filter((i) => i.kind !== "shipping_form"));

      // Redirect to pendant page (Upsell 2) after medal purchase
      await sleep(1000);
      window.location.href = `/confirm-pendant/${sessionId}?outcome=medal`;
    } catch (err) {
      console.error("Shipping submit error:", err);
      await renderMessages(
        ["I apologize — there was a problem processing your order. Please try again."],
        null,
        "show_shipping_form",
        undefined
      );
    }
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  const isForSelf = prayingFor === "self";
  const displayPersonName = personName || "your loved one";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex h-screen w-full max-w-2xl flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-card-border bg-background/70 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-muted-foreground hover:bg-secondary">
                <ArrowLeft className="h-4 w-4" />
                Back
              </a>
            </Link>

            <div className="flex items-center gap-2">
              <img src={grottoMark} alt="" className="h-6 w-6" />
              <div className="text-sm font-semibold">Messenger Marie</div>
            </div>

            <div className="h-8 w-16" aria-hidden="true" />
          </div>
        </header>

        {/* Chat Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-auto px-4 pb-8 pt-6"
        >
          {isLoading && items.length === 0 ? (
            <div className="flex items-end gap-3">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : (
            items.map((it) => {
              const isSm = it.role === "sm";

              // Typing bubble
              if (it.kind === "typing") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Bubble role="sm">
                      <span>{it.text}</span>
                    </Bubble>
                  </div>
                );
              }

              // Image
              if (it.kind === "image") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <UpsellImage imageKey={it.imageKey} />
                  </div>
                );
              }

              // Continue or Go buttons
              if (it.kind === "continue_or_go") {
                return (
                  <div key={it.id} className="flex items-end gap-3 pl-13">
                    <ContinueOrGoButtons
                      onContinue={() => handleAction("continue")}
                      onGo={() => handleAction("go")}
                      disabled={isTyping}
                    />
                  </div>
                );
              }

              // Medal offer card
              if (it.kind === "medal_offer") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <MedalOfferCard
                      personName={displayPersonName}
                      isForSelf={isForSelf}
                      onAccept={() => handleAction("accept_medal")}
                      onTellMeMore={() => handleAction("tell_me_more")}
                      onDecline={() => handleAction("decline_medal")}
                      disabled={isTyping}
                    />
                  </div>
                );
              }

              // Candle offer card
              if (it.kind === "candle_offer") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <CandleOfferCard
                      personName={displayPersonName}
                      isForSelf={isForSelf}
                      onAccept={() => handleAction("accept_candle")}
                      onDecline={() => handleAction("decline_candle")}
                      disabled={isTyping}
                    />
                  </div>
                );
              }

              // Shipping form (medal)
              if (it.kind === "shipping_form") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <ShippingForm
                      onSubmit={handleShippingSubmit}
                      disabled={isTyping}
                    />
                  </div>
                );
              }

              // Thank you card
              if (it.kind === "thank_you") {
                return (
                  <div key={it.id} className="w-full flex justify-center px-2">
                    <ThankYouCard
                      variant={it.variant}
                      personName={displayPersonName}
                      isForSelf={isForSelf}
                      situation={situation || undefined}
                      userEmail={userEmail || undefined}
                      onReturnHome={() => window.location.href = "/"}
                    />
                  </div>
                );
              }

              // Text bubble (with smooth fade-in animation)
              return (
                <div
                  key={it.id}
                  className={isSm ? "flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300" : "flex animate-in fade-in slide-in-from-bottom-2 duration-300"}
                >
                  {isSm ? <AvatarSm /> : null}
                  <Bubble role={it.role}>
                    <span>{it.text}</span>
                  </Bubble>
                </div>
              );
            })
          )}

          {/* Thinking dots */}
          {showThinkingDots && !isLoading ? (
            <div className="flex items-end gap-3">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
