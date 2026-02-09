import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
  sessions,
  messages,
  prayerIntentions,
  payments,
  type InsertSession,
  type InsertMessage,
  type InsertPrayerIntention,
  type InsertPayment,
  type Session,
  type Message,
  type PrayerIntention,
  type Payment,
} from "@shared/schema";

// Helper to check if database is available
function requireDb() {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export async function createSession(data?: Partial<InsertSession>): Promise<Session> {
  const database = requireDb();
  const [session] = await database
    .insert(sessions)
    .values({
      userName: data?.userName || null,
      userEmail: data?.userEmail || null,
      bucket: data?.bucket || null,
      phase: data?.phase || "welcome",
      status: data?.status || "active",
      paymentStatus: data?.paymentStatus || null,
    })
    .returning();
  return session;
}

export async function getSession(id: string): Promise<Session | undefined> {
  const database = requireDb();
  const [session] = await database
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return session;
}

export async function updateSession(
  id: string,
  data: Partial<InsertSession>
): Promise<Session | undefined> {
  const database = requireDb();
  const [session] = await database
    .update(sessions)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, id))
    .returning();
  return session;
}

export async function getSessionByEmail(email: string): Promise<Session | undefined> {
  const database = requireDb();
  const [session] = await database
    .select()
    .from(sessions)
    .where(eq(sessions.userEmail, email))
    .orderBy(desc(sessions.createdAt))
    .limit(1);
  return session;
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export async function saveMessage(data: InsertMessage): Promise<Message> {
  const database = requireDb();
  const [message] = await database
    .insert(messages)
    .values(data)
    .returning();
  return message;
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  const database = requireDb();
  return database
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);
}

export async function getUserMessages(sessionId: string): Promise<Message[]> {
  const database = requireDb();
  return database
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
    .then((msgs) => msgs.filter((m) => m.role === "user"));
}

// ============================================================================
// PRAYER INTENTION OPERATIONS
// ============================================================================

export async function savePrayerIntention(
  data: InsertPrayerIntention
): Promise<PrayerIntention> {
  const database = requireDb();
  const [prayer] = await database
    .insert(prayerIntentions)
    .values(data)
    .returning();
  return prayer;
}

export async function getPrayerIntention(id: number): Promise<PrayerIntention | undefined> {
  const database = requireDb();
  const [prayer] = await database
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.id, id))
    .limit(1);
  return prayer;
}

export async function getPrayerBySession(sessionId: string): Promise<PrayerIntention | undefined> {
  const database = requireDb();
  const [prayer] = await database
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.sessionId, sessionId))
    .orderBy(desc(prayerIntentions.confirmedAt))
    .limit(1);
  return prayer;
}

export async function updatePrayerIntention(
  id: number,
  data: Partial<InsertPrayerIntention & { fulfilledAt?: Date }>
): Promise<PrayerIntention | undefined> {
  const database = requireDb();
  const [prayer] = await database
    .update(prayerIntentions)
    .set(data)
    .where(eq(prayerIntentions.id, id))
    .returning();
  return prayer;
}

export async function getPendingPrayers(): Promise<PrayerIntention[]> {
  const database = requireDb();
  return database
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.status, "pending"))
    .orderBy(prayerIntentions.confirmedAt);
}

export async function getPaidPrayers(): Promise<PrayerIntention[]> {
  const database = requireDb();
  return database
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.status, "paid"))
    .orderBy(prayerIntentions.confirmedAt);
}

// ============================================================================
// PAYMENT OPERATIONS
// ============================================================================

export async function createPayment(data: InsertPayment): Promise<Payment> {
  const database = requireDb();
  console.log("Creating payment with data:", JSON.stringify(data, null, 2));
  try {
    const [payment] = await database
      .insert(payments)
      .values(data)
      .returning();
    console.log("Payment created successfully:", payment.id);
    return payment;
  } catch (error: any) {
    console.error("Database error creating payment:", error.message);
    throw error;
  }
}

export async function getPayment(id: number): Promise<Payment | undefined> {
  const database = requireDb();
  const [payment] = await database
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  return payment;
}

export async function getPaymentByStripeSession(
  stripeSessionId: string
): Promise<Payment | undefined> {
  const database = requireDb();
  const [payment] = await database
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, stripeSessionId))
    .limit(1);
  return payment;
}

export async function getPaymentByStripePaymentId(
  stripePaymentId: string
): Promise<Payment | undefined> {
  const database = requireDb();
  const [payment] = await database
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentId, stripePaymentId))
    .limit(1);
  return payment;
}

export async function updatePayment(
  id: number,
  data: Partial<InsertPayment & { completedAt?: Date }>
): Promise<Payment | undefined> {
  const database = requireDb();
  const [payment] = await database
    .update(payments)
    .set(data)
    .where(eq(payments.id, id))
    .returning();
  return payment;
}

export async function getSessionPayments(sessionId: string): Promise<Payment[]> {
  const database = requireDb();
  return database
    .select()
    .from(payments)
    .where(eq(payments.sessionId, sessionId))
    .orderBy(payments.createdAt);
}
