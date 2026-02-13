# Lourdes Chatbot Implementation Plan

## Current State

### What's Built ✅
- **Landing Page** (`client/src/pages/lander.tsx`) - Complete visual design
- **Chat Interface** (`client/src/pages/chat.tsx`) - Fully functional with:
  - Character-by-character typing animation
  - 5 bucket selection cards
  - Real-time API integration
  - Message composer
- **Confirmation/Upsell Page** (`client/src/pages/confirmation.tsx`) - Post-payment upsell flow
- **Claude AI Service** (`server/services/claude.ts`) - Sister Marie persona for prayer flow
- **Claude Upsell Service** (`server/services/claude-upsell.ts`) - Scripted upsell messages
- **Session Management** (`server/services/session.ts`) - Prayer sessions
- **Upsell Session Management** (`server/services/upsell-session.ts`) - Upsell state
- **Chat API Endpoints** (`server/routes.ts`) - All endpoints working
- **Upsell Components** - MedalOfferCard, CandleOfferCard, ShippingForm, ThankYouCard

### What's Missing (Backend)
- [ ] Database persistence (currently in-memory, localStorage implemented)
- [ ] Stripe payment integration (endpoints exist but not wired to Stripe)
- [ ] AWeber email integration
- [x] Idle timeout handling (5 min at payment stage)

---

## Implementation To-Do List

### Phase 1: Database & Core Infrastructure

#### 1.1 Extend Database Schema
- [ ] Add `prayer_intentions` table
- [ ] Add `chat_sessions` table
- [ ] Add `payments` table
- [ ] Add `upsells` table for candles/medals

#### 1.2 Session Management
- [x] Create session service (`server/services/session.ts`)
- [ ] Implement visitor identification (cookie-based)
- [ ] Session state persistence to database
- [x] Timeout handling (5 min idle at payment → soft close)
- [x] Session save to localStorage on soft close

---

### Phase 2: Chat API & Claude Integration ✅

#### 2.1 Chat API Endpoints
- [x] `POST /api/chat/start` - Initialize session, return welcome message
- [x] `POST /api/chat/message` - Process user message, return Claude response
- [x] `GET /api/chat/session/:id` - Resume existing session
- [x] `POST /api/chat/bucket` - Handle bucket selection
- [x] `POST /api/chat/email` - Capture user email
- [x] `POST /api/chat/payment-ready` - Payment transition

#### 2.2 Claude Integration (`server/services/claude.ts`)
- [x] System prompt builder with Sister Marie persona
- [x] Absolute rules (never admit AI, max 25 words, etc.)
- [x] Current phase context
- [x] Conversation variables extraction
- [x] Conversation history management (last 30 turns)
- [x] Response parser (JSON with messages array)
- [x] Message chunking (max 25 words per bubble)

#### 2.3 Safety & Guardrails
- [x] Pre-screen for crisis keywords (suicide, abuse, self-harm)
- [x] Pre-screen for AI questions → scripted deflections
- [x] Pre-screen for inappropriate content
- [x] Response sanitization (no bullets, no promises)

#### 2.4 Conversation State Machine
- [x] Phase tracking: `welcome` → `bucket_selection` → `deepening` → `payment` → `complete`
- [x] Variable extraction (user_name, person_name, relationship, email)
- [x] Flags: `user_name_captured`, `name_captured`, `email_captured`, `ready_for_payment`
- [x] Bucket-specific deepening flows (5 branches)
- [x] Healing → Grief pivot handling

---

### Phase 3: Payment Integration

#### 3.1 Stripe Setup
- [ ] Create Stripe products/prices:
  - $28 (partial)
  - $35 (full)
  - $55 (generous)
  - $59 medal upsell
  - $19 candle upsell
- [ ] `POST /api/payment/create-checkout` - Generate Stripe session
- [ ] `POST /api/webhook/stripe` - Handle payment events

#### 3.2 Payment Flow in Chat
- [x] Render payment tier cards when `ready_for_payment`
- [x] Payment tiers: $28, $35, $55
- [x] Petition box photo shown before payment card
- [x] Sister Marie explains process before payment (6 messages)
- [x] Handle questions at payment stage (Claude redirects gently)
- [ ] Redirect to Stripe checkout
- [ ] Handle return from Stripe (success/cancel)
- [ ] Post-payment confirmation message

---

### Phase 3.5: Upsell 1 — Lourdes Healing Medal ✅

