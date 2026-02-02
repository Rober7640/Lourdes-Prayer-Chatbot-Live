import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroSky from "@/assets/images/sky-sanctuary-hero.png";
import grottoMark from "@/assets/images/lourdes-grotto-mark.png";
import waterRipples from "@/assets/images/lourdes-water-ripples.png";
import { ArrowRight, Sparkles } from "lucide-react";

type StatusState = "busy" | "available";

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function useSisterMarieAvailability() {
  const [status, setStatus] = useState<StatusState>("busy");

  useEffect(() => {
    const key = "lourdes_sister_marie_available";

    if (typeof window !== "undefined") {
      const already = window.localStorage.getItem(key);
      if (already === "true") {
        setStatus("available");
        return;
      }
    }

    const delay = randomIntInclusive(3000, 9000);
    const t = window.setTimeout(() => {
      setStatus("available");
      try {
        window.localStorage.setItem(key, "true");
      } catch {
        // ignore
      }
    }, delay);

    return () => window.clearTimeout(t);
  }, []);

  return status;
}

function StatusPill({ status }: { status: StatusState }) {
  const isBusy = status === "busy";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card/70 px-3 py-1 shadow-xs backdrop-blur"
      data-testid="status-sister-marie"
    >
      <span
        className={[
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          isBusy ? "bg-amber-500" : "bg-emerald-500",
        ].join(" ")}
        data-testid="dot-status"
      >
        <span
          className={[
            "absolute inset-0 rounded-full",
            isBusy ? "animate-ping bg-amber-400/60" : "animate-pulse bg-emerald-400/60",
          ].join(" ")}
        />
      </span>

      <span
        className="text-sm font-medium text-foreground"
        data-testid="text-status"
      >
        {isBusy ? "With a pilgrim" : "Available now"}
      </span>
    </div>
  );
}

function SisterMarieAvatar() {
  return (
    <div
      className="relative mx-auto h-24 w-24 overflow-hidden rounded-2xl border border-card-border bg-gradient-to-b from-white/90 to-white/60 shadow-md"
      data-testid="img-sister-marie"
      aria-label="Sister Marie"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(30,94,255,0.14),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(43,140,255,0.12),transparent_55%)]" />
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/70 shadow-sm">
          <span
            className="font-serif text-lg font-bold tracking-tight text-foreground"
            data-testid="text-avatar-initials"
          >
            SM
          </span>
        </div>
      </div>
    </div>
  );
}

