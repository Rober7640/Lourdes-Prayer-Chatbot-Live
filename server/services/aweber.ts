/**
 * AWeber Email Integration Service
 *
 * Handles subscriber management and email sequence triggering via AWeber API.
 *
 * Lists Structure:
 * - lourdes_chatbot_free (awlist6938934): Users who finalize their prayer (pre-payment)
 * - lourdes_chatbot_paid (awlist6938935): Users who purchase prayer ($28/$35/$55)
 * - lourdes_chatbot_upsell_medal (awlist6938937): Users who purchase medal upsell
 * - lourdes_chatbot_upsell_candle (awlist6938938): Users who purchase candle upsell
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const AWEBER_API_BASE = "https://api.aweber.com/1.0";

interface AweberConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  accountId: string;
}

function getConfig(): AweberConfig | null {
  const clientId = process.env.AWEBER_CLIENT_ID;
  const clientSecret = process.env.AWEBER_CLIENT_SECRET;
  const accessToken = process.env.AWEBER_ACCESS_TOKEN;
  const refreshToken = process.env.AWEBER_REFRESH_TOKEN;
  const accountId = process.env.AWEBER_ACCOUNT_ID;

  if (!clientId || !clientSecret || !accessToken || !refreshToken || !accountId) {
    return null;
  }

  return { clientId, clientSecret, accessToken, refreshToken, accountId };
}

// Store tokens in memory (should be persisted in production)
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;

function initializeTokens() {
  const config = getConfig();
  if (config) {
    currentAccessToken = config.accessToken;
    currentRefreshToken = config.refreshToken;
  }
}

// Initialize on module load
initializeTokens();

// ============================================================================
// TOKEN REFRESH
// ============================================================================

async function refreshAccessToken(): Promise<boolean> {
  const config = getConfig();
  if (!config || !currentRefreshToken) {
    console.error("AWeber not configured or no refresh token");
    return false;
  }

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

    const response = await fetch("https://auth.aweber.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: currentRefreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to refresh AWeber token:", errorText);
      return false;
    }

    const data = await response.json();
    currentAccessToken = data.access_token;
    currentRefreshToken = data.refresh_token;

    console.log("AWeber access token refreshed successfully");
    return true;
  } catch (error) {
    console.error("Error refreshing AWeber token:", error);
    return false;
  }
}

// ============================================================================
// API HELPERS
// ============================================================================

async function aweberRequest(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<any> {
  // Prevent infinite retry loops
  if (retryCount > 1) {
    throw new Error("AWeber API request failed after retry");
  }

  if (!currentAccessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new Error("AWeber not authenticated");
    }
  }

  const response = await fetch(`${AWEBER_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${currentAccessToken}`,
      "Content-Type": "application/json",
    },
  });

  // Handle token expiration - only retry once
  if (response.status === 401 && retryCount === 0) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new Error("Failed to refresh AWeber token");
    }
    // Retry with new token (increment retry count)
    return aweberRequest(endpoint, options, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AWeber API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

// ============================================================================
// TYPES
// ============================================================================

export type SubscriberList =
  | "free"           // Prayer finalized (pre-payment)
  | "paid"           // Purchased prayer ($28/$35/$55)
  | "upsell_medal"   // Purchased medal upsell
  | "upsell_candle"; // Purchased candle upsell

export interface SubscriberData {
  email: string;
  name?: string;
  customFields?: Record<string, string>;
  tags?: string[];
}

// ============================================================================
// LIST ID MAPPING
// ============================================================================

function getListId(list: SubscriberList): string | null {
  const listMap: Record<SubscriberList, string | undefined> = {
    free: process.env.AWEBER_LIST_ID_FREE,
    paid: process.env.AWEBER_LIST_ID_PAID,
    upsell_medal: process.env.AWEBER_LIST_ID_UPSELL_MEDAL,
    upsell_candle: process.env.AWEBER_LIST_ID_UPSELL_CANDLE,
  };
  return listMap[list] || null;
}

// ============================================================================
// SUBSCRIBER MANAGEMENT
// ============================================================================

/**
 * Add a subscriber to a specific list
 */
