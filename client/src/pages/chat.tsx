import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { Link } from "wouter";
import {
  sleep,
  generateId,
  getCharacterDelay,
  calculatePauseBetweenMessages,
  calculateThinkingDelay,
} from "@/lib/typing";

// ============================================================================
// TYPES
// ============================================================================

type Role = "sm" | "user";

type BucketId =
  | "family_reconciliation"
  | "healing_health"
  | "protection"
  | "grief"
  | "guidance";

type Bucket = {
  id: BucketId;
  emoji: string;
  label: string;
};

type UiHint =
  | "none"
  | "show_buckets"
  | "show_petition_photo"
  | "show_payment"
  | "show_upsell"
  | "show_candle"
  | "show_email_input";

type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "typing"; text: string; fullText: string }
  | { id: string; role: "sm"; kind: "buckets" }
  | { id: string; role: "sm"; kind: "email" }
  | { id: string; role: "sm"; kind: "image"; src: string; alt: string; caption?: string }
  | { id: string; role: "sm"; kind: "payment" };

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
      aria-label="Sister Marie"
    >
      <img
        src={sisterMariePortrait}
        alt="Sister Marie"
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
// BUCKET DATA
// ============================================================================

const buckets: Bucket[] = [
  { id: "family_reconciliation", emoji: "🕊️", label: "A Family Wound" },
  { id: "healing_health", emoji: "💚", label: "Healing for Someone ill" },
  { id: "protection", emoji: "🛡️", label: "Protection for a Loved One" },
  { id: "grief", emoji: "🕯️", label: "Grief or Loss" },
  { id: "guidance", emoji: "🙏", label: "Guidance in a Difficult Season" },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChatPage() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("welcome");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showThinkingDots, setShowThinkingDots] = useState(false);
  const [composer, setComposer] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [personName, setPersonName] = useState<string | null>(null);
  const [softClosed, setSoftClosed] = useState(false);

  // Ref to track if component is mounted (for async operations)
  const isMountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paymentIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (paymentIdleTimerRef.current) {
        clearTimeout(paymentIdleTimerRef.current);
      }
    };
  }, []);

  // Save session to localStorage for resume
  const saveSessionToStorage = useCallback(() => {
    if (!sessionId) return;
    const sessionData = {
      sessionId,
      personName,
      phase,
      items: items.filter(i => i.kind === "text"), // Save only text items
      savedAt: Date.now(),
    };
    localStorage.setItem("lourdes_saved_session", JSON.stringify(sessionData));
  }, [sessionId, personName, phase, items]);

  // Soft close after 5 minutes of idle at payment
  const handleSoftClose = useCallback(async () => {
    if (!isMountedRef.current || softClosed) return;
    setSoftClosed(true);

    // Save session
    saveSessionToStorage();

    // Show soft close messages
    const name = personName || "your loved one";
    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "text", text: "I understand if now isn't the right time." },
    ]);
    await sleep(1500);
    if (!isMountedRef.current) return;

    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "text", text: `Your prayer for ${name} is saved. You can return anytime, or check your email.` },
    ]);
    await sleep(1500);
    if (!isMountedRef.current) return;

    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "text", text: "May God bless you. I'll be here when you're ready." },
    ]);
  }, [personName, softClosed, saveSessionToStorage]);

  // Start idle timer when payment card is shown
  useEffect(() => {
    const hasPaymentCard = items.some(i => i.kind === "payment");

    if (hasPaymentCard && !softClosed) {
      // Clear any existing timer
      if (paymentIdleTimerRef.current) {
        clearTimeout(paymentIdleTimerRef.current);
      }
      // Start 5-minute timer
      paymentIdleTimerRef.current = setTimeout(() => {
        handleSoftClose();
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (paymentIdleTimerRef.current) {
        clearTimeout(paymentIdleTimerRef.current);
      }
    };
  }, [items, softClosed, handleSoftClose]);

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

  // Type out a single message character by character
  const typeMessage = useCallback(
    async (fullText: string): Promise<void> => {
      const messageId = uid("sm");

      // Add empty typing bubble
      setItems((prev) => [
        ...prev,
        { id: messageId, role: "sm", kind: "typing", text: "", fullText },
      ]);

      // Type each character
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

      // Convert typing bubble to final text bubble
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

  // Render multiple messages with typing animation
  const renderMessages = useCallback(
    async (messages: string[], uiHint?: UiHint) => {
      if (!isMountedRef.current) return;

      setIsTyping(true);
      setShowThinkingDots(true);

      // Initial thinking delay
      await sleep(calculateThinkingDelay());

      if (!isMountedRef.current) return;
      setShowThinkingDots(false);

      // Process each message (backend already chunks to ~25 words)
      for (let i = 0; i < messages.length; i++) {
        if (!isMountedRef.current) return;

        await typeMessage(messages[i]);

        // Pause between messages
        if (i < messages.length - 1) {
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);
        }
      }

      // Handle UI hints
      if (uiHint && uiHint !== "none") {
        await sleep(calculatePauseBetweenMessages());
        if (!isMountedRef.current) return;

        if (uiHint === "show_buckets") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "buckets" },
          ]);
        } else if (uiHint === "show_email_input") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "email" },
          ]);
        } else if (uiHint === "show_petition_photo") {
          // Show petition box photo
          setItems((prev) => [
            ...prev,
            {
              id: uid("sm"),
              role: "sm",
              kind: "image",
              src: "/petition-box.jpg",
              alt: "Prayer petition box at the Lourdes Grotto",
              caption: "The petition box at the Grotto of Lourdes"
            },
          ]);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          // Continue with remaining explanation
          await typeMessage("You'll receive photos of your prayer at the holy site, sent directly to your email after our visit.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          await typeMessage("Our team lovingly hand-delivers each prayer to the Grotto. We only ask for a small amount to help cover the time, care, and materials involved.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          await typeMessage("The full cost to provide this sacred service is $35 per prayer.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          await typeMessage("If you're facing financial hardship, you're still welcome to participate — choose the amount that's right for you.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          await typeMessage("If you're able, consider giving more to help cover the cost for others who cannot.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          await typeMessage("Every amount helps us bring more prayers to Lourdes — as one Body in Christ.");
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;

          // Show payment card
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "payment" },
          ]);
        } else if (uiHint === "show_payment") {
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "payment" },
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

  // Initialize chat session
  useEffect(() => {
    async function startChat() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/chat/start", { method: "POST" });

        if (!res.ok) {
          throw new Error("Failed to start chat");
        }

        const data = await res.json();
        setSessionId(data.sessionId);
        setPhase(data.phase);
        setIsLoading(false);

        // Render welcome messages with typing
        await renderMessages(data.messages, data.uiHint);
      } catch (err) {
        console.error("Failed to start chat:", err);
        setError("Unable to connect to Sister Marie. Please try again.");
        setIsLoading(false);
      }
    }

    startChat();
  }, [renderMessages]);

  // Handle bucket selection
  async function handleBucketPick(bucket: Bucket) {
    if (!sessionId || isTyping) return;

    // Remove buckets from UI
    setItems((prev) => prev.filter((i) => i.kind !== "buckets"));

    // Add user's selection as a message
    setItems((prev) => [
      ...prev,
      { id: uid("user"), role: "user", kind: "text", text: bucket.label },
    ]);

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/chat/bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, bucket: bucket.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to process bucket selection");
      }

      const data = await res.json();
      setPhase(data.phase);
      setShowThinkingDots(false);

      // Render response messages
      await renderMessages(data.messages, data.uiHint);
    } catch (err) {
      console.error("Bucket selection error:", err);
      setShowThinkingDots(false);
      await renderMessages([
        "Oh my, I seem to have lost my train of thought for a moment.",
        "Would you mind selecting that again, dear?",
      ]);
    }
  }

  // Handle email submission
  async function handleEmailSubmit() {
    if (!emailInput.trim() || !sessionId || isSubmittingEmail || isTyping) return;

    const email = emailInput.trim();

    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await renderMessages([
        "Hmm, that doesn't look quite right.",
        "Could you check the email address and try again?",
      ]);
      return;
    }

    setIsSubmittingEmail(true);

    // Remove email input from UI
    setItems((prev) => prev.filter((i) => i.kind !== "email"));

    // Show email as user message
    setItems((prev) => [
      ...prev,
      { id: uid("user"), role: "user", kind: "text", text: email },
    ]);

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/chat/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit email");
      }

      const data = await res.json();
      setShowThinkingDots(false);
      setEmailInput("");

      // Render response messages
      await renderMessages(data.messages, data.uiHint);
    } catch (err) {
      console.error("Email submission error:", err);
      setShowThinkingDots(false);
      await renderMessages([
        "I had trouble saving that. Could you try entering your email again?",
      ]);
      // Re-add email input
      setItems((prev) => [
        ...prev,
        { id: uid("sm"), role: "sm", kind: "email" },
      ]);
    } finally {
      setIsSubmittingEmail(false);
    }
  }

  // Handle sending a message
  async function handleSend() {
    const text = composer.trim();
    if (!text || !sessionId || isSending || isTyping) return;

    // Add user message
    setItems((prev) => [
      ...prev,
      { id: uid("user"), role: "user", kind: "text", text },
    ]);
    setComposer("");
    setIsSending(true);

    try {
      setShowThinkingDots(true);
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const data = await res.json();
      if (data.phase) {
        setPhase(data.phase);
      }
      // Extract personName if available
      if (data.extracted?.personName) {
        setPersonName(data.extracted.personName);
      }
      // Reset idle timer on user interaction
      if (paymentIdleTimerRef.current) {
        clearTimeout(paymentIdleTimerRef.current);
        paymentIdleTimerRef.current = null;
      }
      setShowThinkingDots(false);

      // Render response messages
      await renderMessages(data.messages, data.uiHint);

      // If ready for payment but no photo/payment hint, use legacy transition
      // (This should rarely happen now that Claude handles the flow)
      if (data.flags?.readyForPayment && data.uiHint !== "show_payment" && data.uiHint !== "show_petition_photo") {
        await sleep(1000);
        await transitionToPayment();
      }
    } catch (err) {
      console.error("Message send error:", err);
      setShowThinkingDots(false);
      await renderMessages([
        "Forgive me, dear — I didn't quite catch that.",
        "Would you mind sharing that with me once more?",
      ]);
    } finally {
      setIsSending(false);
    }
  }

  // Transition to payment phase
  async function transitionToPayment() {
    if (!sessionId) return;

    try {
      const res = await fetch("/api/chat/payment-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to transition to payment");
      }

      const data = await res.json();
      setPhase(data.phase);

      await renderMessages(data.messages, data.uiHint);
    } catch (err) {
      console.error("Payment transition error:", err);
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
              <div className="text-sm font-semibold">Sister Marie</div>
            </div>

            <div className="h-8 w-16" aria-hidden="true" />
          </div>
        </header>

        {/* Chat Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-auto px-4 pb-28 pt-6"
        >
          {isLoading && items.length === 0 ? (
            <div className="flex items-end gap-3">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : (
            items.map((it, idx) => {
              const isSm = it.role === "sm";

              // Typing bubble (character by character)
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

              // Bucket selection
              if (it.kind === "buckets") {
                return (
                  <div key={it.id} className="space-y-3 pl-13">
                    <div className="grid gap-2">
                      {buckets.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBucketPick(b)}
                          disabled={isTyping || isSending}
                          className="w-full rounded-2xl border border-card-border bg-card/80 px-4 py-3 text-left shadow-sm transition hover:bg-card disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                              <span aria-hidden="true">{b.emoji}</span>
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {b.label}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Email capture card
              if (it.kind === "email") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-4 shadow-sm backdrop-blur">
                      <div className="text-sm font-semibold text-foreground">
                        Stay connected
                      </div>
                      <div className="mt-2 grid gap-2">
                        <Input
                          placeholder="Email address"
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEmailSubmit();
                            }
                          }}
                          className="h-11 rounded-xl"
                          disabled={isSubmittingEmail}
                        />
                        <Button
                          className="h-11 rounded-xl"
                          onClick={handleEmailSubmit}
                          disabled={isSubmittingEmail || !emailInput.trim()}
                        >
                          {isSubmittingEmail ? "Saving..." : "Continue"}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          🔒 Your email is kept private and never shared.
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Image card (e.g., petition box photo)
              if (it.kind === "image") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <div className="max-w-[85%] rounded-2xl overflow-hidden border border-card-border bg-card/85 shadow-sm">
                      <img
                        src={it.src}
                        alt={it.alt}
                        className="w-full max-w-[400px] h-auto"
                      />
                      {it.caption && (
                        <div className="px-4 py-2 text-sm text-muted-foreground italic">
                          {it.caption}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Payment tiers card
              if (it.kind === "payment") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
                      <div className="text-base font-semibold text-foreground mb-4">
                        Select your level of support
                      </div>

                      <div className="space-y-3">
                        {/* $28 Tier */}
                        <div className="rounded-xl border border-card-border bg-card/50 p-4">
                          <div className="font-semibold text-foreground mb-2">$28 – I Need a Little Help</div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            "Please carry my prayer to Lourdes. I'm unable to cover the full cost at this time, but I still want to take part in this sacred act."
                          </p>
                          <button className="w-full rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2.5 px-4 text-sm font-medium transition">
                            Include my Prayer for $28
                          </button>
                        </div>

                        {/* $35 Tier - Primary */}
                        <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                          <div className="font-semibold text-foreground mb-2">$35 – Cover My Prayer Delivery</div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            "I'm covering the full cost to bring my prayer to the Grotto. Thank you for making this possible."
                          </p>
                          <button className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 text-sm font-medium transition">
                            Full Prayer Delivery for $35
                          </button>
                        </div>

                        {/* $55 Tier */}
                        <div className="rounded-xl border border-card-border bg-card/50 p-4">
                          <div className="font-semibold text-foreground mb-2">$55 – Carry My Prayer + Lift Another</div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            "I'm offering a bit more to help someone else who may be struggling. May my prayer and my gift bring blessings to others in need."
                          </p>
                          <button className="w-full rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2.5 px-4 text-sm font-medium transition">
                            Send and Support Service for $55
                          </button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Text bubble (completed message)
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

          {/* Thinking dots (shown between messages) */}
          {showThinkingDots && !isLoading ? (
            <div className="flex items-end gap-3">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : null}
        </div>

        {/* Composer */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-card-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3">
            <Input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Type a message…"
              className="h-11 rounded-xl"
              disabled={isTyping || isSending || isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              className="h-11 w-11 rounded-xl px-0"
              onClick={handleSend}
              disabled={!composer.trim() || isTyping || isSending || isLoading}
              aria-label="Send"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
