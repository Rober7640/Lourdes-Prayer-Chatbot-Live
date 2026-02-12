import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PendantOfferCardProps {
  personName: string;
  isForSelf: boolean;
  onAccept: () => void;
  onDecline: () => void;
  disabled?: boolean;
}

export default function PendantOfferCard({
  personName,
  isForSelf,
  onAccept,
  onDecline,
  disabled = false,
}: PendantOfferCardProps) {
  const displayName = isForSelf ? "You" : personName;

  return (
    <Card className="w-full max-w-[400px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Archangel Michael Pendant
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          For {displayName}
        </p>

        <div className="space-y-2 text-left mb-6 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>Sterling silver plated with chain</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>St. Michael in armor (front)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>St. Michael Prayer engraved (back)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>Free shipping</span>
          </div>
        </div>

        <div className="text-2xl font-bold text-foreground mb-6">
          $49
        </div>

        <div className="space-y-3">
          <Button
            onClick={onAccept}
            disabled={disabled}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Yes, Add the Pendant to My Order for $49
          </Button>

          <button
            onClick={onDecline}
            disabled={disabled}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50"
          >
            No thank you
          </button>
        </div>
      </div>
    </Card>
  );
}