export async function addSubscriber(
  list: SubscriberList,
  data: SubscriberData
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log("AWeber not configured - skipping subscriber add");
    return false;
  }

  const listId = getListId(list);
  if (!listId) {
    console.error(`No list ID configured for: ${list}`);
    return false;
  }

  try {
    const subscriberData: any = {
      email: data.email,
      ws_op: "reactivate", // Reactivate if unsubscribed
    };

    if (data.name) {
      subscriberData.name = data.name;
    }

    if (data.customFields) {
      subscriberData.custom_fields = data.customFields;
    }

    if (data.tags && data.tags.length > 0) {
      subscriberData.tags = data.tags;
    }

    await aweberRequest(
      `/accounts/${config.accountId}/lists/${listId}/subscribers`,
      {
        method: "POST",
        body: JSON.stringify(subscriberData),
      }
    );

    console.log(`Added subscriber ${data.email} to list ${list}`);
    return true;
  } catch (error) {
    console.error(`Failed to add subscriber to ${list}:`, error);
    return false;
  }
}

/**
 * Add tags to an existing subscriber
 */
export async function addSubscriberTags(
  list: SubscriberList,
  email: string,
  tags: string[]
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log("AWeber not configured - skipping tag add");
    return false;
  }

  const listId = getListId(list);
  if (!listId) {
    console.error(`No list ID configured for: ${list}`);
    return false;
  }

  try {
    // First find the subscriber
    const searchResult = await aweberRequest(
      `/accounts/${config.accountId}/lists/${listId}/subscribers?ws.op=find&email=${encodeURIComponent(email)}`
    );

    if (!searchResult.entries || searchResult.entries.length === 0) {
      console.log(`Subscriber ${email} not found in list ${list}`);
      return false;
    }

    const subscriber = searchResult.entries[0];
    const existingTags: string[] = subscriber.tags || [];
    const tagSet = new Set([...existingTags, ...tags]);
    const newTags = Array.from(tagSet);

    // Update subscriber with new tags
    await aweberRequest(subscriber.self_link.replace(AWEBER_API_BASE, ""), {
      method: "PATCH",
      body: JSON.stringify({ tags: newTags }),
    });

    console.log(`Added tags [${tags.join(", ")}] to subscriber ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to add tags to subscriber:`, error);
    return false;
  }
}

/**
 * Add subscriber to the appropriate list based on purchase type
 */
export async function addToCustomerList(
  email: string,
  purchaseType: "prayer" | "medal" | "candle",
  data?: {
    name?: string;
    prayer?: string;
    tier?: string;
    stripePaymentId?: string; // pi_xxx payment intent ID
  }
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log("AWeber not configured - skipping customer add");
    return false;
  }

  // Determine target list based on purchase type
  const targetList: SubscriberList =
    purchaseType === "medal" ? "upsell_medal" :
    purchaseType === "candle" ? "upsell_candle" :
    "paid";

  try {
    const customFields: Record<string, string> = {};

    // Add prayer text only for the paid list
    if (purchaseType === "prayer" && data?.prayer) {
      customFields.prayer = data.prayer;
    }
    // Save stripe_payment_id for all purchase types (paid, medal, candle)
    if (data?.stripePaymentId) {
      customFields.stripe_payment_id = data.stripePaymentId;
    }

    const tags = [`purchased_${purchaseType}`, `converted_${new Date().toISOString().split("T")[0]}`];
    if (data?.tier) {
      tags.push(`tier_${data.tier}`);
    }

    // Add to customer list (this triggers the appropriate email sequence)
    const added = await addSubscriber(targetList, {
      email,
      name: data?.name,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      tags,
    });

    if (added) {
      console.log(`Added ${email} to ${targetList} list`);
    }

    // PATCH custom fields on the subscriber to ensure they are saved
    // AWeber's POST does not reliably set custom fields, so we find-then-PATCH
    if (Object.keys(customFields).length > 0) {
      try {
        const listId = getListId(targetList);
        if (listId) {
          const searchResult = await aweberRequest(
            `/accounts/${config.accountId}/lists/${listId}/subscribers?ws.op=find&email=${encodeURIComponent(email)}`
          );
          if (searchResult.entries && searchResult.entries.length > 0) {
            const subscriber = searchResult.entries[0];
            await aweberRequest(subscriber.self_link.replace(AWEBER_API_BASE, ""), {
              method: "PATCH",
              body: JSON.stringify({ custom_fields: customFields }),
            });
            console.log(`Patched custom fields for ${email} on ${targetList} list`);
          }
        }
      } catch (patchError) {
        console.error(`Failed to patch custom fields for ${email} on ${targetList}:`, patchError);
      }
    }

    return added;
  } catch (error) {
    console.error(`Failed to add subscriber to customer list:`, error);
    return false;
  }
}

