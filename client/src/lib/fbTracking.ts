/**
 * Facebook Pixel client-side tracking utility.
 *
 * Fires browser-side pixel events alongside the server CAPI calls.
 * Deduplication is achieved by sharing the same event_id between both.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

// ============================================================================
// PRICE MAPS
// ============================================================================

export const TIER_AMOUNTS: Record<string, number> = {
  hardship: 28,
  full: 35,
  generous: 55,
};

export const UPSELL_AMOUNTS: Record<string, number> = {
  medal: 79,
  candle: 19,
};

// ============================================================================
// HELPERS
// ============================================================================

/** Generate a UUID v4 for event deduplication */
export function generateFbEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Read the _fbc cookie (click ID) */
export function getFbc(): string | undefined {
  return getCookie("_fbc") || undefined;
}

/** Read the _fbp cookie (browser ID) */
export function getFbp(): string | undefined {
  return getCookie("_fbp") || undefined;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Return an object with FB fields to spread into API request bodies.
 * If eventId is provided, it's included as fbEventId.
 */
export function getFbFields(eventId?: string): Record<string, string | undefined> {
  return {
    ...(eventId ? { fbEventId: eventId } : {}),
    fbc: getFbc(),
    fbp: getFbp(),
    fbSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

// ============================================================================
// PIXEL EVENT HELPERS
// ============================================================================

function fbq(...args: any[]) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq(...args);
  }
}

export function trackLead(eventId: string): void {
  fbq("track", "Lead", { content_name: "prayer_email" }, { eventID: eventId });
}

export function trackInitiateCheckout(
  eventId: string,
  tier: string,
  value: number
): void {
  fbq(
    "track",
    "InitiateCheckout",
    {
      value,
      currency: "USD",
      content_type: "product",
      content_ids: [`prayer_${tier}`],
    },
    { eventID: eventId }
  );
}

export function trackPurchase(
  eventId: string,
  value: number,
  contentId: string
): void {
  fbq(
    "track",
    "Purchase",
    {
      value,
      currency: "USD",
      content_type: "product",
      content_ids: [contentId],
    },
    { eventID: eventId }
  );
}
