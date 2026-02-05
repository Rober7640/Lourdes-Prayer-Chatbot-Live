# Returning Leads — Conversation Flow

## Overview

This document covers the complete conversation flow when a non-customer (lead) returns to the chatbot after abandoning a previous session.

**Two Entry Points:**
1. **Resume Link** — User clicks `{{resume_link}}` from an email
2. **Landing Page** — User clicks "I've shared a prayer before" (future feature)

---

## Entry Point 1: Resume Link from Email

### URL Structure

```
https://messengersoflourldes.com/chat?resume={sessionId}
```

**Example:**
```
https://messengersoflourldes.com/chat?resume=ses_abc123xyz
```

### Session Lookup Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User clicks resume link                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Extract sessionId │
                    │ from URL params   │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Lookup session   │
                    │ in database      │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Session  │   │ Session  │   │ Session  │
        │ NOT FOUND│   │ FOUND    │   │ FOUND +  │
        │ (expired)│   │ (valid)  │   │ CONVERTED│
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              ▼               ▼               ▼
        Scenario 2      Scenario 1      Scenario 3
```

---

## Scenario 1: Session Exists & Valid

**Condition:** Session found in database, not expired, payment NOT completed.

### Step 1: Restore Session State

Load from database:
- `userName` — User's first name
- `bucket` — Selected intention category (if any)
- `phase` — Last phase (`welcome`, `bucket_selection`, `deepening`, `payment`)
- `subPhase` — Sub-phase within deepening
- `extracted` — All captured variables (email, personName, relationship, situation)
- `conversationHistory` — Previous messages
- `flags` — State flags (email_captured, name_captured, etc.)

### Step 2: Display Welcome-Back Messages

**Based on last phase:**

#### If Phase = `bucket_selection` (bucket not yet selected)

```
Sister Marie: "[Name], you've come back."

Sister Marie: "I remember you were thinking about what to pray for."

Sister Marie: "Take your time — I'm here when you're ready."
```

**UI Action:** Show bucket selection cards.

---

#### If Phase = `deepening` (mid-conversation)

```
Sister Marie: "[Name], you've come back."

Sister Marie: "I've kept everything just as you left it."

Sister Marie: "Take your time — we can pick up right where we were."
```

**UI Action:** Show conversation history (collapsed or summarized), then continue from `subPhase`.

**Sub-phase continuation:**

| Last SubPhase | What Sister Marie Says Next | UI Action |
|---------------|----------------------------|-----------|
| `asking_email` | "Where were we... I was hoping you might share your email so I can hold you in prayer." | Wait for email |
| `asking_name` | "You were telling me about someone on your heart..." | Wait for name |
| `asking_situation` | "Tell me more when you're ready." | Wait for response |
| `composing_prayer` | "We were working on your prayer together..." | Continue composition |
| `awaiting_confirm` | Shows last composed prayer | "Does this feel right?" |

---

#### If Phase = `payment` (ready to pay)

```
Sister Marie: "[Name], welcome back."

Sister Marie: "Your prayer is ready. Everything is just as you left it."

Sister Marie: "Whenever you're ready, we can continue."
```

**UI Action:** Show composed prayer summary, then payment tier cards.

---

### Step 3: Continue Normal Flow

After welcome-back messages, the conversation continues as normal based on the restored phase/subPhase.

---

## Scenario 2: Session Expired

**Condition:** `sessionId` provided but session not found in database (TTL exceeded, typically 7 days).

### Welcome Messages (Fresh Start)

```
Sister Marie: "Hello again."

Sister Marie: "It's been a little while since we last spoke. Your previous session has closed, but that's okay."

Sister Marie: "Would you like to start a new prayer? I'm here whenever you're ready."
```

**UI Action:** Show bucket selection cards (normal welcome flow).

### Flow Continues As New User

- No history displayed
- All variables reset
- Normal welcome → bucket → deepening → payment flow

---

## Scenario 3: Already Converted

**Condition:** Session found, `paymentCompleted = true`.

### Behavior

**Redirect immediately** to `/confirmation/:sessionId`

No chat messages needed. User sees their existing confirmation state:
- If upsell not started → Upsell flow begins
- If upsell in progress → Resume upsell from last phase
- If upsell complete → Thank you card

---

## Entry Point 2: "I've Shared a Prayer Before"

### Landing Page Option

Future feature: Add link/button on landing page for returning users.

```
[Start Your Prayer]  ←── Primary CTA

Already started a prayer? [Continue where you left off]  ←── Secondary link
```

### Flow When Clicked

**Option A: Email Lookup**
```
Sister Marie: "Welcome back. What email did you use before?"
```
User enters email → Lookup session by email → Resume or start fresh.

**Option B: Cookie-Based**
If `sessionId` stored in localStorage/cookie:
→ Attempt resume with stored sessionId
→ If expired, start fresh with acknowledgment

---

## Conversation History Display

### Options for Showing Previous Messages

#### Option A: Collapsed Summary
```
┌─────────────────────────────────────────┐
│ 📋 Your previous conversation           │
│ • Praying for: Michael (healing)        │
│ • Email: john@example.com               │
│ [Expand to see full history]            │
└─────────────────────────────────────────┘
```
Then welcome-back messages appear below.

#### Option B: Full History Restored
Show all previous messages in chat, then welcome-back messages continue the thread.

#### Option C: Clean Slate with Context
Don't show old messages visually, but Sister Marie references them:
```
"I remember you — you were praying for Michael's healing."
```

**Recommendation:** Option A (collapsed summary) for mobile-friendliness + context.

---

## Edge Cases

### Edge Case 1: Email Captured, No Bucket Selected

**Session State:**
- `email`: captured
- `bucket`: null
- `phase`: `bucket_selection`

**Flow:**
```
Sister Marie: "[Name], you've come back."