> **Full spec:** See `docs/upsell-1-medal-spec.md`

#### 3.5.1 Upsell Page & Components
- [x] Create `client/src/pages/confirmation.tsx` - Post-payment upsell page
- [x] Chat continuation with Sister Marie (typing animation)
- [x] `MedalOfferCard` component ($59)
- [x] `CandleOfferCard` component ($19 downsell)
- [x] `ShippingForm` component (address collection)
- [x] `ThankYouCard` component (3 variants: prayer, candle, medal)
- [x] `UpsellImage` component (medal, bernadette, testimonials)

#### 3.5.2 Upsell Flow (10 Phases)
- [x] **Transition** (4 msgs) - "Before you go — may I show you something?"
- [x] **Introduction** (5 msgs) - "You can bring Lourdes to [Name]"
- [x] **Show Front** (5 msgs + medal_front image)
- [x] **Bernadette Story** (10 msgs + bernadette_portrait image)
- [x] **Water Reveal** (7 msgs + medal_back image)
- [x] **Social Proof** (3 msgs + testimonial image)
- [x] **The Giving** (9-10 msgs + certificate image)
- [x] **The Ask** (3 msgs + Medal Offer Card)
- [x] **Tell Me More** (8 msgs) - Returns to offer card
- [x] **Downsell** (5 msgs + candle image + Candle Offer Card)

#### 3.5.3 Upsell Backend
- [x] `server/services/upsell-session.ts` - Session state management
- [x] `server/services/claude-upsell.ts` - Scripted messages (95% scripted, 5% AI fallback)
- [x] `GET /api/confirmation/:sessionId` - Load upsell page
- [x] `POST /api/upsell/action` - Handle button clicks (continue, go, accept, decline, tell_me_more)
- [x] `POST /api/upsell/advance` - Auto-advance phases
- [x] `POST /api/upsell/message` - Free-form text (AI fallback)
- [x] `POST /api/upsell/medal` - Process medal order (shipping form)
- [x] `POST /api/upsell/candle` - Process candle order

#### 3.5.4 Thank You Cards
- [x] **Prayer variant** - Early exit or full decline
- [x] **Candle variant** - Candle purchase ($19)
- [x] **Medal variant** - Medal purchase ($59)
- [x] "What Happens Next" steps
- [x] Sister Marie blessing message
- [x] Support email & Return to Home button

#### 3.5.5 Exit Paths
| User Action | Result | Thank You Card |
|-------------|--------|----------------|
| "I need to go" at transition | Early exit | Prayer |
| Decline medal → Decline candle | Full decline | Prayer |
| Decline medal → Accept candle | Candle purchase | Candle |
| Accept medal → Complete shipping | Medal purchase | Medal |

#### 3.5.6 Still TODO
- [ ] Wire shipping form to Stripe checkout ($59)
- [ ] Wire candle accept to Stripe checkout ($19)
- [ ] Store orders in database
- [ ] Trigger confirmation emails

---

### Phase 4: Email System (AWeber)

#### 4.1 AWeber Integration
- [ ] AWeber API service setup (`server/services/aweber.ts`)
- [ ] OAuth 2.0 token management (refresh tokens)
- [ ] Add subscriber to list on email capture
- [ ] Tag subscribers by status: `lead` vs `customer`
- [ ] Tag subscribers by bucket type (healing, grief, etc.)

---

#### 4.2 Non-Customers (Leads) — Email Captured, No Payment

> **Full spec:** See `docs/emails-lead-sequence.md`

**Trigger:** User gave email but did not complete payment.

**Tagging:**
- `status: lead`
- `bucket: [healing_health | grief | protection | etc.]`

**Email Sequence (5 emails, universal language):**
| Timing | Email | Subject |
|--------|-------|---------|
| +1 hour | Email 1 | "Your prayer is waiting" |
| +1 day | Email 2 | "Still holding your intention" |
| +3 days | Email 3 | "Many people return when they're ready" |
| +4 days | Email 4 | "The Grotto is waiting" |
| +5 days | Email 5 | "Your session will expire soon" |

**Variables Available:**
- `{{user_name}}` — User's first name (fallback: "Friend")
- `{{bucket}}` — Intention category
- `{{resume_link}}` — Magic link to resume session

**Exit Condition:** Tag "customer" added → Remove from automation

---

#### 4.3 Customers — Payment Completed

> **Full spec:** See `docs/emails-customer-sequence.md`

**Three Separate AWeber Lists:**

