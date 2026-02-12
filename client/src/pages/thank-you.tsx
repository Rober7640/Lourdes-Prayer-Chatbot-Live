import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";

// ============================================================================
// TYPES
// ============================================================================

interface OrderItem {
  label: string;
  price: number;
  type: string;
}

interface ThankYouData {
  userName: string | null;
  userEmail: string | null;
  personName: string;
  prayingFor: "self" | "other" | "both";
  situation: string | null;
  items: OrderItem[];
  total: number;
}

// ============================================================================
// STEP CONFIG PER PRODUCT TYPE
// ============================================================================

const PRODUCT_STEPS: Record<string, string[]> = {
  prayer: [
    "Your petition will be printed on sacred paper",
    "Placed in the petition box at the Grotto of Massabielle",
    "Prayed over daily by the Sanctuary chaplains",
    "You'll receive confirmation via email",
  ],
  medal: [
    "Your medal is being prepared in France",
    "Blessed at the Grotto before shipping",
    "Ships within 3-5 business days",
    "Delivery: 7-14 business days (tracking provided)",
  ],
  candle: [
    "Your candle will be lit at the Grotto within 24-48 hours",
    "It will burn for approximately 7 days",
    "You'll receive a photo of your lit candle via email",
  ],
  pendant: [
    "Pendant prepared and shipped",
    "Arrives within 7-14 business days",
    "Tracking number sent via email",
    "St. Michael Prayer Card included",
  ],
};

const PRODUCT_ICONS: Record<string, string> = {
  prayer: "\uD83D\uDCDC",
  medal: "\uD83C\uDFC5",
  candle: "\uD83D\uDD6F\uFE0F",
  pendant: "\uD83D\uDEE1\uFE0F",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ThankYouPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [data, setData] = useState<ThankYouData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrderSummary() {
      if (!sessionId) {
        setError("Session not found");
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/thank-you/${sessionId}`);
        if (!res.ok) {
          throw new Error("Failed to load order summary");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load thank-you page:", err);
        setError("Unable to load your order details. Please check your email for confirmation.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOrderSummary();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading your order...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-destructive mb-4">{error || "Something went wrong"}</p>
          <Button onClick={() => window.location.href = "/"}>Return to Home</Button>
        </Card>
      </div>
    );
  }

  const displayName = data.prayingFor === "self" ? "yourself" : data.personName;
  const displayNameCapitalized = data.prayingFor === "self" ? "Yourself" : data.personName;

  // Collect unique "what happens next" steps from all purchased products
  const allSteps: string[] = [];
  const seenSteps = new Set<string>();
  for (const item of data.items) {
    const steps = PRODUCT_STEPS[item.type] || [];
    for (const step of steps) {
      if (!seenSteps.has(step)) {
        seenSteps.add(step);
        allSteps.push(step);
      }
    }
  }

  // Build personalized sister message
  const hasPhysicalProduct = data.items.some((i) => i.type === "medal" || i.type === "pendant");
  const hasCandle = data.items.some((i) => i.type === "candle");
  let sisterMessage = `Thank you for entrusting ${displayName}'s intentions to Our Lady of Lourdes. I will personally place your petition at the Grotto, where millions of pilgrims have brought their hopes and prayers.`;
  if (hasCandle) {
    sisterMessage += ` Your candle will soon join the thousands of lights at the Grotto, each one a prayer rising to heaven.`;
  }
  if (hasPhysicalProduct) {
    sisterMessage += ` I will ensure your blessed items are prepared with care before they begin their journey to you.`;
  }
  sisterMessage += ` You are in my prayers, and I trust Our Lady will intercede for you.`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <header className="border-b border-card-border bg-background/70 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-center gap-2">
            <img src={grottoMark} alt="" className="h-6 w-6" />
            <div className="text-sm font-semibold">Messenger Marie</div>
          </div>
        </header>

        {/* Content */}
        <div className="px-4 py-8">
          <div className="flex justify-center">
            <Card className="w-full max-w-[500px] border-card-border bg-card/95 shadow-lg backdrop-blur overflow-hidden">
              {/* Header */}
              <div className="bg-primary/10 px-6 py-6 text-center border-b border-card-border">
                <div className="text-4xl mb-2">{"\uD83D\uDE4F"}</div>
                <h1 className="text-xl font-semibold text-foreground">
                  Your Order is Confirmed
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Thank you for your faith, {data.userName || "dear one"}
                </p>
              </div>

              {/* Order Items */}
              <div className="px-6 py-5 border-b border-card-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Order Summary
                </h3>
                <div className="space-y-3">
                  {data.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg border border-card-border bg-secondary/30 flex items-center justify-center text-lg flex-shrink-0">
                          {PRODUCT_ICONS[item.type] || "\uD83D\uDCE6"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            For: {displayNameCapitalized}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground flex-shrink-0">
                        ${item.price}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Total</p>
                  <p className="text-lg font-bold text-foreground">${data.total}</p>
                </div>
              </div>

              {/* What Happens Next */}
              <div className="px-6 py-5 border-b border-card-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  What Happens Next
                </h4>
                <ul className="space-y-2">
                  {allSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary flex-shrink-0">{"\u2726"}</span>
                      <span className="text-foreground">{step}</span>
                    </li>
                  ))}
                </ul>
                {data.userEmail && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Confirmation sent to: {data.userEmail}
                  </p>
                )}
              </div>

              {/* Messenger Marie Message */}
              <div className="px-6 py-5 border-b border-card-border bg-secondary/20">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-card-border flex-shrink-0">
                    <img
                      src={sisterMariePortrait}
                      alt="Messenger Marie"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm italic text-foreground leading-relaxed">
                      "{sisterMessage}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      — Messenger Marie
                    </p>
                  </div>
                </div>
              </div>

              {/* Support & CTA */}
              <div className="px-6 py-5">
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Need Help?
                  </p>
                  <a
                    href="mailto:support@messengersoflourdes.com"
                    className="text-sm text-primary hover:underline"
                  >
                    support@messengersoflourdes.com
                  </a>
                </div>
                <Button
                  onClick={() => window.location.href = "/"}
                  variant="outline"
                  className="w-full h-11 rounded-xl border-card-border text-foreground hover:bg-secondary"
                >
                  Return to Home
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
