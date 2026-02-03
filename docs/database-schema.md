# Database Schema

This document describes the PostgreSQL database schema for the Lourdes Chatbot application.

---

## Overview

The database stores chat sessions, conversation messages, prayer intentions, and payment records.

```
sessions (1) ──── (many) messages
sessions (1) ──── (1) prayer_intentions
sessions (1) ──── (many) payments
prayer_intentions (1) ──── (many) payments
```

---

## Tables

### 1. `sessions`

Stores each chat session with user info and conversation state.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `created_at` | `timestamp` | NO | `now()` | Session start time |
| `updated_at` | `timestamp` | NO | `now()` | Last activity |
| `user_name` | `varchar(100)` | YES | - | User's name |
| `user_email` | `varchar(255)` | YES | - | User's email address |
| `bucket` | `varchar(50)` | YES | - | Selected intention category |
| `phase` | `varchar(50)` | NO | `'welcome'` | Current conversation phase |
| `status` | `varchar(20)` | NO | `'active'` | Session status |
| `payment_status` | `varchar(20)` | YES | - | Payment status |

**Bucket values:**
- `family_reconciliation`
- `healing_health`
- `protection`
- `grief`
- `guidance`

**Phase values:**
- `welcome`
- `bucket_selection`
- `deepening`
- `payment`
- `complete`

**Status values:**
- `active`
- `completed`
- `abandoned`
- `soft_closed`

---

### 2. `messages`

Stores every message in the conversation (both user and assistant).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `serial` | NO | auto | Primary key |
| `session_id` | `uuid` | NO | - | FK → sessions.id |
| `role` | `varchar(10)` | NO | - | `'user'` or `'assistant'` |
| `content` | `text` | NO | - | The message text |
| `created_at` | `timestamp` | NO | `now()` | When message was sent |
| `phase` | `varchar(50)` | YES | - | Phase when message was sent |

---

### 3. `prayer_intentions`

Stores the confirmed prayer for fulfillment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `serial` | NO | auto | Primary key |
| `session_id` | `uuid` | NO | - | FK → sessions.id |
| `person_name` | `varchar(100)` | YES | - | Who the prayer is for |
| `relationship` | `varchar(100)` | YES | - | e.g., "my mother", "my son" |
| `situation` | `text` | YES | - | Summary of the situation |
| `prayer_text` | `text` | NO | - | The final confirmed prayer |
| `prayer_source` | `varchar(10)` | NO | - | `'claude'` or `'user'` |
| `bucket` | `varchar(50)` | YES | - | Bucket type |
| `confirmed_at` | `timestamp` | NO | `now()` | When user confirmed |
| `fulfilled_at` | `timestamp` | YES | - | When prayer was delivered |
| `status` | `varchar(20)` | NO | `'pending'` | Prayer status |

**Prayer source values:**
- `claude` - Prayer composed by Sister Marie
- `user` - Prayer written by the user

**Status values:**
- `pending` - Awaiting payment
- `paid` - Payment received, awaiting fulfillment
- `fulfilled` - Prayer delivered to Lourdes

---

### 4. `payments`

Stores payment records for Stripe integration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `serial` | NO | auto | Primary key |
| `session_id` | `uuid` | NO | - | FK → sessions.id |
| `prayer_id` | `integer` | YES | - | FK → prayer_intentions.id |
| `stripe_session_id` | `varchar(255)` | YES | - | Stripe checkout session |
| `stripe_payment_id` | `varchar(255)` | YES | - | Stripe payment intent |
| `amount_cents` | `integer` | NO | - | Amount in cents |
| `tier` | `varchar(20)` | NO | - | Payment tier |
| `status` | `varchar(20)` | NO | `'pending'` | Payment status |
| `created_at` | `timestamp` | NO | `now()` | Payment initiated |
| `completed_at` | `timestamp` | YES | - | Payment completed |

**Tier values:**
- `hardship` - $28
- `full` - $35
- `generous` - $55

**Status values:**
- `pending`
- `completed`
- `failed`
- `refunded`

---

## Indexes

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| `sessions` | `user_email` | Returning user lookup |
| `sessions` | `status` | Find active/abandoned sessions |
| `messages` | `session_id` | Fetch conversation history |
| `prayer_intentions` | `status` | Fulfillment queue |
| `payments` | `stripe_session_id` | Webhook lookups |

---

## Example Queries

### Get all user messages for a session
```sql
SELECT content, created_at, phase
FROM messages
WHERE session_id = '...' AND role = 'user'
ORDER BY created_at;
```

### Get pending prayers awaiting fulfillment
```sql
SELECT pi.*, s.user_email, s.user_name
FROM prayer_intentions pi
JOIN sessions s ON pi.session_id = s.id
WHERE pi.status = 'paid'
ORDER BY pi.confirmed_at;
```

### Get session with prayer and payment
```sql
SELECT
  s.id, s.user_name, s.user_email, s.bucket,
  pi.prayer_text, pi.person_name, pi.prayer_source,
  p.amount_cents, p.tier, p.status as payment_status
FROM sessions s
LEFT JOIN prayer_intentions pi ON pi.session_id = s.id
LEFT JOIN payments p ON p.session_id = s.id
WHERE s.id = '...';
```

---

## Migration

To generate migrations from the schema:

```bash
npx drizzle-kit generate
```

To apply migrations:

```bash
npx drizzle-kit migrate
```
