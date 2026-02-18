# Analytics Platform — Internal Concept Document

**Status:** Draft for team review
**Date:** 2026-02-18
**Scope:** Lourdes Chatbot and future chatbot/quiz funnel projects

---

## 1. Vision

Right now, reporting for Lourdes Chatbot is split across four separate tools:

- **Google Sheets** — manual lead tracking
- **AWeber** — email open/click rates
- **Facebook CAPI** — ad conversion events
- **Stripe Dashboard** — payment history

There is no single place to answer questions like:
- How many leads came in today and how many converted to buyers?
- What is the revenue per lead across different traffic sources?
- Which upsell is performing better this week vs. last week?

**Goal:** Build a centralized analytics platform on its own subdomain (e.g., `analytics.yourdomain.com`) that ingests events from all projects and presents a unified dashboard. Each project connects via a simple HTTP tracking API. The platform supports multiple projects from day one, so adding a new quiz funnel is just registering a new project and dropping in the tracking snippet.

---

## 2. Tech Stack

Keeping it consistent with all existing Replit projects to minimize context-switching and onboarding friction.

| Layer | Technology |
|---|---|
| Frontend (dashboard) | React + TypeScript + Vite |
| Backend (API) | Express + TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Session-based (same pattern as existing projects) |
| Hosting | Replit (dedicated deployment) |
| Styling | Tailwind CSS + shadcn/ui |