function SpeechCard() {
  return (
    <div className="mx-auto max-w-md">
      <div
        className="relative rounded-2xl border border-card-border bg-card/85 p-5 shadow-sm backdrop-blur"
        data-testid="card-speech"
      >
        <div className="absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t border-card-border bg-card/85" />
        <p
          className="text-[15px] leading-relaxed text-foreground"
          data-testid="text-intro-quote"
        >
          <span className="font-serif text-[15px]">
            “My name is Sister Marie. I’m with a small group of pilgrims who travel to
            the Grotto…”
          </span>
          <span className="mt-2 block text-xs text-muted-foreground" data-testid="text-voice-note">
            Her voice, her words
          </span>
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = useMemo(
    () => [
      {
        n: "①",
        title: "Share your intention",
        body: "Tell Sister Marie who you’re praying for.",
      },
      {
        n: "②",
        title: "We print your intention",
        body: "Your prayer is printed and prepared for the journey.",
      },
      {
        n: "③",
        title: "Carried to the Grotto",
        body: "Placed in the waters at Lourdes within 7 days.",
      },
    ],
    [],
  );

  return (
    <section className="mx-auto mt-10 w-full max-w-2xl" data-testid="section-how-it-works">
      <h2
        className="text-center font-serif text-xl font-bold tracking-tight text-foreground"
        data-testid="text-how-it-works"
      >
        How it works
      </h2>

      <div className="mt-6 grid gap-4">
        {steps.map((s) => (
          <Card
            key={s.n}
            className="border-card-border bg-card/80 p-5 shadow-sm backdrop-blur"
            data-testid={`card-step-${s.n}`}
          >
            <div className="flex items-start gap-4">
              <div
                className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground"
                data-testid={`badge-step-${s.n}`}
              >
                <span className="text-sm font-semibold" data-testid={`text-step-number-${s.n}`}>
                  {s.n}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-foreground" data-testid={`text-step-title-${s.n}`}>
                  {s.title}
                </div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground" data-testid={`text-step-body-${s.n}`}>
                  {s.body}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ContextBlock() {
  return (
    <section className="mx-auto mt-10 w-full max-w-2xl" data-testid="section-context">
      <div
        className="relative overflow-hidden rounded-2xl border border-card-border bg-card/80 p-6 shadow-sm backdrop-blur"
        data-testid="card-context"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(30,94,255,0.10),transparent_60%),radial-gradient(circle_at_90%_90%,rgba(43,140,255,0.10),transparent_55%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span data-testid="text-context-kicker">Lourdes, France</span>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground" data-testid="text-context-body">
            Since 1858, millions have traveled to Lourdes seeking healing. 70 verified
            miracles.
          </p>
        </div>
      </div>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="mx-auto mt-10 w-full max-w-2xl" data-testid="section-testimonial">
      <Card
        className="border-card-border bg-card/80 p-6 shadow-sm backdrop-blur"
        data-testid="card-testimonial"
      >
        <blockquote className="text-[15px] leading-relaxed text-foreground" data-testid="text-testimonial-quote">
          “I couldn’t afford to go to Lourdes myself. Knowing my mother’s name was
          carried there brought me peace.”
        </blockquote>
        <div className="mt-4 text-sm font-medium text-muted-foreground" data-testid="text-testimonial-attrib">
          — Maria T., California
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-12 w-full max-w-2xl pb-10" data-testid="footer">
      <div className="text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-footer-disclaimer">
        Messengers at Lourdes is independent. Not affiliated with the Sanctuary.
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <a href="#" className="hover:underline" data-testid="link-privacy">
          Privacy
        </a>
        <span aria-hidden="true">·</span>
        <a href="#" className="hover:underline" data-testid="link-terms">
          Terms
        </a>
      </div>
    </footer>
  );
}

export default function LanderPage() {
  const status = useSisterMarieAvailability();
  const ready = status === "available";

  return (
    <div className="min-h-screen bg-background" data-testid="page-lander">
      <div className="relative">
        <div className="absolute inset-0">
          <img
            src={heroSky}
            alt=""
            className="h-[440px] w-full object-cover"
            data-testid="img-hero-sky"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.75),rgba(255,255,255,0)_55%),radial-gradient(circle_at_70%_25%,rgba(30,94,255,0.14),rgba(255,255,255,0)_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/45 to-background" />
        </div>

        <header className="relative mx-auto w-full max-w-2xl px-4 pt-7" data-testid="header">
          <div className="flex items-center justify-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-2xl border border-card-border bg-card/75 shadow-sm backdrop-blur"
              data-testid="img-grotto-mark"
              aria-label="Lourdes grotto"
            >
              <img src={grottoMark} alt="" className="h-7 w-7" />
            </div>

            <div className="text-center">
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground"
                data-testid="text-brand"
              >
                Messengers at Lourdes
              </div>
            </div>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-2xl px-4 pb-10">
          <section className="pt-10" data-testid="section-hero">
            <SisterMarieAvatar />

            <div className="mt-4 flex justify-center">
              <StatusPill status={status} />
            </div>

            <div className="mt-6">
              <SpeechCard />
            </div>

            <div className="mt-6 text-center" data-testid="block-cta-copy">
              <p className="text-[15px] leading-relaxed text-foreground" data-testid="text-cta-copy">
                I’d be honored to hear what’s on your heart.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2" data-testid="block-cta">
              <Button
                size="lg"
                disabled={!ready}
                className={[
                  "min-h-11 w-full max-w-md rounded-xl px-6",
                  "shadow-md transition-all",
                  !ready ? "opacity-60" : "hover:-translate-y-0.5",
                ].join(" ")}
                data-testid="button-talk-to-sister-marie"
              >
                Talk to Sister Marie
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="text-xs text-muted-foreground" data-testid="text-cta-duration">
                Takes 3 minutes
              </div>
            </div>
          </section>

          <HowItWorks />

          <div className="mt-10" data-testid="section-water">
            <div className="relative overflow-hidden rounded-3xl border border-card-border bg-card/65 shadow-sm backdrop-blur">
              <img
                src={waterRipples}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
                data-testid="img-water-ripples"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/20 to-background/50" />

              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-white/70 shadow-sm">
                    <img src={grottoMark} alt="" className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                      data-testid="text-water-kicker"
                    >
                      Carried to the Grotto
                    </div>
                    <p
                      className="mt-2 text-[15px] leading-relaxed text-foreground"
                      data-testid="text-water-body"
                    >
                      Your intention is printed, prepared, and placed in the waters at
                      Lourdes within 7 days.
                    </p>
                    <div className="mt-3 text-xs text-muted-foreground" data-testid="text-water-note">
                      A small act of presence, from afar.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ContextBlock />
          <Testimonial />

          <section className="mx-auto mt-10 w-full max-w-2xl text-center" data-testid="section-final-cta">
            <div className="font-serif text-xl font-bold tracking-tight text-foreground" data-testid="text-final-cta-title">
              Your prayer deserves to be at Lourdes.
            </div>
            <div className="mt-2 text-sm text-muted-foreground" data-testid="text-final-cta-subtitle">
              Sister Marie is ready to listen.
            </div>

            <div className="mt-5 flex justify-center">
              <Button
                size="lg"
                disabled={!ready}
                className={[
                  "min-h-11 w-full max-w-md rounded-xl px-6",
                  "shadow-md transition-all",
                  !ready ? "opacity-60" : "hover:-translate-y-0.5",
                ].join(" ")}
                data-testid="button-talk-to-sister-marie-bottom"
              >
                Talk to Sister Marie
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <Footer />
        </main>
      </div>
    </div>
  );
}
