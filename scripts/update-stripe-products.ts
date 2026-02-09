import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function updateProductNames() {
  console.log("Updating Stripe product names...\n");

  // Get all products
  const products = await stripe.products.list({ limit: 100 });

  for (const product of products.data) {
    let newName: string | null = null;

    // Match by current name or price to determine which product to update
    if (
      product.name.includes("Hardship") ||
      product.name.includes("Full") ||
      product.name.includes("Generous") ||
      product.name.includes("Prayer Delivery")
    ) {
      newName = "Prayer petition to the Lourdes Grotto";
    } else if (product.name.includes("Medal")) {
      newName = "Lourdes Medal";
    } else if (product.name.includes("Candle")) {
      newName = "Candle Lighting";
    }

    if (newName && product.name !== newName) {
      console.log(`Updating "${product.name}" → "${newName}"`);
      await stripe.products.update(product.id, {
        name: newName,
      });
      console.log(`  ✓ Updated ${product.id}\n`);
    } else if (newName) {
      console.log(`"${product.name}" already correct, skipping.\n`);
    }
  }

  console.log("Done!");
}

updateProductNames().catch(console.error);
