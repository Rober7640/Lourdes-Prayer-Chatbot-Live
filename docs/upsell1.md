# Post-Purchase Upsell Page Implementation

**Date**: 2026-02-04
**Status**: Implemented

## Overview

Post-purchase upsell page (`/confirmation/:sessionId`) that continues the chat with Messenger Marie after a successful prayer payment. The upsell offers a Lourdes Healing Medal ($59) with a candle downsell ($19) if declined.

Based on: `docs/lourdes-upsell-1-medal-prompt.md`

---

## Files Created

### Frontend

| File | Purpose | Status |
|------|---------|--------|
| `client/src/pages/confirmation.tsx` | Main upsell page (mirrors chat.tsx structure) | Done |
| `client/src/components/upsell/MedalOfferCard.tsx` | Medal offer card ($59) | Done |
| `client/src/components/upsell/CandleOfferCard.tsx` | Candle downsell card ($19) | Done |
| `client/src/components/upsell/ShippingForm.tsx` | Address collection form | Done |
| `client/src/components/upsell/ContinueOrGoButtons.tsx` | [Yes, please] / [I need to go] buttons | Done |
| `client/src/components/upsell/UpsellImage.tsx` | Image display for medal/bernadette photos | Done |

### Backend

| File | Purpose | Status |
|------|---------|--------|
| `server/services/claude-upsell.ts` | Upsell-specific service with 10-phase scripted messages | Done |
| `server/services/upsell-session.ts` | Upsell session state management | Done |

### Schema Extensions

| File | Changes | Status |
|------|---------|--------|
| `shared/schema.ts` | Added `upsell_sessions`, `upsell_orders`, `upsell_messages` tables | Done |

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `client/src/App.tsx` | Added route: `/confirmation/:sessionId` | Done |
| `server/routes.ts` | Added upsell API endpoints | Done |

---

## API Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/confirmation/:sessionId` | Load confirmation page data + initial messages | Done |
| `POST /api/upsell/action` | Handle button clicks (continue, go, accept, decline, tell_me_more) | Done |
| `POST /api/upsell/advance` | Auto-advance to next phase | Done |
| `POST /api/upsell/message` | Handle free-form messages (rare) | Done |
| `POST /api/upsell/medal` | Process medal purchase ($59) with shipping address | Stub |
| `POST /api/upsell/candle` | Process candle purchase ($19) | Stub |

---

## Upsell Flow

```
Payment Success
      |
      v
/confirmation/:sessionId
      |
      v
TRANSITION (4 messages)
"Thank you... Before you go - may I show you something?"
      |
      v
[Yes, please] / [I need to go]
      |                    |
      v                    v
INTRODUCTION         GRACEFUL CLOSE
(5 msgs)                (3 msgs)
      |
      v
SHOW_FRONT (5 msgs + medal_front image)
      |
      v
BERNADETTE_STORY (10 msgs + bernadette_portrait)
      |
      v
WATER_REVEAL (7 msgs + medal_back image)
      |
      v
SOCIAL_PROOF (3 msgs + testimonial image)
      |
      v
THE_GIVING (9-10 msgs + certificate image)
      |
      v
THE_ASK (3 msgs)
"Would you like me to send one for [Name]?"
      |
      v
[Show Medal Offer Card - $59]
      |
      +--[Accept]--> SHIPPING_FORM --> COMPLETE
      |
      +--[Tell me more]--> MORE_INFO --> [Show Offer Again]
      |
      +--[Decline]--> DOWNSELL
                          |
                          v
               [Show Candle Card - $19]
                          |
              +-[Accept]--+-[Decline]
              |                   |
              v                   v
           COMPLETE         GRACEFUL CLOSE
```

---

## Key Types

```typescript
// Upsell phases
type UpsellPhase =
  | "transition"
  | "introduction"
  | "show_front"
  | "bernadette_story"
  | "water_reveal"
  | "social_proof"
  | "the_giving"
  | "the_ask"
  | "handle_response"
  | "tell_me_more"
  | "downsell"
  | "complete";

// UI hints
type UpsellUiHint =
  | "none"
  | "continue_or_go"
  | "show_offer"
  | "show_offer_self"
  | "tell_me_more"
  | "show_candle_offer"
  | "show_shipping_form";

// Actions
type UpsellAction =
  | "continue"
  | "go"
  | "accept_medal"
  | "decline_medal"
  | "tell_me_more"
  | "accept_candle"
  | "decline_candle";
```

---

## Image Assets

| Key | File | Status |
|-----|------|--------|
| `medal_front` | `/images/medal-front.jpg` | Done |
| `medal_back` | `/images/medal-back.jpg` | Done |
| `bernadette_portrait` | `/images/bernadette_portrait.jpg` | Done |
| `certificate` | `/images/certificate.jpg` | Done |
| `testimonial_medal` | `/images/testimonial-medal.png` | Done |
| `testimonial_medal_self` | `/images/testimonial-medal-self.png` | Done |
| `candle_grotto` | `/images/candle-grotto.png` | Done |

**Location**: `client/public/images/`

### Image Positioning (imageAfterMessage)

Images appear after a specific message in each phase:

