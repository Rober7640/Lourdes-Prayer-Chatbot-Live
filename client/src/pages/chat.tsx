import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { Link } from "wouter";

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
  | "show_payment"
  | "show_upsell"
  | "show_candle"
  | "show_email_input";

type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "buckets" }
  | {
      id: string;
      role: "sm";
      kind: "quick";
      question: string;
      options: { id: string; label: string }[];
    }
  | { id: string; role: "sm"; kind: "email" }
  | { id: string; role: "sm"; kind: "payment" };

// ============================================================================
// HELPERS
// ============================================================================

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

// Delay helper for message rendering
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate delay based on message length (100ms per word, min 800ms, max 2500ms)
function getMessageDelay(message: string): number {
  const wordCount = message.split(" ").length;
  return Math.min(Math.max(wordCount * 100, 800), 2500);
}

// ============================================================================
// COMPONENTS
// ============================================================================

function AvatarSm() {
  return (
    <div
      className="h-10 w-10 overflow-hidden rounded-full border border-card-border bg-white/70 shadow-sm"
      data-testid="img-sm-avatar"
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
      data-testid={isUser ? "bubble-user" : "bubble-sm"}
    >
      {children}
    </div>
  );
}

function TypingDots() {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-card-border bg-card/85 px-4 py-3 shadow-sm backdrop-blur"
      data-testid="typing-indicator"
    >
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
  { id: "healing_health", emoji: "💚", label: "Healing for Someone Ill" },
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
  const [composer, setComposer] = useState("");
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when items change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items, isTyping]);

  // Check if buckets are currently shown
  const hasBuckets = useMemo(
    () => items.some((i) => i.kind === "buckets"),
    [items]
  );

  // ========================================================================
  // MESSAGE RENDERING
  // ========================================================================

  // Render messages with typing delays
  const renderMessages = useCallback(
    async (messages: string[], uiHint?: UiHint) => {
      setIsTyping(true);

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        // Wait before showing message (simulates typing)
        await delay(getMessageDelay(msg));

        // Add message
        setItems((prev) => [
          ...prev,
          { id: uid("sm"), role: "sm", kind: "text", text: msg },
        ]);

        // Brief pause between messages
        if (i < messages.length - 1) {
          await delay(400);
        }
      }

      // Handle UI hints
      if (uiHint === "show_buckets") {
        await delay(300);
        setItems((prev) => [...prev, { id: uid("sm"), role: "sm", kind: "buckets" }]);
      } else if (uiHint === "show_email_input") {
        await delay(300);
        setItems((prev) => [...prev, { id: uid("sm"), role: "sm", kind: "email" }]);
      } else if (uiHint === "show_payment") {
        await delay(300);
        setItems((prev) => [...prev, { id: uid("sm"), role: "sm", kind: "payment" }]);
      }

      setIsTyping(false);
    },
    []
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

        // Render welcome messages
        await renderMessages(data.messages, data.uiHint);
      } catch (err) {
        console.error("Failed to start chat:", err);
        setError("Unable to connect to Sister Marie. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    startChat();
  }, [renderMessages]);

  // Handle bucket selection
  async function handleBucketPick(bucket: Bucket) {
    if (!sessionId) return;

    // Remove buckets from UI
    setItems((prev) => prev.filter((i) => i.kind !== "buckets"));

    // Add user's selection as a message
    setItems((prev) => [
      ...prev,
      { id: uid("user"), role: "user", kind: "text", text: bucket.label },
    ]);

    try {
      setIsTyping(true);
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

      // Render response messages
      await renderMessages(data.messages, data.uiHint);
    } catch (err) {
      console.error("Bucket selection error:", err);
      await renderMessages([
        "I'm sorry, something went wrong.",
        "Could you try selecting again?",
      ]);
    }
  }

  // Handle sending a message
  async function handleSend() {
    const text = composer.trim();
    if (!text || !sessionId || isSending) return;

    // Add user message
    setItems((prev) => [
      ...prev,
      { id: uid("user"), role: "user", kind: "text", text },
    ]);
    setComposer("");
    setIsSending(true);

    try {
      setIsTyping(true);
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

      // Render response messages
      await renderMessages(data.messages, data.uiHint);

      // If ready for payment, transition
      if (data.flags?.readyForPayment && data.uiHint !== "show_payment") {
        await delay(1000);
        await transitionToPayment();
      }
    } catch (err) {
      console.error("Message send error:", err);
      await renderMessages([
        "I'm sorry, something went wrong.",
        "Could you try saying that again?",
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
    <div className="min-h-screen bg-background" data-testid="page-chat">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-10 border-b border-card-border bg-background/70 px-4 py-3 backdrop-blur"
          data-testid="header-chat"
        >
          <div className="flex items-center justify-between">
            <Link href="/" data-testid="link-back">
              <a
                className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-muted-foreground hover:bg-secondary"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </a>
            </Link>

            <div className="flex items-center gap-2">
              <img
                src={grottoMark}
                alt=""
                className="h-6 w-6"
                data-testid="img-grotto-mark-chat"
              />
              <div
                className="text-sm font-semibold"
                data-testid="text-chat-title"
              >
                Sister Marie
              </div>
            </div>

            <div className="h-8 w-16" aria-hidden="true" />
          </div>
        </header>

        {/* Chat Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-auto px-4 pb-28 pt-6"
          data-testid="chat-scroll"
        >
          {isLoading && items.length === 0 ? (
            <div className="flex items-end gap-3">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : (
            items.map((it, idx) => {
              const isSm = it.role === "sm";

              // Bucket selection
              if (it.kind === "buckets") {
                return (
                  <div
                    key={it.id}
                    className="space-y-3"
                    data-testid="block-buckets"
                  >
                    <div className="grid gap-2">
                      {buckets.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBucketPick(b)}
                          disabled={isTyping || isSending}
                          className="w-full rounded-2xl border border-card-border bg-card/80 px-4 py-3 text-left shadow-sm transition hover:bg-card disabled:opacity-50"
                          data-testid={`button-bucket-${b.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                              <span aria-hidden="true">{b.emoji}</span>
                            </div>
                            <div
                              className="text-sm font-medium text-foreground"
                              data-testid={`text-bucket-${b.id}`}
                            >
                              {b.label}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Quick reply buttons
              if (it.kind === "quick") {
                return (
                  <div
                    key={it.id}
                    className="space-y-3"
                    data-testid="block-quick-replies"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {it.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setItems((prev) =>
                              prev.filter((i) => i.kind !== "quick")
                            );
                            setComposer(o.label);
                            // Auto-send after brief delay
                            setTimeout(() => {
                              const input = document.querySelector(
                                '[data-testid="input-composer"]'
                              ) as HTMLInputElement;
                              if (input) {
                                input.value = o.label;
                                setComposer(o.label);
                              }
                            }, 100);
                          }}
                          disabled={isTyping || isSending}
                          className="rounded-2xl border border-card-border bg-card/80 px-4 py-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-card disabled:opacity-50"
                          data-testid={`button-quick-${o.id}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Email capture card
              if (it.kind === "email") {
                return (
                  <div
                    key={it.id}
                    className="flex items-end gap-3"
                    data-testid="block-email-card"
                  >
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-4 shadow-sm backdrop-blur">
                      <div
                        className="text-sm font-semibold text-foreground"
                        data-testid="text-email-title"
                      >
                        Send my confirmation
                      </div>
                      <div className="mt-2 grid gap-2">
                        <Input
                          placeholder="Email address"
                          type="email"
                          className="h-11 rounded-xl"
                          data-testid="input-email"
                        />
                        <Button
                          className="h-11 rounded-xl"
                          data-testid="button-send-confirmation"
                        >
                          Send My Confirmation
                        </Button>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid="text-email-privacy"
                        >
                          🔒 Your email is kept private and never shared.
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Payment tiers card
              if (it.kind === "payment") {
                return (
                  <div
                    key={it.id}
                    className="flex items-end gap-3"
                    data-testid="block-payment-card"
                  >
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-4 shadow-sm backdrop-blur">
                      <div className="text-sm font-semibold text-foreground mb-3">
                        Select your level of support
                      </div>
                      <div className="space-y-2">
                        {[
                          {
                            price: "$28",
                            label: "I Need a Little Help",
                            desc: "We're honored to include your prayer.",
                          },
                          {
                            price: "$35",
                            label: "Cover My Prayer Delivery",
                            desc: "The full cost to our team.",
                            primary: true,
                          },
                          {
                            price: "$55",
                            label: "Carry My Prayer + Lift Another",
                            desc: "Help someone else who may be struggling.",
                          },
                        ].map((tier) => (
                          <button
                            key={tier.price}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              tier.primary
                                ? "border-primary bg-primary/5 hover:bg-primary/10"
                                : "border-card-border bg-card/50 hover:bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">
                                  {tier.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tier.desc}
                                </div>
                              </div>
                              <div className="text-lg font-semibold">
                                {tier.price}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button className="mt-3 text-xs text-muted-foreground underline hover:no-underline">
                        I'm facing financial hardship
                      </button>
                    </Card>
                  </div>
                );
              }

              // Text bubble
              return (
                <div
                  key={it.id}
                  className={isSm ? "flex items-end gap-3" : "flex"}
                  data-testid={`row-message-${idx}`}
                >
                  {isSm ? <AvatarSm /> : null}
                  <Bubble role={it.role}>
                    <span data-testid={`text-message-${idx}`}>{it.text}</span>
                  </Bubble>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {isTyping && !isLoading ? (
            <div className="flex items-end gap-3" data-testid="row-typing">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : null}
        </div>

        {/* Composer */}
        <div
          className="fixed bottom-0 left-0 right-0 border-t border-card-border bg-background/80 backdrop-blur"
          data-testid="composer"
        >
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3">
            <Input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Type a message…"
              className="h-11 rounded-xl"
              data-testid="input-composer"
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
              data-testid="button-send"
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
