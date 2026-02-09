import { Card } from "@/components/ui/card";

// Image mappings to assets
// In production, these would be actual images
const IMAGE_SOURCES: Record<string, { src: string; alt: string }> = {
  medal_front: {
    src: "/images/medal-front.jpg",
    alt: "Front of the Lourdes Healing Medal showing Our Lady appearing to Bernadette",
  },
  medal_back: {
    src: "/images/medal-back.jpg",
    alt: "Back of the Lourdes Healing Medal showing the water capsule",
  },
  bernadette_portrait: {
    src: "/images/bernadette_portrait.jpg",
    alt: "St. Bernadette Soubirous",
  },
  testimonial_medal: {
    src: "/images/testimonial-medal.png",
    alt: "Elderly hands holding the Lourdes Healing Medal",
  },
  testimonial_medal_self: {
    src: "/images/testimonial-medal-self.png",
    alt: "A woman wearing the Lourdes Healing Medal",
  },
  candle_grotto: {
    src: "/images/candle-grotto.png",
    alt: "A hand lighting a candle at the Grotto of Lourdes",
  },
  certificate: {
    src: "/images/certificate.jpg",
    alt: "Certificate of Authenticity for Lourdes water",
  },
};

interface UpsellImageProps {
  imageKey: string;
  className?: string;
}

export default function UpsellImage({ imageKey, className = "" }: UpsellImageProps) {
  const imageData = IMAGE_SOURCES[imageKey];

  if (!imageData) {
    return null;
  }

  return (
    <div className={`max-w-[85%] rounded-2xl overflow-hidden border border-card-border bg-card/85 shadow-sm ${className}`}>
      <img
        src={imageData.src}
        alt={imageData.alt}
        className="w-full max-w-[400px] h-auto"
        onError={(e) => {
          // Fallback to placeholder if image doesn't load
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const placeholder = target.nextElementSibling as HTMLElement;
          if (placeholder) {
            placeholder.style.display = "flex";
          }
        }}
      />
      {/* Placeholder shown if image fails to load */}
      <div
        className="hidden w-full max-w-[400px] h-[300px] items-center justify-center bg-secondary/50 text-muted-foreground text-sm p-4 text-center"
        aria-hidden="true"
      >
        {imageData.alt}
      </div>
    </div>
  );
}
