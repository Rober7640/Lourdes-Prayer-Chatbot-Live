import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import sisterMariePortrait from "@/assets/images/sister-marie-portrait.png";

type ThankYouVariant = "prayer" | "candle" | "medal" | "pendant" | "close";

interface ThankYouCardProps {
  variant: ThankYouVariant;
  personName: string;
  isForSelf: boolean;
  situation?: string;
  userEmail?: string;
  onReturnHome: () => void;
}

// Content configuration by variant
const VARIANT_CONTENT: Record<
  ThankYouVariant,
  {
    icon: string;
    headline: string;
    subtext: (name: string) => string;
    productLabel: string;
    productImage?: string;
    price?: string;
    steps: string[];
    sisterMessage: (name: string) => string;
  }
> = {
  prayer: {
    icon: "📜",
    headline: "Your Prayer Has Been Received",
    subtext: () => "Thank you for your faith",
    productLabel: "Petition",
    steps: [
      "Your petition will be printed on sacred paper",
      "Placed in the petition box at the Grotto of Massabielle",
      "Prayed over daily by the Sanctuary chaplains",
      "You'll receive confirmation via email",
    ],
    sisterMessage: (name: string) =>
      `Thank you for entrusting ${name}'s intentions to Our Lady of Lourdes. I will personally place your petition at the Grotto, where millions of pilgrims have brought their hopes and prayers. You are in my prayers, and I trust Our Lady will intercede for you.`,
  },
  candle: {
    icon: "🕯️",
    headline: "Your Order is Confirmed",
    subtext: (name: string) => `A light will shine for ${name}`,
    productLabel: "Grotto Prayer Candle",
    productImage: "/images/candle-grotto.jpg",
    price: "$19",
    steps: [
      "Your candle will be lit at the Grotto within 24-48 hours",
      "It will burn for approximately 7 days",
      "You'll receive a photo of your lit candle via email",
      "Your petition remains in the prayer intention book",
    ],
    sisterMessage: (name: string) =>
      `Your candle will soon join the thousands of lights at the Grotto, each one a prayer rising to heaven. When I light it, I will hold ${name} in my heart. Watch for the photo — it will be a beautiful reminder that your prayer is burning brightly at Lourdes.`,
  },
  medal: {
    icon: "🏅",
    headline: "Your Order is Confirmed",
    subtext: () => "A blessed gift is on its way",
    productLabel: "The Lourdes Healing Medal",
    productImage: "/images/medal-front.jpg",
    price: "$59",
    steps: [
      "Your medal is being prepared in France",
      "It will be blessed at the Grotto before shipping",
      "Ships within 3-5 business days",
      "Delivery: 7-14 business days (tracking provided)",
    ],
    sisterMessage: (name: string) =>
      `I will personally ensure your medal is blessed at the Grotto before it begins its journey to ${name}. It carries within it the healing waters that have brought comfort to so many. May Our Lady of Lourdes watch over you both, and may this medal be a source of strength and hope.`,
  },
  pendant: {
    icon: "\uD83D\uDEE1\uFE0F",
    headline: "Your Order is Confirmed",
    subtext: () => "A protector is on the way",
    productLabel: "Archangel Michael Pendant",
    productImage: "/images/michael-pendant.jpg",
    price: "$49",
    steps: [
      "Pendant prepared and shipped",
      "Arrives within 7-14 business days",
      "Tracking number sent via email",
      "St. Michael Prayer Card included",
    ],
    sisterMessage: (name: string) =>
      `${name} has Our Lady's healing AND Michael's protection now. That is a powerful combination. May the Archangel stand guard over ${name}, and may you feel his strength in the days ahead.`,
  },
  close: {
    icon: "\uD83D\uDE4F",
    headline: "God Bless You",
    subtext: () => "Your prayer is in our hands",
    productLabel: "Petition",
    steps: [
      "Your petition will be printed on sacred paper",
      "Placed in the petition box at the Grotto of Massabielle",
      "Prayed over daily by the Sanctuary chaplains",
      "You'll receive confirmation via email",
    ],
    sisterMessage: (name: string) =>
      `Thank you for entrusting ${name}'s intentions to Our Lady of Lourdes. Your prayer will be placed at the Grotto. You are in my prayers, and I trust Our Lady will intercede for you. God bless you.`,
  },
};

export default function ThankYouCard({
  variant,
  personName,
  isForSelf,
  situation,
  userEmail,
  onReturnHome,
}: ThankYouCardProps) {
  const content = VARIANT_CONTENT[variant];
  const displayName = isForSelf ? "yourself" : personName;
  const displayNameCapitalized = isForSelf ? "Yourself" : personName;

  return (
    <Card className="w-full max-w-[450px] border-card-border bg-card/95 shadow-lg backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-6 py-5 text-center border-b border-card-border">
        <div className="text-4xl mb-2">{content.icon}</div>
        <h2 className="text-xl font-semibold text-foreground">
          {content.headline}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {content.subtext(displayName)}
        </p>
      </div>

      {/* Order Summary */}
      <div className="px-6 py-5 border-b border-card-border">
        <div className="flex items-start gap-4">
          {content.productImage ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-card-border flex-shrink-0 bg-secondary/30">
              <img
                src={content.productImage}
                alt={content.productLabel}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg border border-card-border flex-shrink-0 bg-secondary/30 flex items-center justify-center text-2xl">
              📜
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">
              {content.productLabel}
            </h3>
            <p className="text-sm text-muted-foreground">
              For: {displayNameCapitalized}
            </p>
            {variant === "prayer" && situation && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {situation}
              </p>
            )}
            {content.price && (
              <p className="text-sm font-semibold text-foreground mt-1">
                {content.price}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="px-6 py-5 border-b border-card-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          What Happens Next
        </h4>
        <ul className="space-y-2">
          {content.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary flex-shrink-0">✦</span>
              <span className="text-foreground">{step}</span>
            </li>
          ))}
        </ul>
        {userEmail && (
          <p className="text-xs text-muted-foreground mt-3">
            Confirmation sent to: {userEmail}
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
              "{content.sisterMessage(displayName)}"
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
          onClick={onReturnHome}
          variant="outline"
          className="w-full h-11 rounded-xl border-card-border text-foreground hover:bg-secondary"
        >
          Return to Home
        </Button>
      </div>
    </Card>
  );
}
