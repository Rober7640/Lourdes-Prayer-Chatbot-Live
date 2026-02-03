# Lourdes Chatbot Implementation Plan

## Current State

### What's Built ✅
- **Landing Page** (`client/src/pages/lander.tsx`) - Complete visual design
- **Chat Interface** (`client/src/pages/chat.tsx`) - Fully functional with:
  - Character-by-character typing animation
  - 5 bucket selection cards
  - Real-time API integration
  - Message composer
- **Claude AI Service** (`server/services/claude.ts`) - Sister Marie persona
- **Session Management** (`server/services/session.ts`) - In-memory (MVP)
- **Chat API Endpoints** (`server/routes.ts`) - All endpoints working

### What's Missing (Backend)
- [ ] Database persistence (currently in-memory, localStorage implemented)
- [ ] Stripe payment integration
- [ ] AWeber email integration
- [x] Idle timeout handling (5 min at payment stage)

---

## Implementation To-Do List

### Phase 1: Database & Core Infrastructure

#### 1.1 Extend Database Schema
- [ ] Add `prayer_intentions` table
- [ ] Add `chat_sessions` table
- [ ] Add `payments` table
- [ ] Add `upsells` table for candles/bundles

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
  - $19 (hardship)
  - $28 (partial)
  - $35 (full)
  - $55 (generous)
  - $19 candle upsell
  - $67 bundle
- [ ] `POST /api/payment/create-checkout` - Generate Stripe session
- [ ] `POST /api/webhook/stripe` - Handle payment events

#### 3.2 Payment Flow in Chat
- [x] Render payment tier cards when `ready_for_payment`
- [x] Payment tiers: $28 (hardship), $35 (full), $55 (generous)
- [x] Petition box photo shown before payment card
- [x] Sister Marie explains process before payment (6 messages)
- [x] Handle questions at payment stage (Claude redirects gently)
- [ ] Redirect to Stripe checkout
- [ ] Handle return from Stripe (success/cancel)
- [ ] Post-payment confirmation message

#### 3.3 Upsell Flow
- [ ] Candle offer ($19) after base payment
- [ ] Bundle offer ($67) for healing bucket
- [ ] Single-click add-on if card saved

---

### Phase 4: Email System (AWeber)

#### 4.1 AWeber Integration
- [ ] AWeber API service setup (`server/services/aweber.ts`)
- [ ] OAuth 2.0 token management (refresh tokens)
- [ ] Add subscriber to list on email capture
- [ ] Tag subscribers by bucket type

#### 4.2 Transactional Emails
- [ ] Prayer confirmation email (triggered via AWeber automation)
- [ ] Payment receipt
- [ ] Candle photo confirmation (future)

#### 4.3 Recovery Emails
- [ ] Abandoned cart sequence (email captured, no payment)
- [ ] Session recovery links (magic tokens)

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

#### 6.3 Returning User Flows
- [ ] Abandoned mid-flow detection
- [ ] Previous customer recognition
- [ ] Cross-device recognition via email

#### 6.4 Multiple Intentions
- [ ] Support for adding multiple names
- [ ] Group intentions handling
- [x] Bucket pivoting (e.g., Healing → Grief)

---

## Conversation Flow (Current)

1. **Welcome** → "May I ask your name?"
2. **User gives name** → Greet warmly, "What brings you to Our Lady of Lourdes?" + show buckets
3. **Bucket selected** → Acknowledge + ask for email ("in case we get disconnected")
4. **Email captured** → Begin deepening ("Is this for yourself or someone you love?")
5. **Deepening** → Get person's name, situation, compose prayer
6. **Prayer confirmed** → Claude explains process:
   - Acknowledge: "Beautiful. I'll carry this prayer for [Name] to Lourdes."
   - Step 1: Prayer printed with reverence
   - Step 2: Personal delivery to Grotto + blessing
   - Step 3: Photos sent to email
   - Show petition box photo
   - Explain offering + show payment tiers
7. **Payment** → Handle questions gently, redirect to payment card
8. **Idle timeout** (5 min) → Soft close, save session
9. **Complete** → Confirmation + optional upsell

---

## Prayer Format (Personal Voice)

Prayers use **first-person, personal voice** — not formal third-person announcements.

**Example:**
> "Blessed Mother, please intercede for my mother, Ng Kim Poh. She is facing pre-diabetes. I pray for her complete healing — that this condition be reversed and her body restored to health. I ask this through your Son, Jesus Christ. Amen."

---

## Key Files

| File | Status |
|------|--------|
| `server/routes.ts` | ✅ Chat API endpoints |
| `server/services/claude.ts` | ✅ Claude integration |
| `server/services/session.ts` | ✅ In-memory sessions |
| `server/services/payment.ts` | ❌ Not created |
| `server/services/aweber.ts` | ❌ Not created |
| `client/src/pages/chat.tsx` | ✅ Connected to API |
| `client/src/lib/typing.ts` | ✅ Typing animation utilities |

---

## Environment Variables

```env
# Required (configured)
ANTHROPIC_API_KEY=sk-...

# Stripe (pending)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_19=price_...
STRIPE_PRICE_ID_28=price_...
STRIPE_PRICE_ID_35=price_...
STRIPE_PRICE_ID_55=price_...

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

#### Prompt Architecture Refactor
- [ ] Split `claude.ts` into modular structure:
  ```
  server/services/
  ├── claude.ts          # API client + response handling
  ├── prompts/
  │   ├── persona.ts     # Sister Marie system prompt
  │   ├── buckets.ts     # Bucket-specific flows
  │   └── safety.ts      # Guardrails & deflections
  └── intents/
      └── extraction.ts  # Name/relationship parsing
  ```
- Benefits: A/B testing prompts, non-engineer editable copy, cleaner git history
- Priority: After conversation flow is stable

---

## Next Steps

1. **Stripe payment integration** - Enable monetization (wire up payment buttons)
2. **AWeber email integration** - Capture leads, send confirmations
3. **Database persistence** - Save sessions and prayers (replace in-memory + localStorage)
4. **Resume flow** - Handle returning visitors from localStorage/database
5. **Re-enable typing animations** - Currently disabled for testing (set delays back in `typing.ts`)