/**
 * Add subscriber to free list when prayer is finalized (pre-payment)
 */
export async function addToFreeList(
  email: string,
  data: {
    name?: string;
    prayer: string;
    sessionId?: string;
    bucket?: string;
  }
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log("AWeber not configured - skipping free list add");
    return false;
  }

  try {
    const customFields: Record<string, string> = {
      prayer: data.prayer,
    };

    if (data.sessionId) {
      customFields.session_id = data.sessionId;
    }
    if (data.bucket) {
      customFields.prayer_bucket = data.bucket;
    }

    const added = await addSubscriber("free", {
      email,
      name: data.name,
      customFields,
      tags: ["prayer_finalized", `bucket_${data.bucket || "unknown"}`],
    });

    if (added) {
      console.log(`Added ${email} to free list with prayer`);
    }

    return added;
  } catch (error) {
    console.error(`Failed to add subscriber to free list:`, error);
    return false;
  }
}

/**
 * Update shipping address for a medal upsell subscriber
 * Called after shipping form is submitted
 */
export async function updateMedalShippingAddress(
  email: string,
  shipping: {
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  }
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log("AWeber not configured - skipping shipping address update");
    return false;
  }

  try {
    // Get the list ID for upsell_medal
    const listId = getListId("upsell_medal");
    if (!listId) {
      console.error("Medal upsell list ID not configured");
      return false;
    }

    // Find the subscriber
    const searchResult = await aweberRequest(
      `/accounts/${config.accountId}/lists/${listId}/subscribers?ws.op=find&email=${encodeURIComponent(email)}`
    );

    if (!searchResult.entries || searchResult.entries.length === 0) {
      console.log(`Subscriber ${email} not found in upsell_medal list`);
      return false;
    }

    const subscriber = searchResult.entries[0];

    // Format the shipping address as a single string
    const addressParts = [
      shipping.name,
      shipping.addressLine1,
      shipping.addressLine2,
      `${shipping.city}, ${shipping.state || ""} ${shipping.postalCode}`.trim(),
      shipping.country,
    ].filter(Boolean);
    const shippingAddress = addressParts.join(", ");

    // Preserve existing custom fields (e.g., stripe_payment_id) when patching
    const existingFields = subscriber.custom_fields || {};
    const updatedFields = {
      ...existingFields,
      shipping_address: shippingAddress,
    };

    // Update subscriber with shipping address custom field
    await aweberRequest(subscriber.self_link.replace(AWEBER_API_BASE, ""), {
      method: "PATCH",
      body: JSON.stringify({
        custom_fields: updatedFields,
      }),
    });

    console.log(`Updated shipping address for ${email} in upsell_medal list`);
    return true;
  } catch (error) {
    console.error(`Failed to update shipping address:`, error);
    return false;
  }
}

// ============================================================================
// EMAIL CAPTURE (LEAD) - DEPRECATED
// ============================================================================

/**
 * Capture email as a lead (pre-payment)
 * Note: Early lead capture is not currently used. Users are added to the free list
 * when they finalize their prayer via addToFreeList().
 */
export async function captureEmailLead(
  _email: string,
  _data: {
    name?: string;
    sessionId: string;
    bucket?: string;
    personName?: string;
  }
): Promise<boolean> {
  // Early lead capture not currently configured - users are added to free list
  // when prayer is finalized instead
  console.log("AWeber: Early lead capture skipped (not configured)");
  return true;
}

// ============================================================================
// MAGIC LINK GENERATION
// ============================================================================

/**
 * Generate a magic link for session resume
 */
export function generateMagicLink(sessionId: string, baseUrl: string): string {
  // Simple token-based link (in production, use signed tokens)
  const token = Buffer.from(`${sessionId}:${Date.now()}`).toString("base64url");
  return `${baseUrl}/chat/resume/${token}`;
}

/**
 * Parse a magic link token
 */
export function parseMagicLinkToken(token: string): { sessionId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [sessionId, timestampStr] = decoded.split(":");
    const timestamp = parseInt(timestampStr, 10);

    if (!sessionId || isNaN(timestamp)) {
      return null;
    }

    return { sessionId, timestamp };
  } catch {
    return null;
  }
}

// ============================================================================
// STATUS CHECK
// ============================================================================

export function isAweberEnabled(): boolean {
  return getConfig() !== null;
}
