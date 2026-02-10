import Stripe from "stripe";
import * as dbStorage from "./db-storage";
import { getSession, updateSession } from "./session";

// ============================================================================
// STRIPE CLIENT INITIALIZATION
// ============================================================================

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - payment features disabled");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ============================================================================
// TYPES
// ============================================================================

export type PaymentTier = "hardship" | "full" | "generous";
export type UpsellType = "medal" | "candle" | "pendant";

interface CheckoutConfig {
  sessionId: string;
  tier: PaymentTier;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

interface UpsellCheckoutConfig {
  sessionId: string;
  upsellType: UpsellType;
  email: string;
  successUrl: string;
  cancelUrl: string;
  // For medal - requires shipping address
  requiresShipping?: boolean;
}

// ============================================================================
// PRICE MAPPING
// ============================================================================

// Map tiers to Stripe price IDs (set in environment)
function getPriceId(tier: PaymentTier): string | null {
  const priceMap: Record<PaymentTier, string | undefined> = {
    hardship: process.env.STRIPE_PRICE_ID_28,
    full: process.env.STRIPE_PRICE_ID_35,
    generous: process.env.STRIPE_PRICE_ID_55,
  };
  return priceMap[tier] || null;
}

function getUpsellPriceId(type: UpsellType): string | null {
  const priceMap: Record<UpsellType, string | undefined> = {
    medal: process.env.STRIPE_PRICE_ID_MEDAL,
    candle: process.env.STRIPE_PRICE_ID_CANDLE,
    pendant: process.env.STRIPE_PRICE_ID_PENDANT,
  };
  return priceMap[type] || null;
}

function getTierAmount(tier: PaymentTier): number {
  const amounts: Record<PaymentTier, number> = {
    hardship: 2800,
    full: 3500,
    generous: 5500,
  };
  return amounts[tier];
}

function getUpsellAmount(type: UpsellType): number {
  const amounts: Record<UpsellType, number> = {
    medal: 7900,
    candle: 1900,
    pendant: 4900,
  };
  return amounts[type];
}

// ============================================================================
// CHECKOUT SESSION CREATION
// ============================================================================

export async function createCheckoutSession(
  config: CheckoutConfig
): Promise<{ url: string; checkoutSessionId: string } | null> {
  if (!stripe) {
    console.error("Stripe not initialized - cannot create checkout");
    return null;
  }

  const priceId = getPriceId(config.tier);
  if (!priceId) {
    console.error(`No price ID configured for tier: ${config.tier}`);
    return null;
  }

  const session = getSession(config.sessionId);
  if (!session) {
    console.error(`Session not found: ${config.sessionId}`);
    return null;
  }

  try {
    // Create or retrieve Stripe customer for one-click upsells
    let customerId = session.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: config.email,
        metadata: {
          chatSessionId: config.sessionId,
        },
      });
      customerId = customer.id;

      // Save customer ID to session
      updateSession(config.sessionId, { stripeCustomerId: customerId });

      const DB_ENABLED = !!process.env.DATABASE_URL;
      if (DB_ENABLED) {
        try {
          await dbStorage.updateSession(config.sessionId, {
            stripeCustomerId: customerId,
          });
        } catch (error) {
          console.error("Failed to save Stripe customer ID:", error);
        }
      }
    }

    // Create Stripe checkout session with customer and save payment method for future use
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: getTierAmount(config.tier),
            product_data: {
              name: "Prayer petition to the Lourdes Grotto",
            },
          },
          quantity: 1,
        },
      ],
      success_url: config.successUrl,
      cancel_url: config.cancelUrl,
      metadata: {
        chatSessionId: config.sessionId,
        tier: config.tier,
        type: "prayer",
      },
      // Save payment method for one-click upsells
      payment_intent_data: {
        setup_future_usage: "off_session",
        description: "Prayer petition to the Lourdes Grotto",
      },
    });

    // Create payment record in database
    const DB_ENABLED = !!process.env.DATABASE_URL;
    if (DB_ENABLED) {
      try {
        await dbStorage.createPayment({
          sessionId: config.sessionId,
          stripeSessionId: checkoutSession.id,
          amountCents: getTierAmount(config.tier),
          tier: config.tier,
          status: "pending",
        });
      } catch (error) {
        console.error("Failed to create payment record:", error);
      }
    }

    return {
      url: checkoutSession.url!,
      checkoutSessionId: checkoutSession.id,
    };
  } catch (error) {
    console.error("Failed to create Stripe checkout session:", error);
    return null;
  }
}

