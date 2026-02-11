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

// Import upsell components
import UpsellImage from "@/components/upsell/UpsellImage";
import PendantOfferCard from "@/components/upsell/PendantOfferCard";
import ShippingForm, { type ShippingData } from "@/components/upsell/ShippingForm";
import ThankYouCard from "@/components/upsell/ThankYouCard";

// ============================================================================
// TYPES
// ============================================================================

type Role = "sm" | "user";

type UpsellUiHint =
  | "none"
  | "show_pendant_offer"
  | "show_pendant_offer_self"
  | "show_pendant_shipping_form"
  | "show_thank_you_pendant"
  | "show_thank_you_close";

type UpsellImage =
  | "michael_pendant"
  | "st_michael_archangel"
  | "testimonial_michael"
  | "testimonial_michael_self"
  | null;

type ThankYouVariant = "pendant" | "close";

type Upsell1Outcome = "medal" | "candle" | "declined";

type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "typing"; text: string; fullText: string }
  | { id: string; role: "sm"; kind: "image"; imageKey: string }
  | { id: string; role: "sm"; kind: "pendant_offer" }
  | { id: string; role: "sm"; kind: "pendant_shipping_form" }
  | { id: string; role: "sm"; kind: "thank_you"; variant: ThankYouVariant };

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

