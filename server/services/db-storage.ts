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

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export async function createSession(data?: Partial<InsertSession>): Promise<Session> {
  const [session] = await db
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
  const [session] = await db
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
  const [session] = await db
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
  const [session] = await db
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
  const [message] = await db
    .insert(messages)
    .values(data)
    .returning();
  return message;
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);
}

export async function getUserMessages(sessionId: string): Promise<Message[]> {
  return db
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
  const [prayer] = await db
    .insert(prayerIntentions)
    .values(data)
    .returning();
  return prayer;
}

export async function getPrayerIntention(id: number): Promise<PrayerIntention | undefined> {
  const [prayer] = await db
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.id, id))
    .limit(1);
  return prayer;
}

export async function getPrayerBySession(sessionId: string): Promise<PrayerIntention | undefined> {
  const [prayer] = await db
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
  const [prayer] = await db
    .update(prayerIntentions)
    .set(data)
    .where(eq(prayerIntentions.id, id))
    .returning();
  return prayer;
}

export async function getPendingPrayers(): Promise<PrayerIntention[]> {
  return db
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.status, "pending"))
    .orderBy(prayerIntentions.confirmedAt);
}

export async function getPaidPrayers(): Promise<PrayerIntention[]> {
  return db
    .select()
    .from(prayerIntentions)
    .where(eq(prayerIntentions.status, "paid"))
    .orderBy(prayerIntentions.confirmedAt);
}

// ============================================================================
// PAYMENT OPERATIONS
// ============================================================================

export async function createPayment(data: InsertPayment): Promise<Payment> {
  const [payment] = await db
    .insert(payments)
    .values(data)
    .returning();
  return payment;
}

export async function getPayment(id: number): Promise<Payment | undefined> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  return payment;
}

export async function getPaymentByStripeSession(
  stripeSessionId: string
): Promise<Payment | undefined> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, stripeSessionId))
    .limit(1);
  return payment;
}

export async function updatePayment(
  id: number,
  data: Partial<InsertPayment & { completedAt?: Date }>
): Promise<Payment | undefined> {
  const [payment] = await db
    .update(payments)
    .set(data)
    .where(eq(payments.id, id))
    .returning();
  return payment;
}

export async function getSessionPayments(sessionId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.sessionId, sessionId))
    .orderBy(payments.createdAt);
}
