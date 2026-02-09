import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg border-card-border shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground"
                data-testid="text-title"
              >
                We’re building the Lourdes Prayer Drop lander
              </h1>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
                data-testid="text-subtitle"
              >
                You’re seeing this placeholder screen while we hook up the main pages.
                The theme is active (Sky &amp; Sanctuary) — next up is the Messenger Marie
                intro and “Talk to Messenger Marie” flow.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