No new dependencies are introduced beyond what is already used in Lourdes Chatbot.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Projects                          │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │  Lourdes Chatbot    │    │  Future Quiz Funnel / Other  │   │
│  │  (lourdes.domain)   │    │  (quiz.domain)               │   │
│  └──────────┬──────────┘    └──────────────┬───────────────┘   │
│             │  POST /track                 │  POST /track       │
└─────────────┼───────────────────────────────┼───────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Analytics Platform (analytics.domain)              │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │   Tracking API       │   │   Dashboard API              │   │
│  │   POST /api/track    │   │   GET /api/dashboard/*       │   │
│  └──────────┬───────────┘   └──────────────┬───────────────┘   │
│             │                               │                   │
│             ▼                               ▼                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     PostgreSQL Database                  │  │
│  │   projects | events | admin_users                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   React Dashboard UI                     │  │
│  │   (served from the same Express app)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Each project sends a fire-and-forget POST to the tracking API whenever a meaningful event occurs (lead captured, payment completed, upsell accepted, etc.). The analytics platform stores these events and the dashboard reads them on demand.

---

## 4. Database Schema

### `projects`

Represents a single funnel or chatbot project.

```sql
CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                -- e.g., "Lourdes Chatbot"
  slug        TEXT NOT NULL UNIQUE,         -- e.g., "lourdes-chatbot"
  api_key     TEXT NOT NULL UNIQUE,         -- shared secret used in POST /track
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### `events`

One row per tracked event from any project.

```sql
CREATE TABLE events (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id),
  event_type    TEXT NOT NULL,              -- see event type list below
  session_id    TEXT,                       -- anonymous session identifier
  lead_id       TEXT,                       -- AWeber/internal lead ID if known
  email         TEXT,                       -- hashed or plain depending on policy
  amount_cents  INTEGER,                    -- for payment events, in cents
  metadata      JSONB,                      -- arbitrary extra data per event type
  occurred_at   TIMESTAMP NOT NULL,         -- when it happened in the source project
  received_at   TIMESTAMP DEFAULT NOW()     -- when the analytics platform received it
);

CREATE INDEX ON events (project_id, event_type, occurred_at);
CREATE INDEX ON events (project_id, occurred_at);
```

### `admin_users`

Simple user table for dashboard login.

```sql
CREATE TABLE admin_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Event Types

Standard event type strings that all projects should use:

| Event Type | When to fire |
|---|---|
| `page_view` | User loads the funnel page |
| `chat_started` | User sends first message in chatbot |
| `lead_captured` | Email address collected |
| `order_page_viewed` | User sees the main offer/payment page |
| `payment_initiated` | User clicks the pay button |
| `payment_completed` | Stripe confirms successful charge |
| `payment_failed` | Stripe reports a failure |
| `upsell_1_viewed` | Upsell 1 page is shown |
| `upsell_1_accepted` | User accepts upsell 1 |
| `upsell_1_declined` | User declines upsell 1 |
| `upsell_2_viewed` | Upsell 2 page is shown |
| `upsell_2_accepted` | User accepts upsell 2 |
| `upsell_2_declined` | User declines upsell 2 |
| `thank_you_viewed` | Thank you page loaded |

The `metadata` JSONB field carries event-specific extras (e.g., `{ "plan": "basic", "coupon": "SAVE10" }` on a payment event).

---

## 5. Dashboard Metrics

### Summary Cards (top of page)

- **Total Leads** — distinct emails with a `lead_captured` event
- **Total Revenue** — sum of `amount_cents` on `payment_completed` events
- **Conversion Rate** — `payment_completed` / `lead_captured` × 100
- **Revenue Per Lead** — Total Revenue / Total Leads
- **Upsell 1 Take Rate** — `upsell_1_accepted` / `upsell_1_viewed` × 100
- **Upsell 2 Take Rate** — `upsell_2_accepted` / `upsell_2_viewed` × 100
- **Average Order Value** — Total Revenue / count of `payment_completed`

### Charts

- **Leads Over Time** — daily bar chart, last 30 days
- **Revenue Over Time** — daily bar chart, last 30 days
- **Conversion Funnel** — horizontal funnel showing drop-off at each stage:
  `page_view → chat_started → lead_captured → payment_completed → upsell_1_accepted → upsell_2_accepted`
- **Revenue Breakdown** — pie chart splitting main offer vs. upsell 1 vs. upsell 2 revenue

### Filters (available on all charts and cards)

- **Project** — "All projects" or a specific project slug
- **Date range** — preset options (Today, Last 7 days, Last 30 days, This month, Custom range)

### Events Table

Paginated raw event log with columns: Date/Time, Project, Event Type, Email (masked), Amount, Metadata. Sortable by date. Filterable by project and event type. Useful for debugging specific sessions.

---

## 6. API Design

All API routes are prefixed with `/api`.

### Tracking API

**POST /api/track**

Receives events from client projects. Authenticated via `X-API-Key` header matching the project's `api_key`.

Request body:
```json
{
  "event_type": "payment_completed",
  "session_id": "sess_abc123",
  "lead_id": "aweber_subscriber_id",
  "email": "user@example.com",
  "amount_cents": 2700,
  "occurred_at": "2026-02-18T14:32:00Z",
  "metadata": {
    "stripe_payment_intent": "pi_xxxxx",
    "product": "main_offer"
  }
}
```

Response:
```json
{ "ok": true }
```

The endpoint returns `200 OK` immediately after inserting the event row. It never blocks the client project's response flow.

**GET /api/health**

Returns `{ "ok": true }`. Used to verify the platform is reachable from client projects before going live.

### Dashboard API

All dashboard routes require an authenticated session (admin login).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login, sets session cookie |
| `POST` | `/api/auth/logout` | Clears session |
| `GET` | `/api/projects` | List all registered projects |
| `GET` | `/api/dashboard/summary` | Returns all summary card values |
| `GET` | `/api/dashboard/leads-over-time` | Daily lead counts array |
| `GET` | `/api/dashboard/revenue-over-time` | Daily revenue array |
| `GET` | `/api/dashboard/funnel` | Funnel stage counts |
| `GET` | `/api/dashboard/events` | Paginated raw event log |

All dashboard GET endpoints accept query params: `projectId` (optional), `startDate`, `endDate`.

---

## 7. Integration Guide

### Connecting Lourdes Chatbot

1. Register Lourdes Chatbot in the `projects` table (run a one-time insert or admin script). Copy the generated `api_key`.

2. Add the API key to the Lourdes Chatbot environment:
   ```
   ANALYTICS_API_KEY=your_api_key_here
   ANALYTICS_BASE_URL=https://analytics.yourdomain.com
   ```

3. Create a small helper in the Lourdes Chatbot server (`server/analytics.ts`):
   ```typescript
   const ANALYTICS_BASE_URL = process.env.ANALYTICS_BASE_URL;
   const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY;

   export async function trackEvent(payload: {
     event_type: string;
     session_id?: string;
     lead_id?: string;
     email?: string;
     amount_cents?: number;
     occurred_at?: string;
     metadata?: Record<string, unknown>;
   }) {
     if (!ANALYTICS_BASE_URL || !ANALYTICS_API_KEY) return;
     try {
       await fetch(`${ANALYTICS_BASE_URL}/api/track`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "X-API-Key": ANALYTICS_API_KEY,
         },
         body: JSON.stringify({
           occurred_at: new Date().toISOString(),
           ...payload,
         }),
       });
     } catch {
       // Never let analytics errors affect the main flow
     }
   }
   ```

4. Call `trackEvent` at the relevant points in existing server routes. Examples:
   - After AWeber subscriber is confirmed → `event_type: "lead_captured"`
   - After Stripe `payment_intent.succeeded` webhook → `event_type: "payment_completed"`, include `amount_cents`
   - When upsell accept route is hit → `event_type: "upsell_1_accepted"`

5. The helper swallows all errors silently so a network timeout or analytics downtime can never break the chatbot for a real user.

### Connecting a Future Project

The same steps apply to any new project:

1. Insert a new row into `projects` with a unique `slug` and a fresh `api_key`.
2. Add the env vars to the new project.
3. Copy the `trackEvent` helper (it's project-agnostic).
4. Call `trackEvent` at the relevant steps.

---

## 8. Future Projects

The platform is designed to support quiz funnels and other lead/payment flows without code changes to the analytics platform itself.

**Quiz funnel example:**

A quiz funnel that collects an email after question 5, shows a VSL, and then offers a product would use the same event types:

- `page_view` when the quiz page loads
- `lead_captured` after the email gate
- `payment_completed` after purchase

Any quiz-specific events (e.g., `quiz_completed`, `quiz_answer_selected`) can be sent as custom `event_type` strings. The `metadata` field carries any extra data. These custom events won't appear in the standard funnel chart but will be visible in the raw events table and can be added to the dashboard later with a filter.

**Multi-project dashboard view:**

The "All projects" filter in the dashboard aggregates across every registered project. This lets the team see total revenue across all funnels in one number without building per-project dashboards.

---

## 9. Out of Scope

The following are explicitly not part of this platform to keep it focused:

- **Email sending** — AWeber handles this; the analytics platform only records that a lead was captured, not what emails were sent.
- **Facebook CAPI forwarding** — Each project continues to fire its own CAPI events directly. The analytics platform does not re-forward events to Meta.
- **Stripe webhooks** — Each project handles its own Stripe webhooks. The analytics platform receives a tracking call from the project after the webhook is processed, not directly from Stripe.
- **A/B testing** — Out of scope for v1. `metadata` can carry variant info if needed for manual analysis.
- **Real-time push** — The dashboard polls on page load. WebSocket/SSE live updates are not planned for v1.
- **Per-user session replay** — No video recording or click heatmaps.
- **GDPR/data retention policies** — To be defined before launch based on what data is actually stored (email hashing policy, retention window, etc.).
