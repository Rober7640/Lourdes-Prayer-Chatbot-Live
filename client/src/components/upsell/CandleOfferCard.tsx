import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CandleOfferCardProps {
  personName: string;
  isForSelf: boolean;
  onAccept: () => void;
  onDecline: () => void;
  disabled?: boolean;
}

export default function CandleOfferCard({
  personName,
  isForSelf,
  onAccept,
  onDecline,
  disabled = false,
}: CandleOfferCardProps) {
  const displayName = isForSelf ? "You" : personName;

  return (
    <Card className="w-full max-w-[400px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
      <div className="text-center">
        <div className="text-3xl mb-2">&#128367;</div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Candle for {displayName}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Lit at the Grotto, burning among thousands.
          <br />
          Photo confirmation sent.
        </p>

        <div className="text-2xl font-bold text-foreground mb-6">
          $19
        </div>

        <div className="space-y-3">
          <Button
            onClick={onAccept}
            disabled={disabled}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Yes — Light a Candle
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
