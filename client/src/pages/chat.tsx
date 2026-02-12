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
import {
  generateFbEventId,
  trackLead,
  trackInitiateCheckout,
  trackPurchase,
  getFbFields,
  TIER_AMOUNTS,
  UPSELL_AMOUNTS,
} from "@/lib/fbTracking";

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
  | { id: string; role: "sm"; kind: "payment" }
  | { id: string; role: "sm"; kind: "upsell_medal" }
  | { id: string; role: "sm"; kind: "upsell_candle" }
  | { id: string; role: "sm"; kind: "shipping_form" }
  | { id: string; role: "sm"; kind: "thank_you" };

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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [upsellMedalShown, setUpsellMedalShown] = useState(false);
  const [upsellCandleShown, setUpsellCandleShown] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [isSubmittingShipping, setIsSubmittingShipping] = useState(false);
  const [lastPaymentIntentId, setLastPaymentIntentId] = useState<string | null>(null);
  const [shippingForm, setShippingForm] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

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

    // Show soft close messages with proper animation
    const name = personName || "your loved one";
    setShowThinkingDots(true);
    await sleep(calculateThinkingDelay());
    if (!isMountedRef.current) return;
    setShowThinkingDots(false);

    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "text", text: "I understand if now isn't the right time." },
    ]);
    setShowThinkingDots(true);
    await sleep(calculatePauseBetweenMessages());
    if (!isMountedRef.current) return;
    setShowThinkingDots(false);

    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "text", text: `Your prayer for ${name} is saved. You can return anytime, or check your email.` },
    ]);
    setShowThinkingDots(true);
    await sleep(calculatePauseBetweenMessages());
    if (!isMountedRef.current) return;
    setShowThinkingDots(false);

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

  // Show complete message with smooth animation (WhatsApp style)
  const typeMessage = useCallback(
    async (fullText: string): Promise<void> => {
      const messageId = uid("sm");

      // Add complete message directly (no character-by-character typing)
      setItems((prev) => [
        ...prev,
        { id: messageId, role: "sm", kind: "text", text: fullText },
      ]);
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
        setShowThinkingDots(true);
        await sleep(calculatePauseBetweenMessages());
        if (!isMountedRef.current) return;
        setShowThinkingDots(false);

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
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          // Continue with remaining explanation
          await typeMessage("You'll receive photos of your prayer at the holy site, sent directly to your email after our visit.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          await typeMessage("Our team lovingly hand-delivers each prayer to the Grotto. We only ask for a small amount to help cover the time, care, and materials involved.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          await typeMessage("The full cost to provide this sacred service is $35 per prayer.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          await typeMessage("If you're facing financial hardship, you're still welcome to participate — choose the amount that's right for you.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          await typeMessage("If you're able, consider giving more to help cover the cost for others who cannot.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

          await typeMessage("Every amount helps us bring more prayers to Lourdes — as one Body in Christ.");
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);

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
    // Check if we're returning from payment or resuming a session
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    const paymentStatus = params.get("payment");
    const returningParam = params.get("returning");

    // Don't start a new chat if we have session params (handled by separate useEffect)
    if (sessionParam && (paymentStatus || returningParam)) {
      return;
    }

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
        setError("Unable to connect to Messenger Marie. Please try again.");
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

      // Generate Lead event ID for deduplication
      const leadEventId = generateFbEventId();

      const res = await fetch("/api/chat/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, ...getFbFields(leadEventId) }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit email");
      }

      const data = await res.json();

      // Fire Lead event after email is successfully submitted (user added to AWeber/Sheets)
      trackLead(leadEventId);
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

  // Handle payment tier selection
  async function handlePaymentTierSelect(tier: "hardship" | "full" | "generous") {
    if (!sessionId || isProcessingPayment) return;

    setIsProcessingPayment(true);

    const fbEventId = generateFbEventId();
    trackInitiateCheckout(fbEventId, tier, TIER_AMOUNTS[tier] || 35);

    try {
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tier, ...getFbFields(fbEventId) }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create checkout");
      }

      const data = await res.json();

      // Redirect to Stripe checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Payment error:", err);
      setIsProcessingPayment(false);
      await renderMessages([
        "I'm sorry, there was a problem preparing the payment.",
        "Please try again, or reach out to us if this continues.",
      ]);
    }
  }

  // Handle upsell selection - tries one-click first, falls back to checkout
  async function handleUpsellSelect(upsellType: "medal" | "candle") {
    if (!sessionId || isProcessingPayment) return;

    setIsProcessingPayment(true);

    try {
      // Try one-click upsell first
      const res = await fetch("/api/payment/one-click-upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, upsellType, ...getFbFields() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process upsell");
      }

      const data = await res.json();

      if (data.oneClick && data.success) {
        // One-click successful!
        setIsProcessingPayment(false);

        // Fire Purchase pixel for one-click upsell
        if (data.paymentIntentId) {
          trackPurchase(data.paymentIntentId, UPSELL_AMOUNTS[upsellType] || 0, `upsell_${upsellType}`);
        }

        // Store the paymentIntentId for shipping update
        if (data.paymentIntentId) {
          setLastPaymentIntentId(data.paymentIntentId);
        }

        // Remove the upsell card
        if (upsellType === "medal") {
          setItems((prev) => prev.filter((i) => i.kind !== "upsell_medal"));
          setUpsellMedalShown(true);

          // Show success message and shipping form
          await renderMessages([
            "Thank you! Your blessed medal is being prepared.",
            "Please provide your shipping address so we can send it to you.",
          ]);
          setShowThinkingDots(true);
          await sleep(calculatePauseBetweenMessages());
          if (!isMountedRef.current) return;
          setShowThinkingDots(false);
          setItems((prev) => [
            ...prev,
            { id: uid("sm"), role: "sm", kind: "shipping_form" },
          ]);
          setShowShippingForm(true);
        } else {
          // Candle - no shipping needed
          setItems((prev) => prev.filter((i) => i.kind !== "upsell_candle"));
          setUpsellCandleShown(true);
          await showThankYou();
        }
      } else if (data.requiresCheckout && data.checkoutUrl) {
        // Fallback to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (err) {
      console.error("Upsell payment error:", err);
      setIsProcessingPayment(false);
      await renderMessages([
        "I'm sorry, there was a problem with the payment.",
        "Please try again.",
      ]);
    }
  }

  // Handle shipping form submission
  async function handleShippingSubmit() {
    if (!sessionId || isSubmittingShipping) return;

    // Validate required fields
    if (!shippingForm.name || !shippingForm.addressLine1 || !shippingForm.city ||
        !shippingForm.postalCode || !shippingForm.country) {
      await renderMessages(["Please fill in all required fields."]);
      return;
    }

    setIsSubmittingShipping(true);

    try {
      const res = await fetch("/api/payment/save-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          shipping: shippingForm,
          paymentIntentId: lastPaymentIntentId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save shipping address");
      }

      // Remove shipping form
      setItems((prev) => prev.filter((i) => i.kind !== "shipping_form"));
      setShowShippingForm(false);

      // Show candle upsell or thank you
      if (!upsellCandleShown) {
        await renderMessages([
          "Your shipping address has been saved.",
          "Before you go, may I share one more thought?",
          "Many pilgrims also light a candle at the Grotto. It burns for days, a continuous prayer.",
        ]);
        setShowThinkingDots(true);
        await sleep(calculatePauseBetweenMessages());
        if (!isMountedRef.current) return;
        setShowThinkingDots(false);
        setItems((prev) => [
          ...prev,
          { id: uid("sm"), role: "sm", kind: "upsell_candle" },
        ]);
        setUpsellCandleShown(true);
      } else {
        await showThankYou();
      }
    } catch (err) {
      console.error("Shipping save error:", err);
      await renderMessages([
        "I'm sorry, there was a problem saving your address.",
        "Please try again.",
      ]);
    } finally {
      setIsSubmittingShipping(false);
    }
  }

  // Handle upsell decline
  async function handleUpsellDecline(currentUpsell: "medal" | "candle") {
    if (currentUpsell === "medal") {
      // Remove medal upsell card
      setItems((prev) => prev.filter((i) => i.kind !== "upsell_medal"));
      setUpsellMedalShown(true);

      // Show candle upsell
      await renderMessages([
        "I understand. Before you go, may I share one more thought?",
        "Many pilgrims also light a candle at the Grotto. It burns for days, a continuous prayer.",
      ]);
      setShowThinkingDots(true);
      await sleep(calculatePauseBetweenMessages());
      if (!isMountedRef.current) return;
      setShowThinkingDots(false);
      setItems((prev) => [
        ...prev,
        { id: uid("sm"), role: "sm", kind: "upsell_candle" },
      ]);
      setUpsellCandleShown(true);
    } else {
      // Declined candle - show thank you
      setItems((prev) => prev.filter((i) => i.kind !== "upsell_candle"));
      await showThankYou();
    }
  }

  // Show thank you message
  async function showThankYou() {
    const name = personName || "your loved one";
    await renderMessages([
      "Thank you for entrusting us with this sacred intention.",
      `${name}'s prayer will be carried to Lourdes with love.`,
      "You'll receive a confirmation email shortly, and photos when the prayer is delivered.",
      "May Our Lady's blessing be upon you.",
    ]);
    setShowThinkingDots(true);
    await sleep(calculatePauseBetweenMessages());
    if (!isMountedRef.current) return;
    setShowThinkingDots(false);
    setItems((prev) => [
      ...prev,
      { id: uid("sm"), role: "sm", kind: "thank_you" },
    ]);
  }

  // Check for payment success or session resume on URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const sessionParam = params.get("session");
    const upsellParam = params.get("upsell");
    const returningParam = params.get("returning");

    // Handle returning user session resume
    if (returningParam === "true" && sessionParam) {
      // Clean URL
      window.history.replaceState({}, "", "/chat");

      // Fetch session data and restore
      fetch(`/api/chat/session/${sessionParam}`)
        .then((res) => res.json())
        .then(async (data) => {
          if (data.error) {
            // Session not found, start fresh
            return;
          }

          setSessionId(sessionParam);
          setPhase(data.phase);
          if (data.personName) setPersonName(data.personName);

          // Show welcome back message
          setIsLoading(false);
          await renderMessages([
            "Welcome back! I remember you.",
            "Your prayer is still here, waiting. Shall we continue where we left off?",
          ]);
        })
        .catch(() => {
          // Error fetching session, will start fresh
        });

      return; // Don't run the rest of this effect
    }

    if (paymentStatus === "success" && sessionParam) {
      // Get checkout session ID from URL if present
      const checkoutSessionId = params.get("checkout_session");

      // Clean URL
      window.history.replaceState({}, "", "/chat");

      // Set session and mark payment completed
      setSessionId(sessionParam);
      setPaymentCompleted(true);
      setIsLoading(false);

      // Verify checkout and update database (for initial payment)
      if (checkoutSessionId && !upsellParam) {
        fetch("/api/payment/verify-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionParam,
            checkoutSessionId,
            ...getFbFields(),
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("Checkout verified:", data);
            if (data.paymentIntentId) {
              trackPurchase(data.paymentIntentId, TIER_AMOUNTS[data.tier] || 35, "prayer_petition");
            }
          })
          .catch((err) => {
            console.error("Failed to verify checkout:", err);
          });
      }

      // Redirect to confirmation page for the full upsell flow
      if (upsellParam === "medal" || upsellParam === "candle") {
        // Upsell payment completed via Stripe checkout — redirect back to confirmation page
        window.location.href = `/confirmation/${sessionParam}`;
        return;
      } else {
        // Main payment completed — redirect to confirmation/upsell page
        setTimeout(() => {
          window.location.href = `/confirmation/${sessionParam}`;
        }, 500);
      }
    } else if (paymentStatus === "cancelled" && sessionParam) {
      // Clean URL
      window.history.replaceState({}, "", "/chat");
      setSessionId(sessionParam);
      setIsLoading(false);

      // Show gentle message about cancelled payment
      setTimeout(async () => {
        await renderMessages([
          "I see you've returned. Please take your time.",
          "When you're ready, the payment options are still available above.",
        ]);
      }, 500);
    }
  }, []);

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
              <div className="text-sm font-semibold">Messenger Marie</div>
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
                          <button
                            onClick={() => handlePaymentTierSelect("hardship")}
                            disabled={isProcessingPayment}
                            className="w-full rounded-lg bg-primary/70 hover:bg-primary/60 text-primary-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                          >
                            {isProcessingPayment ? "Processing..." : "Include my Prayer for $28"}
                          </button>
                        </div>

                        {/* $35 Tier - Primary */}
                        <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                          <div className="font-semibold text-foreground mb-2">$35 – Cover My Prayer Delivery</div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            "I'm covering the full cost to bring my prayer to the Grotto. Thank you for making this possible."
                          </p>
                          <button
                            onClick={() => handlePaymentTierSelect("full")}
                            disabled={isProcessingPayment}
                            className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                          >
                            {isProcessingPayment ? "Processing..." : "Full Prayer Delivery for $35"}
                          </button>
                        </div>

                        {/* $55 Tier */}
                        <div className="rounded-xl border border-card-border bg-card/50 p-4">
                          <div className="font-semibold text-foreground mb-2">$55 – Carry My Prayer + Lift Another</div>
                          <p className="text-xs text-muted-foreground italic mb-3">
                            "I'm offering a bit more to help someone else who may be struggling. May my prayer and my gift bring blessings to others in need."
                          </p>
                          <button
                            onClick={() => handlePaymentTierSelect("generous")}
                            disabled={isProcessingPayment}
                            className="w-full rounded-lg bg-primary/70 hover:bg-primary/60 text-primary-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                          >
                            {isProcessingPayment ? "Processing..." : "Send and Support Service for $55"}
                          </button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Medal upsell card
              if (it.kind === "upsell_medal") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
                      <div className="text-base font-semibold text-foreground mb-2">
                        Blessed Miraculous Medal
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        This medal has been touched to the rock of the Grotto at Lourdes. A tangible connection to this holy place.
                      </p>
                      <div className="text-lg font-semibold text-foreground mb-4">$79</div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleUpsellSelect("medal")}
                          disabled={isProcessingPayment}
                          className="flex-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                        >
                          {isProcessingPayment ? "Processing..." : "Yes, Send Me a Medal"}
                        </button>
                        <button
                          onClick={() => handleUpsellDecline("medal")}
                          disabled={isProcessingPayment}
                          className="rounded-lg border border-card-border bg-card/50 hover:bg-card text-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                        >
                          No, thank you
                        </button>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Candle upsell card
              if (it.kind === "upsell_candle") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
                      <div className="text-base font-semibold text-foreground mb-2">
                        Light a Candle at the Grotto
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        A candle lit at Lourdes burns for days — a continuous prayer ascending with your intention.
                      </p>
                      <div className="text-lg font-semibold text-foreground mb-4">$19</div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleUpsellSelect("candle")}
                          disabled={isProcessingPayment}
                          className="flex-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                        >
                          {isProcessingPayment ? "Processing..." : "Light a Candle for $19"}
                        </button>
                        <button
                          onClick={() => handleUpsellDecline("candle")}
                          disabled={isProcessingPayment}
                          className="rounded-lg border border-card-border bg-card/50 hover:bg-card text-foreground py-2.5 px-4 text-sm font-medium transition disabled:opacity-50"
                        >
                          No, thank you
                        </button>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Shipping form (for medal one-click purchase)
              if (it.kind === "shipping_form") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
                      <div className="text-base font-semibold text-foreground mb-4">
                        Shipping Address
                      </div>
                      <div className="space-y-3">
                        <Input
                          placeholder="Full Name *"
                          value={shippingForm.name}
                          onChange={(e) => setShippingForm({ ...shippingForm, name: e.target.value })}
                          className="h-11 rounded-xl"
                          disabled={isSubmittingShipping}
                        />
                        <Input
                          placeholder="Address Line 1 *"
                          value={shippingForm.addressLine1}
                          onChange={(e) => setShippingForm({ ...shippingForm, addressLine1: e.target.value })}
                          className="h-11 rounded-xl"
                          disabled={isSubmittingShipping}
                        />
                        <Input
                          placeholder="Address Line 2 (optional)"
                          value={shippingForm.addressLine2}
                          onChange={(e) => setShippingForm({ ...shippingForm, addressLine2: e.target.value })}
                          className="h-11 rounded-xl"
                          disabled={isSubmittingShipping}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="City *"
                            value={shippingForm.city}
                            onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })}
                            className="h-11 rounded-xl"
                            disabled={isSubmittingShipping}
                          />
                          <Input
                            placeholder="State/Province"
                            value={shippingForm.state}
                            onChange={(e) => setShippingForm({ ...shippingForm, state: e.target.value })}
                            className="h-11 rounded-xl"
                            disabled={isSubmittingShipping}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Postal Code *"
                            value={shippingForm.postalCode}
                            onChange={(e) => setShippingForm({ ...shippingForm, postalCode: e.target.value })}
                            className="h-11 rounded-xl"
                            disabled={isSubmittingShipping}
                          />
                          <select
                            value={shippingForm.country}
                            onChange={(e) => setShippingForm({ ...shippingForm, country: e.target.value })}
                            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                            disabled={isSubmittingShipping}
                          >
                            <option value="US">United States</option>
                            <option value="CA">Canada</option>
                            <option value="GB">United Kingdom</option>
                            <option value="AU">Australia</option>
                            <option value="NZ">New Zealand</option>
                            <option value="IE">Ireland</option>
                            <option value="FR">France</option>
                            <option value="DE">Germany</option>
                            <option value="IT">Italy</option>
                            <option value="ES">Spain</option>
                          </select>
                        </div>
                        <Button
                          className="w-full h-11 rounded-xl"
                          onClick={handleShippingSubmit}
                          disabled={isSubmittingShipping}
                        >
                          {isSubmittingShipping ? "Saving..." : "Save Shipping Address"}
                        </Button>
                        <div className="text-xs text-muted-foreground text-center">
                          Your medal will be shipped within 5-7 business days.
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Thank you card
              if (it.kind === "thank_you") {
                return (
                  <div key={it.id} className="flex items-end gap-3">
                    <AvatarSm />
                    <Card className="w-full max-w-[520px] border-card-border bg-gradient-to-br from-primary/10 to-card/85 p-6 shadow-sm backdrop-blur">
                      <div className="text-center">
                        <div className="text-4xl mb-3">🙏</div>
                        <div className="text-lg font-semibold text-foreground mb-2">
                          Your Prayer is on Its Way
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Check your email for confirmation and updates. You'll receive photos when your prayer reaches the Grotto.
                        </p>
                      </div>
                    </Card>
                  </div>
                );
              }

              // Text bubble (completed message with smooth fade-in)
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