export async function createUpsellCheckoutSession(
  config: UpsellCheckoutConfig
): Promise<{ url: string; checkoutSessionId: string } | null> {
  if (!stripe) {
    console.error("Stripe not initialized - cannot create upsell checkout");
    return null;
  }

  const priceId = getUpsellPriceId(config.upsellType);
  if (!priceId) {
    console.error(`No price ID configured for upsell: ${config.upsellType}`);
    return null;
  }

  try {
    const checkoutConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: config.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: config.successUrl,
      cancel_url: config.cancelUrl,
      metadata: {
        chatSessionId: config.sessionId,
        type: config.upsellType,
      },
    };

    // Medal and pendant require shipping address
    if (config.upsellType === "medal" || config.upsellType === "pendant" || config.requiresShipping) {
      checkoutConfig.shipping_address_collection = {
        allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE", "FR", "DE", "IT", "ES"],
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutConfig);

    // Create payment record in database
    const DB_ENABLED = !!process.env.DATABASE_URL;
    if (DB_ENABLED) {
      try {
        await dbStorage.createPayment({
          sessionId: config.sessionId,
          stripeSessionId: checkoutSession.id,
          amountCents: getUpsellAmount(config.upsellType),
          tier: config.upsellType,
          status: "pending",
        });
      } catch (error) {
        console.error("Failed to create upsell payment record:", error);
      }
    }

    return {
      url: checkoutSession.url!,
      checkoutSessionId: checkoutSession.id,
    };
  } catch (error) {
    console.error("Failed to create upsell checkout session:", error);
    return null;
  }
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe or webhook secret not configured");
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return null;
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<{
  success: boolean;
  sessionId?: string;
  type?: string;
  tier?: string;
  paymentIntentId?: string;
}> {
  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      return handleCheckoutCompleted(checkoutSession);
    }

    case "checkout.session.expired": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      return handleCheckoutExpired(checkoutSession);
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return handlePaymentIntentSucceeded(paymentIntent);
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
      return { success: true };
  }
}

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session
): Promise<{ success: boolean; sessionId?: string; type?: string; tier?: string; paymentIntentId?: string }> {
  const chatSessionId = checkoutSession.metadata?.chatSessionId;
  const purchaseType = checkoutSession.metadata?.type;
  const tier = checkoutSession.metadata?.tier;
  const paymentIntentId = checkoutSession.payment_intent as string | undefined;

  if (!chatSessionId) {
    console.error("No chatSessionId in checkout metadata");
    return { success: false };
  }

  console.log(`Payment completed for session ${chatSessionId}, type: ${purchaseType}`);

  const DB_ENABLED = !!process.env.DATABASE_URL;

  // Extract shipping info if present (for medal fallback checkout)
  const shippingDetails = checkoutSession.shipping_details;
  const shippingData: Record<string, string | null> = {};
  if (shippingDetails?.address) {
    shippingData.shippingName = shippingDetails.name || null;
    shippingData.shippingAddressLine1 = shippingDetails.address.line1 || null;
    shippingData.shippingAddressLine2 = shippingDetails.address.line2 || null;
    shippingData.shippingCity = shippingDetails.address.city || null;
    shippingData.shippingState = shippingDetails.address.state || null;
    shippingData.shippingPostalCode = shippingDetails.address.postal_code || null;
    shippingData.shippingCountry = shippingDetails.address.country || null;
    console.log(`Shipping info captured for session ${chatSessionId}`);
  }

  // Update payment record
  if (DB_ENABLED) {
    try {
      const payment = await dbStorage.getPaymentByStripeSession(checkoutSession.id);
      if (payment) {
        await dbStorage.updatePayment(payment.id, {
          status: "completed",
          stripePaymentId: checkoutSession.payment_intent as string,
          completedAt: new Date(),
        });
      }

      // Update session payment status and shipping info if present
      const sessionUpdate: Record<string, any> = {
        paymentStatus: "completed",
      };
      if (Object.keys(shippingData).length > 0) {
        Object.assign(sessionUpdate, shippingData);
      }
      // Save Stripe customer ID if present (for future one-click)
      if (checkoutSession.customer) {
        sessionUpdate.stripeCustomerId = checkoutSession.customer as string;
      }
      await dbStorage.updateSession(chatSessionId, sessionUpdate);

      // Update prayer intention status if main payment
      if (purchaseType === "prayer") {
        const prayer = await dbStorage.getPrayerBySession(chatSessionId);
        if (prayer) {
          await dbStorage.updatePrayerIntention(prayer.id, {
            status: "paid",
          });
        }
      }
    } catch (error) {
      console.error("Failed to update payment records:", error);
    }
  }

  // Update in-memory session
  const memoryUpdate: Record<string, any> = {
    paymentStatus: "completed",
  };
  if (checkoutSession.customer) {
    memoryUpdate.stripeCustomerId = checkoutSession.customer as string;
  }
  updateSession(chatSessionId, memoryUpdate);

  return {
    success: true,
    sessionId: chatSessionId,
    type: purchaseType,
    tier,
    paymentIntentId,
  };
}

