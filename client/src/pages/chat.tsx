import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { Link } from "wouter";

type Role = "sm" | "user";

type BucketId = "family" | "healing" | "protection" | "grief" | "guidance";

type Bucket = {
  id: BucketId;
  emoji: string;
  label: string;
};

type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "buckets" }
  | { id: string; role: "sm"; kind: "quick"; question: string; options: { id: string; label: string }[] }
  | { id: string; role: "sm"; kind: "email" };

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function AvatarSm() {
  return (
    <div
      className="h-10 w-10 overflow-hidden rounded-full border border-card-border bg-white/70 shadow-sm"
      data-testid="img-sm-avatar"
      aria-label="Sister Marie"
    >
      <img src={sisterMariePortrait} alt="Sister Marie" className="h-full w-full object-cover" />
    </div>
  );
}

function Bubble({ role, children }: { role: Role; children: React.ReactNode }) {
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

const buckets: Bucket[] = [
  { id: "family", emoji: "🕊️", label: "A Family Wound" },
  { id: "healing", emoji: "💚", label: "Healing for Someone Ill" },
  { id: "protection", emoji: "🛡️", label: "Protection for a Loved One" },
  { id: "grief", emoji: "🕯️", label: "Grief or Loss" },
  { id: "guidance", emoji: "🙏", label: "Guidance in a Difficult Season" },
];

export default function ChatPage() {
  const [items, setItems] = useState<ChatItem[]>(() => [
    { id: uid("sm"), role: "sm", kind: "text", text: "Welcome, and God bless you for being here." },
    {
      id: uid("sm"),
      role: "sm",
      kind: "text",
      text: "My name is Sister Marie. I’m with Messengers at Lourdes.",
    },
    { id: uid("sm"), role: "sm", kind: "text", text: "I’d be honored to hear what’s on your heart." },
    { id: uid("sm"), role: "sm", kind: "text", text: "What brings you to Our Lady of Lourdes?" },
    { id: uid("sm"), role: "sm", kind: "buckets" },
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const [composer, setComposer] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, isTyping]);

  const hasBuckets = useMemo(() => items.some((i) => i.kind === "buckets"), [items]);

  function pushUser(text: string) {
    setItems((prev) => [...prev, { id: uid("user"), role: "user", kind: "text", text }]);
  }

  function pushSm(text: string) {
    setItems((prev) => [...prev, { id: uid("sm"), role: "sm", kind: "text", text }]);
  }

  function simulateSmReplies(replies: string[], afterMs = 800) {
    setIsTyping(true);
    const totalDelay = replies.reduce((acc, _r, idx) => acc + (idx === 0 ? afterMs : 1100), 0);

    replies.forEach((r, idx) => {
      window.setTimeout(() => {
        pushSm(r);
      }, (idx === 0 ? afterMs : afterMs + idx * 1100));
    });

    window.setTimeout(() => setIsTyping(false), totalDelay + 200);
  }

  function handleBucketPick(bucket: Bucket) {
    // remove buckets
    setItems((prev) => prev.filter((i) => i.kind !== "buckets"));
    pushUser(bucket.label);

    simulateSmReplies([
      "Thank you for sharing that.",
      "When someone we love is suffering, it can feel like we’re suffering alongside them.",
      "Is this intention for yourself, or for someone you love?",
    ]);

    window.setTimeout(() => {
      setItems((prev) => [
        ...prev,
        {
          id: uid("sm"),
          role: "sm",
          kind: "quick",
          question: "Is this intention for yourself, or for someone you love?",
          options: [
            { id: "me", label: "For me" },
            { id: "love", label: "For someone I love" },
          ],
        },
      ]);
    }, 3500);
  }

  function handleQuickPick(optionLabel: string) {
    setItems((prev) => prev.filter((i) => i.kind !== "quick"));
    pushUser(optionLabel);
    simulateSmReplies(["Tell me about them. What’s their name, and what are they facing?"]);
  }

  function handleSend() {
    const text = composer.trim();
    if (!text) return;

    pushUser(text);
    setComposer("");

    // lightweight demo flow: after user shares details, prompt email capture
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      pushSm("I’ve written down everything you’ve shared.");
      pushSm(
        "Your intention will be carried to Lourdes and placed at the Grotto in your name within 7 days.",
      );
      pushSm("Where should I send confirmation once your prayer has been delivered?");
      setItems((prev) => [...prev, { id: uid("sm"), role: "sm", kind: "email" }]);
    }, 1400);
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-chat">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
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
              <img src={grottoMark} alt="" className="h-6 w-6" data-testid="img-grotto-mark-chat" />
              <div className="text-sm font-semibold" data-testid="text-chat-title">
                Sister Marie
              </div>
            </div>

            <div className="h-8 w-16" aria-hidden="true" />
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-auto px-4 pb-28 pt-6"
          data-testid="chat-scroll"
        >
          {items.map((it, idx) => {
            const isSm = it.role === "sm";

            if (it.kind === "buckets") {
              return (
                <div key={it.id} className="space-y-3" data-testid="block-buckets">
                  <div className="flex items-end gap-3">
                    <AvatarSm />
                    <Bubble role="sm">
                      <div data-testid="text-buckets-prompt">Choose what best matches what you’re carrying.</div>
                    </Bubble>
                  </div>

                  <div className="grid gap-2">
                    {buckets.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBucketPick(b)}
                        className="w-full rounded-2xl border border-card-border bg-card/80 px-4 py-3 text-left shadow-sm transition hover:bg-card"
                        data-testid={`button-bucket-${b.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                            <span aria-hidden="true">{b.emoji}</span>
                          </div>
                          <div className="text-sm font-medium text-foreground" data-testid={`text-bucket-${b.id}`}>
                            {b.label}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (it.kind === "quick") {
              return (
                <div key={it.id} className="space-y-3" data-testid="block-quick-replies">
                  <div className="flex items-end gap-3">
                    <AvatarSm />
                    <Bubble role="sm">
                      <div data-testid="text-quick-question">{it.question}</div>
                    </Bubble>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {it.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleQuickPick(o.label)}
                        className="rounded-2xl border border-card-border bg-card/80 px-4 py-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-card"
                        data-testid={`button-quick-${o.id}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (it.kind === "email") {
              return (
                <div key={it.id} className="flex items-end gap-3" data-testid="block-email-card">
                  <AvatarSm />
                  <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-4 shadow-sm backdrop-blur">
                    <div className="text-sm font-semibold text-foreground" data-testid="text-email-title">
                      Send my confirmation
                    </div>
                    <div className="mt-2 grid gap-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        className="h-11 rounded-xl"
                        data-testid="input-email"
                      />
                      <Button className="h-11 rounded-xl" data-testid="button-send-confirmation">
                        Send My Confirmation
                      </Button>
                      <div className="text-xs text-muted-foreground" data-testid="text-email-privacy">
                        🔒 Your email is kept private and never shared.
                      </div>
                    </div>
                  </Card>
                </div>
              );
            }

            // text bubble
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
          })}

          {isTyping ? (
            <div className="flex items-end gap-3" data-testid="row-typing">
              <AvatarSm />
              <TypingDots />
            </div>
          ) : null}

          {!hasBuckets ? (
            <div className="pt-2 text-center text-xs text-muted-foreground" data-testid="text-chat-hint">
              This is a UI preview of the conversation flow.
            </div>
          ) : null}
        </div>

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
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <Button
              className="h-11 w-11 rounded-xl px-0"
              onClick={handleSend}
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
