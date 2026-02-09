/**
 * Database Integration Test Script
 * Tests that Supabase connection is working by:
 * 1. Creating a test session
 * 2. Saving test messages
 * 3. Creating a test prayer intention
 * 4. Creating a test payment
 * 5. Reading back all data to verify persistence
 */

import "dotenv/config";
import { db } from "../server/db";
import {
  createSession,
  getSession,
  saveMessage,
  getSessionMessages,
  savePrayerIntention,
  getPrayerBySession,
  createPayment,
  getSessionPayments,
} from "../server/services/db-storage";

async function runTests() {
  console.log("\n========================================");
  console.log("  Supabase Database Integration Tests");
  console.log("========================================\n");

  // Check if database is connected
  if (!db) {
    console.error("❌ DATABASE_URL not set or connection failed");
    console.log("   Make sure DATABASE_URL is set in your .env file");
    process.exit(1);
  }
  console.log("✅ Database connection established\n");

  let testSessionId: string | null = null;
  let testPrayerId: number | null = null;

  try {
    // Test 1: Create a session
    console.log("Test 1: Creating session...");
    const session = await createSession({
      userName: "Test User",
      userEmail: "test@example.com",
      bucket: "health",
      phase: "prayer_writing",
      status: "active",
    });
    testSessionId = session.id;
    console.log(`✅ Session created with ID: ${session.id}`);
    console.log(`   User: ${session.userName}, Email: ${session.userEmail}`);
    console.log(`   Phase: ${session.phase}, Bucket: ${session.bucket}\n`);

    // Test 2: Retrieve the session
    console.log("Test 2: Retrieving session...");
    const retrievedSession = await getSession(session.id);
    if (retrievedSession && retrievedSession.id === session.id) {
      console.log(`✅ Session retrieved successfully`);
      console.log(`   Created at: ${retrievedSession.createdAt}\n`);
    } else {
      throw new Error("Session retrieval failed");
    }

    // Test 3: Save messages
    console.log("Test 3: Saving messages...");
    const userMessage = await saveMessage({
      sessionId: session.id,
      role: "user",
      content: "I would like to pray for my mother's health.",
      phase: "intake",
    });
    console.log(`✅ User message saved (ID: ${userMessage.id})`);

    const assistantMessage = await saveMessage({
      sessionId: session.id,
      role: "assistant",
      content: "I'm so sorry to hear about your mother. Can you tell me more about her situation?",
      phase: "intake",
    });
    console.log(`✅ Assistant message saved (ID: ${assistantMessage.id})\n`);

    // Test 4: Retrieve messages
    console.log("Test 4: Retrieving messages...");
    const messages = await getSessionMessages(session.id);
    console.log(`✅ Retrieved ${messages.length} messages`);
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });
    console.log();

    // Test 5: Create prayer intention
    console.log("Test 5: Creating prayer intention...");
    const prayer = await savePrayerIntention({
      sessionId: session.id,
      personName: "Maria",
      relationship: "Mother",
      situation: "Health challenges",
      prayerText: "Loving God, we lift up Maria to Your healing presence...",
      prayerSource: "claude",
      bucket: "health",
      status: "pending",
    });
    testPrayerId = prayer.id;
    console.log(`✅ Prayer intention created (ID: ${prayer.id})`);
    console.log(`   For: ${prayer.personName} (${prayer.relationship})`);
    console.log(`   Bucket: ${prayer.bucket}\n`);

    // Test 6: Retrieve prayer intention
    console.log("Test 6: Retrieving prayer intention...");
    const retrievedPrayer = await getPrayerBySession(session.id);
    if (retrievedPrayer && retrievedPrayer.id === prayer.id) {
      console.log(`✅ Prayer intention retrieved successfully`);
      console.log(`   Prayer text: ${retrievedPrayer.prayerText.substring(0, 50)}...\n`);
    } else {
      throw new Error("Prayer intention retrieval failed");
    }

    // Test 7: Create payment record
    console.log("Test 7: Creating payment record...");
    const payment = await createPayment({
      sessionId: session.id,
      prayerId: prayer.id,
      stripeSessionId: "test_stripe_session_123",
      amountCents: 2900,
      tier: "full",
      status: "pending",
    });
    console.log(`✅ Payment record created (ID: ${payment.id})`);
    console.log(`   Amount: $${payment.amountCents / 100}, Tier: ${payment.tier}\n`);

    // Test 8: Retrieve payments
    console.log("Test 8: Retrieving payments...");
    const payments = await getSessionPayments(session.id);
    console.log(`✅ Retrieved ${payments.length} payment(s)`);
    payments.forEach((p) => {
      console.log(`   - Payment ${p.id}: $${p.amountCents / 100} (${p.status})`);
    });
    console.log();

    // Summary
    console.log("========================================");
    console.log("  All Tests Passed! ✅");
    console.log("========================================");
    console.log("\nData saved to Supabase:");
    console.log(`  - Session ID: ${session.id}`);
    console.log(`  - Messages: ${messages.length}`);
    console.log(`  - Prayer ID: ${prayer.id}`);
    console.log(`  - Payment ID: ${payment.id}`);
    console.log("\nCheck your Supabase dashboard to see the data:");
    console.log("  https://supabase.com/dashboard → Your Project → Table Editor");
    console.log();

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