async function handleCheckoutExpired(
  checkoutSession: Stripe.Checkout.Session
): Promise<{ success: boolean; sessionId?: string }> {
  const chatSessionId = checkoutSession.metadata?.chatSessionId;

  if (!chatSessionId) {
    return { success: false };
  }

  console.log(`Checkout expired for session ${chatSessionId}`);

  const DB_ENABLED = !!process.env.DATABASE_URL;

  if (DB_ENABLED) {
    try {
      const payment = await dbStorage.getPaymentByStripeSession(checkoutSession.id);
      if (payment) {
        await dbStorage.updatePayment(payment.id, {
          status: "expired",
        });
      }
    } catch (error) {
      console.error("Failed to update expired payment:", error);
    }
  }

  return {
    success: true,
    sessionId: chatSessionId,
  };
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; sessionId?: string; type?: string; paymentIntentId?: string }> {
  const chatSessionId = paymentIntent.metadata?.chatSessionId;
  const purchaseType = paymentIntent.metadata?.type;

  if (!chatSessionId) {
    // This might be a payment from checkout session - those are handled by checkout.session.completed
    console.log("PaymentIntent without chatSessionId metadata - likely handled by checkout webhook");
    return { success: true };
  }

  console.log(`PaymentIntent succeeded for session ${chatSessionId}, type: ${purchaseType}`);

  const DB_ENABLED = !!process.env.DATABASE_URL;

  if (DB_ENABLED) {
    try {
      // Find and update the payment record by stripePaymentId
      const payment = await dbStorage.getPaymentByStripePaymentId(paymentIntent.id);
      if (payment) {
        await dbStorage.updatePayment(payment.id, {
          status: "completed",
          completedAt: new Date(),
        });
        console.log(`Updated payment record ${payment.id} to completed`);
      } else {
        console.log(`No payment record found for PaymentIntent ${paymentIntent.id}`);
      }
    } catch (error) {
      console.error("Failed to update payment from PaymentIntent:", error);
    }
  }

  return {
    success: true,
    sessionId: chatSessionId,
    type: purchaseType,
    paymentIntentId: paymentIntent.id,
  };
}

// ============================================================================
// STRIPE CUSTOMER SHIPPING UPDATE
// ============================================================================

export async function updateStripeCustomerShipping(
  customerId: string,
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
  if (!stripe) {
    console.error("Stripe not initialized - cannot update customer shipping");
    return false;
  }

  try {
    await stripe.customers.update(customerId, {
      shipping: {
        name: shipping.name,
        address: {
          line1: shipping.addressLine1,
          line2: shipping.addressLine2 || undefined,
          city: shipping.city,
          state: shipping.state || undefined,
          postal_code: shipping.postalCode,
          country: shipping.country,
        },
      },
    });
    console.log(`Updated Stripe customer ${customerId} with shipping address`);
    return true;
  } catch (error) {
    console.error("Failed to update Stripe customer shipping:", error);
    return false;
  }
}

// ============================================================================
// ONE-CLICK UPSELL CHARGE
// ============================================================================

interface OneClickChargeConfig {
  sessionId: string;
  upsellType: UpsellType;
}

interface OneClickChargeResult {
  success: boolean;
  requiresCheckout: boolean;
  paymentIntentId?: string;
  error?: string;
}

