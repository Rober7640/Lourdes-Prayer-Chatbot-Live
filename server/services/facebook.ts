/**
 * Facebook Conversions API (CAPI) Service
 *
 * Sends server-side events to Facebook for attribution.
 * Works alongside the browser pixel with event deduplication via shared event_id.
 */

import { createHash } from "crypto";
import type { Request } from "express";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PIXEL_ID = process.env.FACEBOOK_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || "";
const TEST_EVENT_CODE = process.env.FACEBOOK_TEST_EVENT_CODE || "";
const API_VERSION = "v21.0";
const ENDPOINT = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

export function isFacebookEnabled(): boolean {
  return !!(PIXEL_ID && ACCESS_TOKEN);
}

// ============================================================================
// HELPERS
// ============================================================================

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Extract Facebook-relevant data from an Express request.
 * Returns clientIp, userAgent, fbc, fbp, and sourceUrl.
 */
export function extractFbRequestData(req: Request): {
  clientIp: string;
  userAgent: string;
  fbc?: string;
  fbp?: string;
  sourceUrl?: string;
} {
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "";
  const userAgent = req.headers["user-agent"] || "";

  return {
    clientIp,
    userAgent,
    fbc: req.body?.fbc || undefined,
    fbp: req.body?.fbp || undefined,
    sourceUrl: req.body?.fbSourceUrl || undefined,
  };
}

// ============================================================================
// SEND EVENT
// ============================================================================

export interface SendEventOptions {
  eventName: string;
  eventId: string;
  email?: string;
  userName?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  sourceUrl?: string;
  customData?: Record<string, any>;
}

export async function sendEvent(options: SendEventOptions): Promise<void> {
  if (!isFacebookEnabled()) return;

  const {
    eventName,
    eventId,
    email,
    userName,
    clientIp,
    userAgent,
    fbc,
    fbp,
    sourceUrl,
    customData,
  } = options;

  // Build user_data with hashed PII per Facebook spec
  const userData: Record<string, any> = {};
  if (email) userData.em = [sha256(email)];
  if (userName) {
    const parts = userName.trim().split(/\s+/);
    if (parts[0]) userData.fn = [sha256(parts[0])];
    if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
  }
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const eventData: Record<string, any> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
  };

  if (sourceUrl) eventData.event_source_url = sourceUrl;
  if (customData) eventData.custom_data = customData;

  const payload = {
    data: [eventData],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    access_token: ACCESS_TOKEN,
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Facebook CAPI ${eventName} error ${response.status}:`, errorText);
    } else {
      console.log(`Facebook CAPI ${eventName} sent (event_id=${eventId})`);
    }
  } catch (err) {
    console.error(`Facebook CAPI ${eventName} network error:`, err);
  }
}