Sister Marie: "I have your email — thank you for trusting me with that."

Sister Marie: "Now, what would you like to pray for today?"
```
**UI:** Show bucket cards.

---

### Edge Case 2: Bucket Selected, No Email Yet

**Session State:**
- `email`: null
- `bucket`: `healing_health`
- `phase`: `deepening`
- `subPhase`: `asking_email`

**Flow:**
```
Sister Marie: "[Name], you've come back."

Sister Marie: "I remember you wanted to pray for healing."

Sister Marie: "Before we continue — would you share your email? I'd like to hold you in prayer even after we finish here."
```
**UI:** Wait for email input.

---

### Edge Case 3: Prayer Composed, Not Confirmed

**Session State:**
- `phase`: `deepening`
- `subPhase`: `awaiting_confirm`
- `composedPrayer`: exists

**Flow:**
```
Sister Marie: "[Name], welcome back."

Sister Marie: "We had written a prayer together. Let me show you what we had..."
```
**UI:** Display composed prayer.
```
Sister Marie: "Does this still feel right? Or would you like to change anything?"
```

---

### Edge Case 4: User Returns Multiple Times

Track `returnCount` in session. If user has returned 2+ times:

```
Sister Marie: "You've come back again, [Name]. I'm glad."

Sister Marie: "There's no rush. We'll finish when you're ready."
```

Avoid making them feel guilty for abandoning multiple times.

---

### Edge Case 5: Different Device (No Session Cookie)

User clicks email link on different device than original session.

**Behavior:** Session lookup by `sessionId` in URL works regardless of device.
- Session found → Resume normally
- Session expired → Fresh start

Future enhancement: Cross-device recognition via email lookup.

---

## API Endpoints

### Resume Endpoint

```
GET /api/chat/resume/:sessionId
```

**Response (session found):**
```json
{
  "status": "found",
  "session": {
    "id": "ses_abc123",
    "phase": "deepening",
    "subPhase": "asking_situation",
    "bucket": "healing_health",
    "userName": "John",
    "extracted": {
      "email": "john@example.com",
      "personName": "Michael",
      "relationship": "father"
    },
    "conversationHistory": [...],
    "flags": {
      "email_captured": true,
      "name_captured": true
    }
  },
  "welcomeBack": {
    "messages": [
      "John, you've come back.",
      "I've kept everything just as you left it.",
      "Take your time — we can pick up right where we were."
    ],
    "uiHint": "resume_deepening"
  }
}
```

**Response (session expired):**
```json
{
  "status": "expired",
  "welcomeBack": {
    "messages": [
      "Hello again.",
      "It's been a little while since we last spoke. Your previous session has closed, but that's okay.",
      "Would you like to start a new prayer? I'm here whenever you're ready."
    ],
    "uiHint": "show_buckets"
  }
}
```

**Response (already converted):**
```json
{
  "status": "converted",
  "redirect": "/confirmation/ses_abc123"
}
```

---

## Implementation Checklist

### Backend Tasks
- [ ] Create `GET /api/chat/resume/:sessionId` endpoint
- [ ] Add `getWelcomeBackMessages(session)` to `claude.ts`
- [ ] Session expiry check (TTL configurable, default 7 days)
- [ ] Add `returnCount` tracking to session
- [ ] Email-based session lookup (for "I've shared a prayer before")

### Frontend Tasks
- [ ] Handle `?resume=` URL parameter on `/chat` page
- [ ] Call resume endpoint before starting new session
- [ ] Display conversation history (collapsed summary)
- [ ] Render welcome-back messages with typing animation
- [ ] Handle redirect for converted sessions
- [ ] Add "I've shared a prayer before" link to landing page (future)

### Database Tasks
- [ ] Add `expires_at` column to sessions table
- [ ] Add `return_count` column to sessions table
- [ ] Index on `email` for cross-device lookup
- [ ] Session cleanup job (delete expired sessions)

---

## Message Templates

### Welcome-Back Messages by Phase

```typescript
const WELCOME_BACK_MESSAGES = {
  bucket_selection: (name: string) => [
    `${name}, you've come back.`,
    "I remember you were thinking about what to pray for.",
    "Take your time — I'm here when you're ready."
  ],

  deepening: (name: string) => [
    `${name}, you've come back.`,
    "I've kept everything just as you left it.",
    "Take your time — we can pick up right where we were."
  ],

  payment: (name: string) => [
    `${name}, welcome back.`,
    "Your prayer is ready. Everything is just as you left it.",
    "Whenever you're ready, we can continue."
  ],

  expired: () => [
    "Hello again.",
    "It's been a little while since we last spoke. Your previous session has closed, but that's okay.",
    "Would you like to start a new prayer? I'm here whenever you're ready."
  ],

  multiple_returns: (name: string) => [
    `You've come back again, ${name}. I'm glad.`,
    "There's no rush. We'll finish when you're ready."
  ]
};
```

---

## Testing Scenarios

| Test | Expected Behavior |
|------|-------------------|
| Valid session, phase=deepening | Welcome-back + resume from subPhase |
| Valid session, phase=payment | Welcome-back + show payment cards |
| Expired session | Fresh start messages + bucket cards |
| Converted session | Redirect to /confirmation |
| No sessionId in URL | Normal new session flow |
| Invalid sessionId format | Treat as expired (fresh start) |
| Return count = 3 | Special "no rush" messaging |
