import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, uuid, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// USERS (existing)
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// SESSIONS - Chat session with user info and state
// ============================================================================

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userName: varchar("user_name", { length: 100 }),
  userEmail: varchar("user_email", { length: 255 }),
  bucket: varchar("bucket", { length: 50 }),
  phase: varchar("phase", { length: 50 }).default("welcome").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// ============================================================================
// MESSAGES - Every message in the conversation
// ============================================================================

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  role: varchar("role", { length: 10 }).notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  phase: varchar("phase", { length: 50 }),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ============================================================================
// PRAYER INTENTIONS - The confirmed prayer for fulfillment
// ============================================================================

export const prayerIntentions = pgTable("prayer_intentions", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  personName: varchar("person_name", { length: 100 }),
  relationship: varchar("relationship", { length: 100 }),
  situation: text("situation"),
  prayerText: text("prayer_text").notNull(),
  prayerSource: varchar("prayer_source", { length: 10 }).notNull(), // 'claude' or 'user'
  bucket: varchar("bucket", { length: 50 }),
  confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
});

export const insertPrayerIntentionSchema = createInsertSchema(prayerIntentions).omit({
  id: true,
  confirmedAt: true,
  fulfilledAt: true,
});

export type InsertPrayerIntention = z.infer<typeof insertPrayerIntentionSchema>;
export type PrayerIntention = typeof prayerIntentions.$inferSelect;

// ============================================================================
// PAYMENTS - Payment records for Stripe integration
// ============================================================================

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  prayerId: integer("prayer_id").references(() => prayerIntentions.id),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
  amountCents: integer("amount_cents").notNull(),
  tier: varchar("tier", { length: 20 }).notNull(), // 'hardship', 'full', 'generous'
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