| List | Trigger | Emails |
|------|---------|--------|
| `customers-prayer-only` | Payment, no upsell | 4 emails |
| `customers-medal` | Medal purchased ($59) | 5 emails |
| `customers-candle` | Candle purchased ($19) | 4 emails |

**Email Sequences:**

| List | Timing | Emails |
|------|--------|--------|
| Prayer Only | +0, +7d, +30d, +90d | Confirmation → Photo → Check-in → Re-engagement |
| Medal | +0, +7d, +14d, +30d, +90d | Confirmation → Photo → "Has it arrived?" → Check-in → Re-engagement |
| Candle | +0, +7d, +30d, +90d | Confirmation → Photo (prayer + candle) → Check-in → Re-engagement |

**Variable Available:** `{{user_name}}` — First name only

**Re-engagement CTA:** Lourdes Blessing Pack

---

#### 4.4 Email Implementation Tasks

**Infrastructure:**
- [ ] Create `server/services/aweber.ts`
- [ ] Store email events in database (sent, opened, clicked)
- [ ] Magic link generation for session resume
- [ ] Photo attachment handling (Grotto photos, candle photos)

**Triggers to Implement:**
- [ ] On email capture → Add to AWeber as `lead`
- [ ] On payment complete → Update tag to `customer`, trigger confirmation
- [ ] On medal order → Trigger medal confirmation
- [ ] On candle order → Trigger candle confirmation
- [ ] On session timeout (no payment) → Trigger abandoned sequence
- [ ] Manual trigger for photo delivery (when photos ready)

---

### Phase 5: Frontend Integration ✅

#### 5.1 Connect Chat UI to API
- [x] Replace hardcoded messages with API calls
- [x] Implement real-time message rendering with delays
- [x] Character-by-character typing animation
- [x] Handle UI hints from Claude (`show_buckets`, `show_payment`, `show_petition_photo`)
- [x] Display payment tier cards (3 tiers with quotes and CTAs)
- [x] Display petition box photo before payment
- [ ] Handle Stripe redirect

#### 5.2 Session Persistence
- [x] Store session ID in state
- [x] Store session to localStorage on soft close
- [ ] Handle returning visitors (resume flow planned)
- [ ] "I've shared a prayer before" flow

---

### Phase 6: Polish & Edge Cases

#### 6.1 Error Handling
- [x] Graceful error messages (Sister Marie persona)
- [ ] Invalid email format (3 attempts)
- [ ] Stripe checkout failures
- [ ] Network errors with retry
- [ ] Session timeout recovery

#### 6.2 Idle Timeout
- [x] 5 minute idle at payment stage triggers soft close
- [x] Soft close messages: "I understand if now isn't the right time..."
- [x] Session saved to localStorage on soft close
- [x] Timer resets on user interaction

#### 6.3 Returning User Flows (Session Resume)

> **Full spec:** See `docs/returning-leads-flow.md`

**Three Scenarios:**

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| Session exists & valid | sessionId in URL, session found | Show history + welcome-back message |
| Session expired | sessionId in URL, session not found | Start fresh with acknowledgment |
| Already converted | sessionId in URL, payment completed | Redirect to confirmation page |

**Implementation Tasks:**
- [ ] `GET /api/chat/resume/:sessionId` - Resume endpoint with session validation
- [ ] Session expiry check (configurable TTL, suggest 7 days)
- [ ] Magic link generation (`/chat?resume=<sessionId>`)
- [ ] Conversation history restoration
- [ ] Welcome-back message selection based on session state
- [ ] Redirect logic for converted sessions
- [ ] Cross-device recognition via email lookup

#### 6.4 Multiple Intentions
- [ ] Support for adding multiple names
- [ ] Group intentions handling
- [x] Bucket pivoting (e.g., Healing → Grief)

---

### Welcome-Back Messages (Session Resume)

When a non-customer clicks a resume link from an email, Sister Marie greets them warmly based on their session state.

#### Scenario 1: Session Exists — User Returns Mid-Flow

**Trigger:** User clicks `{{resume_link}}`, session found in database.

**Welcome-Back Messages (scripted, not AI):**

```
Message 1: "[Name], you've come back."

Message 2: "I've kept everything just as you left it."

Message 3: "Take your time — we can pick up right where we were."
```

**Then:** Resume normal flow from last phase (deepening, payment, etc.)

