# Lead Email Sequence — Non-Customers

## Overview

These emails are sent to users who:
- Started a chat with Sister Marie
- Provided their email address
- Did NOT complete payment

**Goal:** Gently invite them back to complete their prayer intention, without guilt or pressure.

**Voice:** Sister Marie — warm, unhurried, pastoral. Like a kind woman at a parish who remembers you.

---

## Available Variables

```
{{user_name}}        — User's first name (fallback: "Friend")
{{bucket}}           — Intention category (healing, grief, protection, etc.)
{{resume_link}}      — Magic link to resume their session
```

**Note:** We use universal language that works for both "self" and "other" prayers. No conditional logic required.

---

## Email 1: +1 Hour After Abandonment

**Subject Lines (A/B test):**
- A: `Your prayer is waiting`
- B: `{{user_name}}, I'm still here when you're ready`
- C: `We didn't finish — and that's okay`

**From:** Sister Marie <marie@messengersoflourldes.com>

**Body:**

```
Dear {{user_name}},

I noticed we didn't get to finish.

Life interrupts — I understand. A phone rings. Something pulls us away. Sometimes the heart just needs a moment.

Your prayer is still here, exactly where you left it. Nothing is lost.

When you're ready, I'll be waiting:

[Continue Your Prayer →]
{{resume_link}}

There's no rush. The Grotto has stood for over 150 years. It will be there when you return.

With care,
Sister Marie

—
Messengers of Lourdes
Carrying prayers to the sacred Grotto since 2019

[Unsubscribe] | [Privacy Policy]
```

---

## Email 2: +24 Hours

**Subject Lines (A/B test):**
- A: `Still holding your intention`
- B: `A quiet moment for your prayer`
- C: `{{user_name}}, your prayer is waiting`

**From:** Sister Marie <marie@messengersoflourldes.com>

**Body:**

```
Dear {{user_name}},

I've been thinking about you.

Sometimes people tell me they started to share their prayer but weren't sure they were ready. That the words felt too big, or too tender, to put down.

That's okay. You don't have to have it all figured out.

If you'd like to return, everything is just as you left it. We can take it slowly.

[Return to Your Prayer →]
{{resume_link}}

And if now still isn't the right time — I understand that too.

You're in my prayers.

Sister Marie

—
Messengers of Lourdes

[Unsubscribe] | [Privacy Policy]
```

---

## Email 3: +3 Days

**Subject Lines (A/B test):**
- A: `Many people return when they're ready`
- B: `No pressure — just a gentle reminder`
- C: `Your prayer is still waiting`

**From:** Sister Marie <marie@messengersoflourldes.com>

**Body:**

```
Dear {{user_name}},

I wanted to reach out one more time.

Many people who pray with us take a few days before they're ready. Some come back after a week. Some after a month. There's no wrong timing when it comes to prayer.

Your session — and your intention — will remain saved for a little while longer.

If you'd like to complete it:

[Continue Where You Left Off →]
{{resume_link}}

If not, I understand completely. Sometimes we're not ready, and that's its own kind of wisdom.

Whatever you decide, know that you're in my prayers.

With warmth,
Sister Marie

—
Messengers of Lourdes

[Unsubscribe] | [Privacy Policy]
```

---

## Email 4: +4 Days

**Subject Lines (A/B test):**
- A: `The Grotto is waiting`
- B: `A moment of stillness for you`
- C: `{{user_name}}, one more thought`

**From:** Sister Marie <marie@messengersoflourldes.com>

**Body:**

```
Dear {{user_name}},

I keep a small notebook by my desk. In it, I write the names of people I'm praying for.

Your name is in that notebook.

I don't know everything you're carrying. But I know you came to us for a reason. And that reason hasn't gone away — even if life got busy.

Your prayer session is still here:

[Return to Your Prayer →]
{{resume_link}}

Sometimes the hardest part is just showing up. If you return, I'll be there to walk with you through it.

Holding you in prayer,
Sister Marie

—
Messengers of Lourdes

[Unsubscribe] | [Privacy Policy]
```

