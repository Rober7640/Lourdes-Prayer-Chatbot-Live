import "dotenv/config";
import { db } from "../server/db";
import { sessions, prayerIntentions, payments } from "../shared/schema";
import { sql } from "drizzle-orm";

async function check() {
  console.log("\n=== Sessions with Email ===");
  const emailSessions = await db.select().from(sessions).where(sql`${sessions.userEmail} IS NOT NULL`);
  emailSessions.forEach(s => {
    console.log(`ID: ${s.id}`);
    console.log(`  User: ${s.userName} | Email: ${s.userEmail}`);
    console.log(`  Phase: ${s.phase} | Payment: ${s.paymentStatus}`);
    console.log("");
  });

  console.log("=== All Prayers ===");
  const allPrayers = await db.select().from(prayerIntentions);
  allPrayers.forEach(p => {
    console.log(`ID: ${p.id} | Session: ${p.sessionId}`);
    console.log(`  For: ${p.personName} (${p.relationship})`);
    console.log(`  Status: ${p.status}`);
    console.log("");
  });

  console.log("=== All Payments ===");
  const allPayments = await db.select().from(payments);
  allPayments.forEach(p => {
    console.log(`ID: ${p.id} | Session: ${p.sessionId}`);
    console.log(`  Amount: $${p.amountCents / 100} | Tier: ${p.tier}`);
    console.log(`  Status: ${p.status}`);
    console.log("");
  });

  process.exit(0);
}

check();