**Variant — If at Payment Stage:**
```
Message 1: "[Name], welcome back."

Message 2: "Your prayer is ready. Everything is just as you left it."

Message 3: "Whenever you're ready, we can continue."
```
**Then:** Show payment cards again.

---

#### Scenario 2: Session Expired — Start Fresh

**Trigger:** User clicks `{{resume_link}}`, session not found (expired after 7+ days).

**Fresh Start Messages:**

```
Message 1: "Hello again."

Message 2: "It's been a little while since we last spoke. Your previous session has closed, but that's okay."

Message 3: "Would you like to start a new prayer? I'm here whenever you're ready."
```

**Then:** Show bucket selection cards (normal welcome flow).

---

#### Scenario 3: Already Converted — Redirect

**Trigger:** User clicks `{{resume_link}}`, session shows payment completed.

**Behavior:** Redirect to `/confirmation/:sessionId` (upsell page or thank you card, depending on upsell state).

No new messages needed — they see their existing confirmation state.

---

#### Implementation Notes

**Where to Add These Messages:**
- Add to `server/services/claude.ts` as `getWelcomeBackMessages(sessionState)` function
- Similar pattern to existing `getWelcomeMessages()` function

**Session State to Check:**
```typescript
interface ResumeContext {
  sessionId: string;
  exists: boolean;
  expired: boolean;
  converted: boolean;
  phase: Phase;
  userName?: string;
  bucket?: BucketType;
}
```

**Resume Link Format:**
```
https://messengersoflourldes.com/chat?resume={sessionId}
```

---

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `server/routes.ts` | All API endpoints | ✅ |
| `server/services/claude.ts` | Prayer flow AI (~1400 lines) | ✅ |
| `server/services/claude-upsell.ts` | Upsell scripted messages (~760 lines) | ✅ |
| `server/services/session.ts` | Prayer session state | ✅ |
| `server/services/upsell-session.ts` | Upsell session state | ✅ |
| `server/services/payment.ts` | Stripe integration | ❌ Not created |
| `server/services/aweber.ts` | Email integration | ❌ Not created |
| `client/src/pages/chat.tsx` | Main chat interface | ✅ |
| `client/src/pages/confirmation.tsx` | Upsell page | ✅ |
| `client/src/pages/lander.tsx` | Landing page | ✅ |
| `client/src/components/upsell/*.tsx` | Upsell components | ✅ |
| `client/src/lib/typing.ts` | Typing animation utilities | ✅ |

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/implementation-plan.md` | This file - overall project status |
| `docs/ai-architecture.md` | AI file structure, prompt locations, refactoring plan |
| `docs/upsell-1-medal-spec.md` | Complete upsell 1 specification with all messages |
| `docs/thank-you-page-spec.md` | Thank you card implementation spec |
| `docs/emails-lead-sequence.md` | Non-customer email sequence (5 emails, universal language) |
| `docs/emails-customer-sequence.md` | Customer email sequences (3 lists by purchase type) |
| `docs/returning-leads-flow.md` | Complete conversation flow for returning non-customers |

---

## Environment Variables

```env
# Required (configured)
ANTHROPIC_API_KEY=sk-...

# Stripe (pending)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_28=price_...
STRIPE_PRICE_ID_35=price_...
STRIPE_PRICE_ID_55=price_...
STRIPE_PRICE_ID_MEDAL=price_...
STRIPE_PRICE_ID_CANDLE=price_...

# AWeber (pending)
AWEBER_CLIENT_ID=...
AWEBER_CLIENT_SECRET=...
AWEBER_ACCESS_TOKEN=...
AWEBER_REFRESH_TOKEN=...
AWEBER_ACCOUNT_ID=...
AWEBER_LIST_ID=...

# Database (pending)
DATABASE_URL=postgres://...
SESSION_SECRET=...
```

---

## Future Refactoring (Post-MVP)

> **Full documentation:** See `docs/ai-architecture.md`

The current monolithic `claude.ts` (~1400 lines) could be split into modular structure for:
- A/B testing prompts without touching logic
- Non-engineers editing copy in isolated files
- Cleaner git history
- Unit testable intent patterns

**Priority:** After conversation flow is stable.

---

## Next Steps

1. **Stripe payment integration** - Wire up payment buttons to Stripe checkout
2. **Stripe upsell integration** - Wire shipping form + candle accept to Stripe
3. **AWeber email integration** - Capture leads, send confirmations
4. **Database persistence** - Save sessions, prayers, and orders
5. **Order management** - Store medal/candle orders, trigger fulfillment
