# Lourdes Chatbot Implementation Plan

## Current State

### What's Built (UI Mockup)
- **Landing Page** (`client/src/pages/lander.tsx`) - Complete visual design with:
  - Sister Marie portrait and status indicator (busy/available)
  - "How It Works" section, testimonial, CTAs
  - Footer disclaimer

- **Chat Interface** (`client/src/pages/chat.tsx`) - Hardcoded demo with:
  - Welcome messages
  - 5 bucket selection cards
  - Quick-reply buttons
  - Typing indicator animation
  - Email input card
  - Message composer

- **UI Components** - 50+ shadcn/ui components ready

### What's Missing (Backend + Integration)
- No chat API (`server/routes.ts` is empty)
- No Claude AI integration
- No Stripe payment flow
- Database schema exists but not connected
- No session/conversation state management
- No email sending capability

---

## Implementation To-Do List

### Phase 1: Database & Core Infrastructure

#### 1.1 Extend Database Schema
- [ ] Add `prayer_intentions` table:
  - `id`, `session_id`, `user_id`, `bucket`, `person_name`, `relationship`, `situation_detail`, `desired_outcome`, `status`, `created_at`
- [ ] Add `chat_sessions` table:
  - `id`, `visitor_id`, `email`, `phase`, `bucket`, `payment_status`, `conversation_history` (JSONB), `flags`, `created_at`, `updated_at`
- [ ] Add `payments` table:
  - `id`, `session_id`, `stripe_payment_id`, `amount`, `tier`, `status`, `created_at`
- [ ] Add `upsells` table for candles/bundles

#### 1.2 Session Management
- [ ] Create session service (`server/services/session.ts`)
- [ ] Implement visitor identification (cookie-based)
- [ ] Session state persistence
- [ ] Timeout handling (30min soft, 2hr hard)

---

### Phase 2: Chat API & Claude Integration

#### 2.1 Chat API Endpoints
- [ ] `POST /api/chat/start` - Initialize session, return welcome message
- [ ] `POST /api/chat/message` - Process user message, return Claude response
- [ ] `GET /api/chat/session/:id` - Resume existing session
- [ ] `POST /api/chat/bucket` - Handle bucket selection

#### 2.2 Claude Integration (`server/services/claude.ts`)
- [ ] System prompt builder with:
  - Sister Marie persona (from PRD)
  - Absolute rules (never admit AI, etc.)
  - Current phase context
  - Conversation variables
- [ ] Conversation history management (last 15 turns)
- [ ] Response parser (JSON with messages array)
- [ ] Message chunking (max 25 words per bubble)

#### 2.3 Safety & Guardrails
- [ ] Pre-screen for crisis keywords (suicide, abuse, self-harm)
- [ ] Pre-screen for AI questions → scripted deflections
- [ ] Pre-screen for inappropriate content
- [ ] Response sanitization (no bullets, no promises)

#### 2.4 Conversation State Machine
- [ ] Phase tracking: `welcome` → `bucket_selection` → `deepening` → `payment` → `upsell` → `complete`
- [ ] Variable extraction (person_name, relationship, situation)
- [ ] Flags: `name_captured`, `ready_for_payment`, `crisis_flag`
- [ ] Bucket-specific deepening flows (5 branches: A-E)

---

### Phase 3: Payment Integration

#### 3.1 Stripe Setup
- [ ] Create Stripe products/prices:
  - $19 (hardship)
  - $28 (partial)
  - $35 (full)
  - $55 (generous)
  - $19 candle upsell
  - $67 bundle
- [ ] `POST /api/payment/create-checkout` - Generate Stripe session
- [ ] `POST /api/webhook/stripe` - Handle payment events

#### 3.2 Payment Flow in Chat
- [ ] Render payment tier cards when `ready_for_payment`
- [ ] Handle hardship flow ("I'm facing financial hardship")
- [ ] Redirect to Stripe checkout
- [ ] Handle return from Stripe (success/cancel)
- [ ] Post-payment confirmation message

#### 3.3 Upsell Flow
- [ ] Candle offer ($19) after base payment
- [ ] Bundle offer ($67) for healing bucket
- [ ] Single-click add-on if card saved