export async function chargeOneClickUpsell(
  config: OneClickChargeConfig
): Promise<OneClickChargeResult> {
  if (!stripe) {
    return { success: false, requiresCheckout: true, error: "Stripe not initialized" };
  }

  const session = getSession(config.sessionId);
  if (!session) {
    return { success: false, requiresCheckout: true, error: "Session not found" };
  }

  // Check if we have a customer ID with saved payment method
  if (!session.stripeCustomerId) {
    console.log("No saved customer - requires checkout");
    return { success: false, requiresCheckout: true, error: "No saved payment method" };
  }

  try {
    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(session.stripeCustomerId);
    if (customer.deleted) {
      return { success: false, requiresCheckout: true, error: "Customer deleted" };
    }

    // Get payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: session.stripeCustomerId,
      type: "card",
    });

    if (paymentMethods.data.length === 0) {
      console.log("No saved payment methods - requires checkout");
      return { success: false, requiresCheckout: true, error: "No saved payment method" };
    }

    const paymentMethodId = paymentMethods.data[0].id;
    const amount = getUpsellAmount(config.upsellType);

    // Get description based on upsell type
    const upsellDescriptions: Record<UpsellType, string> = {
      medal: "Lourdes Medal",
      candle: "Candle Lighting",
      pendant: "Archangel Michael Pendant",
    };

    // Create payment intent and charge immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: session.stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: upsellDescriptions[config.upsellType],
      metadata: {
        chatSessionId: config.sessionId,
        type: config.upsellType,
      },
    });

    console.log(`One-click charge successful: ${paymentIntent.id} for ${config.upsellType}`);

    // Create payment record in database with completedAt timestamp
    const DB_ENABLED = !!process.env.DATABASE_URL;
    if (DB_ENABLED) {
      try {
        const paymentRecord = await dbStorage.createPayment({
          sessionId: config.sessionId,
          stripePaymentId: paymentIntent.id,
          amountCents: amount,
          tier: config.upsellType,
          status: "completed",
          completedAt: new Date(),
        });
        console.log(`Payment record created: ID ${paymentRecord.id}, stripePaymentId: ${paymentRecord.stripePaymentId}`);
      } catch (error: any) {
        console.error("Failed to create one-click payment record:", error.message || error);
        console.error("Full error:", JSON.stringify(error, null, 2));
      }
    }

    return {
      success: true,
      requiresCheckout: false,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error("One-click charge failed:", error.message);

    // If card requires authentication or any error, fallback to checkout
    if (error.code === "authentication_required" ||
        error.code === "card_declined" ||
        error.type === "StripeCardError") {
      return {
        success: false,
        requiresCheckout: true,
        error: error.message
      };
    }

    return {
      success: false,
      requiresCheckout: true,
      error: error.message
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function isStripeEnabled(): boolean {
  return stripe !== null;
}

// ============================================================================
// RETRIEVE PAYMENT DETAILS FROM CHECKOUT SESSION
// ============================================================================

/**
 * Retrieve payment details from a completed checkout session.
 * Used when returning from Stripe checkout to get the payment_intent ID.
 */
export async function retrieveCheckoutSession(
  checkoutSessionId: string
): Promise<{
  paymentIntentId: string | null;
  customerId: string | null;
  paymentStatus: string;
} | null> {
  if (!stripe) {
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    return {
      paymentIntentId: session.payment_intent as string | null,
      customerId: session.customer as string | null,
      paymentStatus: session.payment_status || "unknown",
    };
  } catch (error) {
    console.error("Failed to retrieve checkout session:", error);
    return null;
  }
}

// ============================================================================
// UPDATE PAYMENT INTENT WITH SHIPPING
// ============================================================================

/**
 * Update a PaymentIntent with shipping information.
 * This makes shipping show in Stripe dashboard for the payment.
 */
export async function updatePaymentIntentShipping(
  paymentIntentId: string,
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
  if (!stripe) {
    console.error("Stripe not initialized");
    return false;
  }

  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      shipping: {
        name: shipping.name,
        address: {
          line1: shipping.addressLine1,
          line2: shipping.addressLine2 || undefined,
          city: shipping.city,
          state: shipping.state || undefined,
          postal_code: shipping.postalCode,
          country: shipping.country,
        },
      },
    });
    console.log(`Updated PaymentIntent ${paymentIntentId} with shipping address`);
    return true;
  } catch (error) {
    console.error("Failed to update PaymentIntent shipping:", error);
    return false;
  }
}

export { getUpsellAmount };