| Phase | Image | Shows After Message # |
|-------|-------|----------------------|
| show_front | medal_front | 1 ("This is the Lourdes Healing Medal") |
| bernadette_story | bernadette_portrait | 1 ("Let me tell you about Bernadette") |
| water_reveal | medal_back | 2 ("Now — turn the medal over") |
| social_proof | testimonial_medal | 1 ("This is Rosa/Elena") |
| the_giving | certificate | 8/9 (after certificate message) |
| downsell | candle_grotto | 4 (after "light a candle" question) |

---

## Remaining Work

### TODO Items

1. **Stripe Integration**
   - Create actual Stripe checkout sessions for medal ($59) and candle ($19)
   - Handle webhook for payment completion
   - Redirect to Stripe checkout from shipping form

2. ~~**Image Assets**~~ DONE
   - ~~Add actual product images to `/public/images/`~~

3. **Database Persistence**
   - Implement DB storage for upsell sessions/orders (tables created in schema)
   - Connect to `db-storage.ts` pattern used elsewhere

4. **Payment Redirect**
   - Add redirect from main chat payment success to `/confirmation/:sessionId`
   - Can be done via Stripe success_url or client-side redirect

5. ~~**Testing**~~ DONE
   - ~~Add Playwright tests for upsell flow~~
   - Test file: `tests/upsell-flow.spec.ts` (30 tests)

---

## How to Test Manually

### Step 1: Start the Server

```bash
cd C:\Lourdes-Chatbot
npm run dev
```

Wait for: `serving on port 5000`

### Step 2: Create a Test Session

Open a new terminal and run:

```bash
curl -X POST http://localhost:5000/api/chat/start
```

You'll get a response like:
```json
{"sessionId":"abc-123-def-456","messages":[...],"phase":"welcome"}
```

### Step 3: Open the Upsell Page

Copy the `sessionId` and open in your browser:

```
http://localhost:5000/confirmation/{sessionId}
```

Example:
```
http://localhost:5000/confirmation/abc-123-def-456
```

### Step 4: Test the Flow

| Action | What to Test |
|--------|--------------|
| Page loads | 4 transition messages appear with typing animation |
| Click "Yes, please" | Messages auto-advance through all phases |
| Watch images | Images appear after intro messages (medal, Bernadette, etc.) |
| Medal offer appears | $59 card with 3 buttons |
| Click "Tell me more" | 8 more messages, then offer reappears |
| Click "No thank you" | Candle downsell ($19) appears |
| Click "Yes — Light a Candle" | Thank you message |
| Click "I need to go" (early) | Graceful close with blessing |

### Alternative: Full Flow Test

1. Open http://localhost:5000
2. Complete the entire chat flow (name, prayer recipient, situation, email)
3. After payment step, you'll reach the confirmation/upsell page

---

## Test Paths to Verify

### Happy Path (Medal Accept)
```
Transition → "Yes, please" → [auto-advance through phases] → "Yes — Send Me the Medal" → Shipping Form
```

### Downsell Path (Candle Accept)
```
Transition → "Yes, please" → [auto-advance] → "No thank you" → "Yes — Light a Candle" → Complete
```

### Full Decline Path
```
Transition → "Yes, please" → [auto-advance] → "No thank you" → "No thank you" → Graceful Close
```

### Early Exit Path
```
Transition → "I need to go" → Graceful Close
```

### Tell Me More Path
```
Transition → "Yes, please" → [auto-advance] → "Tell me more" → [more info] → Accept or Decline
```

---

## Automated Tests

Run Playwright tests:

```bash
# Start server first
npm run dev

# In another terminal, run tests
npx playwright test tests/upsell-flow.spec.ts --reporter=list
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| API Tests | 4 | Endpoint functionality |
| Edge Cases | 4 | Fallbacks, errors, refresh |
| UI Components | 4 | Buttons, cards, forms |
| Typing Animation | 3 | Character typing, dots |
| Happy Paths | 4 | Accept flows |
| Decline Paths | 3 | Decline/exit flows |
| Image Positioning | 6 | Images after correct messages |
| Mobile | 2 | Responsive layout |

---

## Message Counts

### Main Flow (49 messages total)

| Phase | Messages |
|-------|----------|
| Transition | 4 |
| Introduction | 5 |
| Show Front | 5 |
| Bernadette Story | 10 |
| Water Reveal | 7 |
| Social Proof | 3 |
| The Giving | 10 |
| The Ask | 3 |
| **Total** | **49** |

### Branch Paths

| Path | Additional Messages |
|------|---------------------|
| Accept medal | +4 (acceptance + shipping) |
| Tell me more | +8 (then back to ask) |
| Decline → Downsell | +5 (candle offer) |
| Accept candle | +4 |
| Decline candle | +3 |
| Early exit | +3 |

---

## Key Patterns Used

- **Typing animation**: Same as chat.tsx (character-by-character)
- **Phase-based flow**: Scripted messages per phase (not Claude-generated)
- **Session management**: In-memory with optional DB persistence
- **Component structure**: Card-based UI components in `/components/upsell/`
- **Route structure**: `/confirmation/:sessionId` matches prayer session
- **imageAfterMessage**: Controls when images appear within message sequences

---

## Notes

- Medal ships from France: 7-10 days USA, 14 days international
- Candle: no shipping required, photo confirmation sent
- Auto-advances through phases (unlike main chat which waits for user input)
- Accepts "no" gracefully — no pressure or guilt language
- References person_name throughout (or "you/your" if praying for self)