---

### Phase 4: Email System

#### 4.1 Transactional Emails
- [ ] Email service setup (SendGrid/Resend)
- [ ] Prayer confirmation email
- [ ] Payment receipt
- [ ] Candle photo confirmation (future)

#### 4.2 Recovery Emails
- [ ] Abandoned cart sequence (email captured, no payment)
- [ ] Session recovery links (magic tokens)

---

### Phase 5: Frontend Integration

#### 5.1 Connect Chat UI to API
- [ ] Replace hardcoded messages with API calls
- [ ] Implement real-time message rendering with delays
- [ ] Handle UI hints from Claude (`show_buckets`, `show_payment`, etc.)
- [ ] Display payment tier cards
- [ ] Handle Stripe redirect

#### 5.2 Session Persistence
- [ ] Store session ID in localStorage
- [ ] Handle returning visitors
- [ ] "I've shared a prayer before" flow

---

### Phase 6: Polish & Edge Cases

#### 6.1 Error Handling
- [ ] Invalid email format (3 attempts)
- [ ] Stripe checkout failures
- [ ] Network errors
- [ ] Session timeout recovery

#### 6.2 Returning User Flows
- [ ] Abandoned mid-flow detection
- [ ] Previous customer recognition
- [ ] Cross-device recognition via email

#### 6.3 Multiple Intentions
- [ ] Support for adding multiple names
- [ ] Group intentions handling
- [ ] Bucket pivoting (e.g., Healing → Grief)

---

## Key Files to Modify/Create

| File | Action |
|------|--------|
| `shared/schema.ts` | Extend with new tables |
| `server/routes.ts` | Add chat API endpoints |
| `server/services/claude.ts` | **Create** - Claude integration |
| `server/services/session.ts` | **Create** - Session management |
| `server/services/payment.ts` | **Create** - Stripe integration |
| `server/services/email.ts` | **Create** - Email sending |
| `client/src/pages/chat.tsx` | Connect to real API |
| `client/src/lib/chatApi.ts` | **Create** - API client |

---

## Environment Variables Needed

```env
ANTHROPIC_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_19=price_...
STRIPE_PRICE_ID_28=price_...
STRIPE_PRICE_ID_35=price_...
STRIPE_PRICE_ID_55=price_...
SENDGRID_API_KEY=SG....
DATABASE_URL=postgres://...
SESSION_SECRET=...
```

---

## Verification Plan

1. **Unit Tests**
   - Claude response parsing
   - Session state transitions
   - Safety guardrail detection

2. **Integration Tests**
   - Full conversation flow (welcome → payment)
   - Payment webhook handling
   - Email delivery

3. **Manual Testing**
   - Complete happy path (all 5 buckets)
   - Crisis content triggers resource display
   - AI question deflection works
   - Payment tiers render correctly
   - Returning user is recognized

---

## Recommended Implementation Order

### MVP First: Visualize Conversation Flow

1. **Claude integration** (core AI functionality - in-memory state)
2. **Chat API endpoints** (minimal, using in-memory sessions)
3. **Frontend connection** (see Sister Marie working!)
4. **Database schema** (persist conversations)
5. **Session management** (proper persistence)
6. **Stripe payment** (monetization)
7. **Email system** (confirmations)
8. **Edge cases & polish** (production readiness)

> **Rationale:** Start with Claude + API + Frontend to quickly visualize the conversation flow. Use in-memory state initially, then add database persistence once the conversation feels right.

---

## PRD Reference

The full conversation flow script is documented in:
- `docs/lourdes-chatbot-script-v2 (1).md`

Key sections:
- **Phase 1-2**: Welcome & Bucket Selection
- **Phase 3**: Deepening Conversations (5 branches A-E)
- **Phase 4**: Payment Flow ($19/$28/$35/$55 tiers)
- **Phase 5**: Upsell/Downsell (candle $19, bundle $67)
- **FAQ Handling**: Objection responses
- **Crisis Protocol**: Suicide, abuse, danger detection
- **Claude API Integration**: System prompt, absolute rules, response format
