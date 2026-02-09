import { Button } from "@/components/ui/button";

interface ContinueOrGoButtonsProps {
  onContinue: () => void;
  onGo: () => void;
  disabled?: boolean;
}

export default function ContinueOrGoButtons({
  onContinue,
  onGo,
  disabled = false,
}: ContinueOrGoButtonsProps) {
  return (
    <div className="flex flex-col gap-2 max-w-[300px]">
      <Button
        onClick={onContinue}
        disabled={disabled}
        className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Yes, please
      </Button>
      <Button
        onClick={onGo}
        disabled={disabled}
        variant="outline"
        className="h-11 rounded-xl border-card-border text-muted-foreground hover:bg-secondary"
      >
        I need to go
      </Button>
    </div>
  );
}
