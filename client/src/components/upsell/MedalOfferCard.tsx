import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MedalOfferCardProps {
  personName: string;
  isForSelf: boolean;
  onAccept: () => void;
  onTellMeMore: () => void;
  onDecline: () => void;
  disabled?: boolean;
}

export default function MedalOfferCard({
  personName,
  isForSelf,
  onAccept,
  onTellMeMore,
  onDecline,
  disabled = false,
}: MedalOfferCardProps) {
  const displayName = isForSelf ? "You" : personName;

  return (
    <Card className="w-full max-w-[400px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          The Lourdes Healing Medal
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          For {displayName}
        </p>

        <div className="space-y-2 text-left mb-6 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>14k silver plated</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>Contains water from the Grotto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>Certificate of Authenticity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary">&#10022;</span>
            <span>Free shipping from France</span>
          </div>
        </div>

        <div className="text-2xl font-bold text-foreground mb-6">
          $59
        </div>

        <div className="space-y-3">
          <Button
            onClick={onAccept}
            disabled={disabled}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Yes — Send Me the Medal
          </Button>

          <Button
            onClick={onTellMeMore}
            disabled={disabled}
            variant="outline"
            className="w-full h-11 rounded-xl border-card-border text-foreground hover:bg-secondary"
          >
            Tell me more
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