export default function ConfirmPendantPage() {
  // Get sessionId from URL params
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // Session state
  const [upsellSessionId, setUpsellSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("transition_2");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Context from prayer session
  const [userName, setUserName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [prayingFor, setPrayingFor] = useState<"self" | "other" | "both">("other");
  const [situation, setSituation] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Chat state
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showThinkingDots, setShowThinkingDots] = useState(false);

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

  // Auto-scroll when items change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items, showThinkingDots]);

  // ========================================================================
  // TYPING ANIMATION
  // ========================================================================

  const typeMessage = useCallback(
    async (fullText: string): Promise<void> => {
      const messageId = uid("sm");

      setItems((prev) => [
        ...prev,
        { id: messageId, role: "sm", kind: "typing", text: "", fullText },
      ]);

      for (let i = 0; i <= fullText.length; i++) {
        if (!isMountedRef.current) return;

        const partialText = fullText.slice(0, i);

        setItems((prev) =>
          prev.map((item) =>
            item.id === messageId && item.kind === "typing"
              ? { ...item, text: partialText }
              : item
          )
        );

        if (i < fullText.length) {
          await sleep(getCharacterDelay());
        }
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { id: messageId, role: "sm" as const, kind: "text" as const, text: fullText }
            : item
        )
      );
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
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "image", imageKey: image },
          ]);
        }

        if (i < messages.length - 1) {
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);
        }
      }

      // Show image after all messages if no specific position set
      if (image && !imageAfterMessage) {
        await sleep(calculatePauseBetweenMessages());
        if (!isMountedRef.current) return;
        setItems((prev) => [
          ...prev,
          { id: uid("sm"), role: "sm", kind: "image", imageKey: image },
        ]);
      }

      // Handle UI hints after messages and image
      if (uiHint && uiHint !== "none") {
        await sleep(calculatePauseBetweenMessages());
        if (!isMountedRef.current) return;

        if (uiHint === "show_pendant_offer" || uiHint === "show_pendant_offer_self") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "pendant_offer" },
          ]);
        } else if (uiHint === "show_pendant_shipping_form") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "pendant_shipping_form" },
          ]);
        } else if (uiHint === "show_thank_you_pendant") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "thank_you", variant: "pendant" },
          ]);
        } else if (uiHint === "show_thank_you_close") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "thank_you", variant: "close" },
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

  // Initialize pendant page - start upsell 2
  useEffect(() => {
    async function loadPendantPage() {
      if (!sessionId) {
        setError("Session ID is required");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Get the upsell session and context
        const sessionRes = await fetch(`/api/confirmation/${sessionId}`);
        if (!sessionRes.ok) {
          throw new Error("Failed to load session");
        }

        const sessionData = await sessionRes.json();
        setUpsellSessionId(sessionData.upsellSessionId);
        setUserName(sessionData.userName);
        setPersonName(sessionData.personName);
        setPrayingFor(sessionData.prayingFor || "other");
        setSituation(sessionData.situation || null);
        setUserEmail(sessionData.userEmail || null);

        // Determine upsell 1 outcome from URL or session
        const urlParams = new URLSearchParams(window.location.search);
        const outcome = (urlParams.get("outcome") || "declined") as Upsell1Outcome;

        // Clean query params from URL
        if (window.location.search) {
          window.history.replaceState({}, "", `/confirm-pendant/${sessionId}`);
        }

        // Start upsell 2
        const upsell2Res = await fetch("/api/upsell2/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upsellSessionId: sessionData.upsellSessionId,
            upsell1Outcome: outcome,
          }),
        });

        if (!upsell2Res.ok) {
          throw new Error("Failed to start upsell 2");
        }

        const upsell2Data = await upsell2Res.json();
        setPhase(upsell2Data.phase);
        setIsLoading(false);

        // Render initial messages
        await renderMessages(
          upsell2Data.messages,
          upsell2Data.image,
          upsell2Data.uiHint,
          upsell2Data.imageAfterMessage
        );

        // Auto-advance if needed
        if (upsell2Data.uiHint === "none" && upsell2Data.phase !== "complete_2" && upsell2Data.phase !== "the_ask_2") {
          await advanceUpsell2();
        }
      } catch (err) {
        console.error("Failed to load pendant page:", err);
        setError("Unable to load this page. Please try again.");
        setIsLoading(false);
      }
    }

    loadPendantPage();
  }, [sessionId, renderMessages]);

  // Auto-advance Upsell 2 to next phase
  async function advanceUpsell2() {
    if (!upsellSessionId) return;

    try {
      await sleep(800);
      if (!isMountedRef.current) return;

      const res = await fetch("/api/upsell2/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to advance upsell 2 phase");
      }

      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setPhase(data.phase);
        await renderMessages(data.messages, data.image, data.uiHint, data.imageAfterMessage);

        // Continue auto-advancing if appropriate
        if (data.uiHint === "none" && data.phase !== "complete_2" && data.phase !== "the_ask_2") {
          await advanceUpsell2();
        }
      }
    } catch (err) {
      console.error("Upsell 2 advance error:", err);
    }
  }

  // Handle pendant actions (accept/decline)
  async function handlePendantAction(action: "accept_pendant" | "decline_pendant") {
    if (!upsellSessionId || isTyping) return;

    // Remove pendant offer card
    setItems((prev) => prev.filter((i) => i.kind !== "pendant_offer"));

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/upsell2/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellSessionId, action }),
      });

      if (!res.ok) {
        throw new Error("Failed to process pendant action");
      }

      const data = await res.json();
      setPhase(data.phase);
      setShowThinkingDots(false);

      // For accept_pendant with shipping already collected, process payment immediately
      if (action === "accept_pendant" && data.uiHint === "show_thank_you_pendant") {
        await renderMessages(data.messages, data.image, "none", data.imageAfterMessage);
        await processPendantPayment();
        return;
      }

      await renderMessages(data.messages, data.image, data.uiHint, data.imageAfterMessage);
    } catch (err) {
      console.error("Pendant action error:", err);
      setShowThinkingDots(false);
      await renderMessages(
        ["I apologize — something went wrong. Please try again."],
        null,
        "none",
        undefined
      );
    }
  }

  // Process pendant payment (one-click or checkout fallback)
  async function processPendantPayment(shipping?: ShippingData) {
    if (!upsellSessionId) return;

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/upsell2/pendant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upsellSessionId,
          ...(shipping ? { shipping } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to process pendant payment");
      }

      const data = await res.json();
      setShowThinkingDots(false);

      // If one-click failed and checkout is required, redirect to Stripe
      if (data.requiresCheckout && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // One-click success — remove pendant shipping form and show thank you
      setItems((prev) => prev.filter((i) => i.kind !== "pendant_shipping_form"));

      if (data.uiHint === "show_thank_you_pendant") {
        setItems((prev) => [
          ...prev,
          { id: uid("sm"), role: "sm", kind: "thank_you", variant: "pendant" as ThankYouVariant },
        ]);
      }

      setPhase("complete_2");
    } catch (err) {
      console.error("Pendant payment error:", err);
      setShowThinkingDots(false);
      await renderMessages(
        ["I apologize — there was a problem processing your order. Please try again."],
        null,
        "none",
        undefined
      );
    }
  }

  // Handle pendant shipping form submission
  async function handlePendantShippingSubmit(shipping: ShippingData) {
    if (!upsellSessionId || isTyping) return;
    await processPendantPayment(shipping);
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
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
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
                      <span className="inline-block w-0.5 h-4 bg-foreground/60 ml-0.5 animate-pulse" />
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

              // Pendant offer card
              if (it.kind === "pendant_offer") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <PendantOfferCard
                      personName={displayPersonName}
                      isForSelf={isForSelf}
                      onAccept={() => handlePendantAction("accept_pendant")}
                      onDecline={() => handlePendantAction("decline_pendant")}
                      disabled={isTyping}
                    />
                  </div>
                );
              }

              // Pendant shipping form
              if (it.kind === "pendant_shipping_form") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <ShippingForm
                      onSubmit={handlePendantShippingSubmit}
                      disabled={isTyping}
                      price="$49"
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

              // Text bubble
              return (
                <div
                  key={it.id}
                  className={isSm ? "flex items-end gap-3" : "flex"}
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
