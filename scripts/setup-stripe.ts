/**
 * Stripe Products & Prices Setup Script
 *
 * Creates the 5 products needed for the Lourdes Chatbot:
 * 1. Prayer Delivery - Hardship ($28)
 * 2. Prayer Delivery - Full ($35)
 * 3. Prayer Delivery - Generous ($55)
 * 4. Blessed Miraculous Medal ($59)
 * 5. Candle at the Grotto ($19)
 *
 * Run: npx tsx scripts/setup-stripe.ts
 */

import "dotenv/config";
import Stripe from "stripe";

// Check for Stripe secret key
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("\n❌ STRIPE_SECRET_KEY not found in environment");
  console.log("\nTo set up Stripe:");
  console.log("1. Go to: https://dashboard.stripe.com/test/apikeys");
  console.log("2. Copy your Secret key (starts with sk_test_)");
  console.log("3. Add it to your .env file:");
  console.log("   STRIPE_SECRET_KEY=sk_test_...");
  console.log("\nThen run this script again.");
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  console.error("\n⚠️  Warning: Your key doesn't start with sk_test_");
  console.error("   Make sure you're using a TEST key, not a live key!");
  console.error("   Get test keys at: https://dashboard.stripe.com/test/apikeys\n");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Product definitions
const products = [
  {
    name: "Prayer Delivery - Hardship",
    description: "Have your prayer intention delivered to the Grotto of Lourdes. Hardship rate for those facing financial difficulties.",
    amount: 2800, // $28 in cents
    envKey: "STRIPE_PRICE_ID_28",
  },
  {
    name: "Prayer Delivery - Full",
    description: "Have your prayer intention delivered to the Grotto of Lourdes. Standard prayer delivery service.",
    amount: 3500, // $35 in cents
    envKey: "STRIPE_PRICE_ID_35",
  },
  {
    name: "Prayer Delivery - Generous",
    description: "Have your prayer intention delivered to the Grotto of Lourdes. Generous contribution to support our mission.",
    amount: 5500, // $55 in cents
    envKey: "STRIPE_PRICE_ID_55",
  },
  {
    name: "Blessed Miraculous Medal",
    description: "A blessed Miraculous Medal from the Grotto of Lourdes, shipped to your address.",
    amount: 5900, // $59 in cents
    envKey: "STRIPE_PRICE_ID_MEDAL",
  },
  {
    name: "Candle at the Grotto",
    description: "A candle lit in your name at the Grotto of Lourdes, burning alongside thousands of prayers.",
    amount: 1900, // $19 in cents
    envKey: "STRIPE_PRICE_ID_CANDLE",
  },
];

async function createProducts() {
  console.log("\n========================================");
  console.log("  Stripe Products & Prices Setup");
  console.log("========================================\n");

  const envLines: string[] = [];
  const createdProducts: { name: string; priceId: string; amount: number }[] = [];

  for (const productDef of products) {
    try {
      console.log(`Creating: ${productDef.name}...`);

      // Create the product
      const product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
      });

      // Create the price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: productDef.amount,
        currency: "usd",
      });

      console.log(`✅ ${productDef.name}`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Price ID: ${price.id}`);
      console.log(`   Amount: $${productDef.amount / 100}\n`);

      envLines.push(`${productDef.envKey}=${price.id}`);
      createdProducts.push({
        name: productDef.name,
        priceId: price.id,
        amount: productDef.amount,
      });

    } catch (error) {
      console.error(`❌ Failed to create ${productDef.name}:`, error);
      process.exit(1);
    }
  }

  // Output summary
  console.log("========================================");
  console.log("  Setup Complete! ✅");
  console.log("========================================\n");

  console.log("Add these lines to your .env file:\n");
  console.log("# Stripe Price IDs (created " + new Date().toLocaleDateString() + ")");
  envLines.forEach((line) => console.log(line));
  console.log();

  console.log("----------------------------------------");
  console.log("Summary of created products:");
  console.log("----------------------------------------");
  createdProducts.forEach((p) => {
    console.log(`  ${p.name}: $${p.amount / 100} → ${p.priceId}`);
  });
  console.log();

  console.log("Next steps:");
  console.log("1. Copy the price IDs above into your .env file");
  console.log("2. (Optional) Set up webhooks for payment confirmation:");
  console.log("   - Install Stripe CLI: https://stripe.com/docs/stripe-cli");
  console.log("   - Run: stripe listen --forward-to localhost:5000/api/webhook/stripe");
  console.log("   - Add the webhook secret (whsec_...) to STRIPE_WEBHOOK_SECRET in .env");
  console.log("3. Run: npm run dev");
  console.log("4. Test with card number: 4242 4242 4242 4242\n");
}

// Run the setup
createProducts().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