---

## Email 5: +5 Days (Final)

**Subject Lines (A/B test):**
- A: `Your session will expire soon`
- B: `A final note about your prayer`
- C: `Before I close your prayer session`

**From:** Sister Marie <marie@messengersoflourldes.com>

**Body:**

```
Dear {{user_name}},

This will be my last note about your prayer session.

Your conversation — and your intention — will expire soon. After that, I won't be able to recover what you shared.

If you'd like to complete your prayer and have it carried to the Grotto at Lourdes, you can return here:

[Complete Your Prayer →]
{{resume_link}}

If life has taken you in another direction, I understand. These things have their own timing.

Either way, I'm grateful you trusted us with what's on your heart, even for a moment.

God bless you, {{user_name}}.

Sister Marie

—
Messengers of Lourdes

P.S. If you ever want to start fresh, you can always begin a new prayer at messengersoflourldes.com.

[Unsubscribe] | [Privacy Policy]
```

---

## Bucket-Specific Subject Line Variations (Optional)

If AWeber supports tag-based automation triggers, you could create bucket-specific versions of Email 2 or 3 with more targeted subject lines:

| Bucket | Subject Line Variant |
|--------|---------------------|
| healing_health | "Holding your healing intention" |
| grief | "Grief doesn't follow a schedule" |
| protection | "Still thinking of your prayer for protection" |
| family_reconciliation | "Family wounds take time" |
| guidance | "Your prayer for guidance is waiting" |

**Implementation:** Create 5 separate versions of one email, triggered by bucket tag. Or keep it simple with the universal versions above.

---

## Email Design Notes

### Visual Style
- Simple, clean layout
- No heavy graphics or banners
- Feels like a personal letter, not marketing
- Single CTA button (blue, not aggressive)
- Subtle Lourdes imagery in footer (optional: small Grotto photo)

### Mobile Optimization
- Single column layout
- Large tap target for CTA button (min 44px height)
- Body text 16px minimum

### Footer Requirements
- Unsubscribe link (required by law)
- Privacy policy link
- Physical address (CAN-SPAM requirement)
- "Messengers of Lourdes" branding

---

## AWeber Setup

### Tags
```
lead                    — Email captured, no payment
customer                — Payment completed
bucket:healing
bucket:grief
bucket:protection
bucket:family
bucket:guidance
```

### Custom Fields
```
user_name              — First name (for personalization)
```

### Automation: "Lead Nurture Sequence"

**Trigger:** Tag "lead" is added

**Sequence:**
| Step | Wait | Email | Total Time |
|------|------|-------|------------|
| 1 | 1 hour | Email 1: "Your prayer is waiting" | +1 hour |
| 2 | 23 hours | Email 2: "Still holding your intention" | +1 day |
| 3 | 2 days | Email 3: "Many people return when ready" | +3 days |
| 4 | 1 day | Email 4: "The Grotto is waiting" | +4 days |
| 5 | 1 day | Email 5: "Your session will expire" | +5 days |

**Exit Condition:** Tag "customer" is added → Remove from automation

---

## Tracking Metrics

| Metric | Target |
|--------|--------|
| Open rate | > 40% |
| Click rate | > 10% |
| Conversion (to payment) | > 5% |
| Unsubscribe rate | < 1% |

---

## A/B Testing Plan

### Phase 1: Subject Lines
Test subject line variants for Email 1. Winning subject becomes default.

### Phase 2: Send Timing
Test +1 hour vs +2 hours vs +30 minutes for Email 1.

### Phase 3: Sequence Length
Test 4-email sequence vs 3-email sequence (remove Email 3).

### Success Metrics
- Primary: Payment conversion rate
- Secondary: Open rate, click rate
- Guardrail: Unsubscribe rate < 1%
