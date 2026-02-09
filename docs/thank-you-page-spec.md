# Thank You Page Implementation Spec

## Overview

Post-purchase confirmation page that acknowledges the customer's purchase, sets expectations, and provides a warm spiritual close from Sister Marie.

---

## User Scenarios

| Scenario | What They Purchased | Exit Point | Variant |
|----------|---------------------|------------|---------|
| Prayer Only (early exit) | Prayer petition | Declined at "I need to go" | `prayer` |
| Prayer Only (full decline) | Prayer petition | Declined medal → Declined candle | `prayer` |
| Prayer + Candle | Prayer + Candle ($19) | Declined medal → Accepted candle | `candle` |
| Prayer + Medal | Prayer + Medal ($79) | Accepted medal | `medal` |

---

## Flow Integration

```
Payment Success (original prayer)
      │
      ▼
/confirmation/:sessionId
      │
      ▼
UPSELL FLOW
      │
      ├── [Accept Medal] ──────────► SHIPPING_FORM ──► ThankYouCard (medal)
      │
      ├── [Decline Medal]
      │         │
      │         ▼
      │    DOWNSELL (Candle $19)
      │         │
      │         ├── [Accept] ────────► ThankYouCard (candle)
      │         │
      │         └── [Decline] ───────► ThankYouCard (prayer)
      │
      └── [I need to go] ────────────► ThankYouCard (prayer)
```

---

## Component Specification

### File Location
```
client/src/components/upsell/ThankYouCard.tsx
```

### Props Interface

```typescript
interface ThankYouCardProps {
  variant: "prayer" | "candle" | "medal";
  personName: string;
  isForSelf: boolean;
  situation?: string;      // Prayer intention summary
  userEmail?: string;      // For "confirmation sent to" message
  onReturnHome: () => void;
}
```

---

## Visual Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      [STATUS ICON]                          │
│                                                             │
│                    PRIMARY HEADLINE                         │
│                    Secondary subtext                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ORDER SUMMARY                       │   │
│  │  [Product Image]     Product Name                    │   │
│  │                      For: [PersonName]               │   │
│  │                      Price (if applicable)           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WHAT HAPPENS NEXT                                          │
│  ✦ Step 1                                                   │
│  ✦ Step 2                                                   │
│  ✦ Step 3                                                   │
│  ✦ Step 4                                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Sister Marie    "Personal blessing message        │   │
│  │   Portrait]        from Sister Marie with           │   │
│  │                    warmth and spiritual close"      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NEED HELP?                                                 │
│  📧 support@lourdes-healing.com                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              [ Return to Home ]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Content by Variant

### Variant: `prayer`

**Header:**
- Icon: Scroll or praying hands
- Headline: "Your Prayer Has Been Received"
- Subtext: "Thank you for your faith"

**Order Summary:**
- Label: "Petition for"
- Person: `{personName}` or "Yourself"
- Intention: `{situation}` (truncated if long)
- No price displayed

**What Happens Next:**
1. Your petition will be printed on sacred paper
2. Placed in the petition box at the Grotto of Massabielle
3. Prayed over daily by the Sanctuary chaplains
4. You'll receive confirmation at `{userEmail}`

**Sister Marie Message:**
> "Thank you for entrusting {personName}'s intentions to Our Lady of Lourdes. I will personally place your petition at the Grotto, where millions of pilgrims have brought their hopes and prayers. You are in my prayers, and I trust Our Lady will intercede for you."

---

### Variant: `candle`

**Header:**
- Icon: Candle flame
- Headline: "Your Order is Confirmed"
- Subtext: "A light will shine for {personName}"

**Order Summary:**
- Image: Candle at grotto thumbnail
- Label: "Grotto Prayer Candle"
- Person: "For {personName}"
- Price: "$19"

**What Happens Next:**
1. Your candle will be lit at the Grotto within 24-48 hours
2. It will burn for approximately 7 days
3. You'll receive a photo of your lit candle via email
4. Your petition remains in the prayer intention book

**Sister Marie Message:**
> "Your candle will soon join the thousands of lights at the Grotto, each one a prayer rising to heaven. When I light it, I will hold {personName} in my heart. Watch for the photo — it will be a beautiful reminder that your prayer is burning brightly at Lourdes."

---

### Variant: `medal`

**Header:**
- Icon: Medal or checkmark
- Headline: "Your Order is Confirmed"
- Subtext: "A blessed gift is on its way"

**Order Summary:**
- Image: Medal front thumbnail
- Label: "The Lourdes Healing Medal"
- Person: "For {personName}"
- Price: "$79"
- Includes: Certificate of Authenticity

**What Happens Next:**
1. Your medal is being prepared in France
2. It will be blessed at the Grotto before shipping
3. Ships within 3-5 business days
4. Delivery: 7-14 business days (tracking provided)

**Sister Marie Message:**
> "I will personally ensure your medal is blessed at the Grotto before it begins its journey to {personName}. It carries within it the healing waters that have brought comfort to so many. May Our Lady of Lourdes watch over you both, and may this medal be a source of strength and hope."

---

## Technical Implementation

### New ChatItem Kind

Add to `confirmation.tsx` types:

```typescript
type ChatItem =
  | { id: string; role: Role; kind: "text"; text: string }
  | { id: string; role: "sm"; kind: "typing"; text: string; fullText: string }
  | { id: string; role: "sm"; kind: "image"; imageKey: string }
  | { id: string; role: "sm"; kind: "continue_or_go" }
  | { id: string; role: "sm"; kind: "medal_offer" }
  | { id: string; role: "sm"; kind: "candle_offer" }
  | { id: string; role: "sm"; kind: "shipping_form" }
  | { id: string; role: "sm"; kind: "thank_you"; variant: "prayer" | "candle" | "medal" }; // NEW
```

### New UpsellUiHint

Add to `upsell-session.ts`:

```typescript
export type UpsellUiHint =
  | "none"
  | "continue_or_go"
  | "show_offer"
  | "show_offer_self"
  | "tell_me_more"
  | "show_candle_offer"
  | "show_shipping_form"
  | "show_thank_you_prayer"    // NEW
  | "show_thank_you_candle"   // NEW
  | "show_thank_you_medal";   // NEW
```

### Session State Addition

Track what was purchased in `UpsellSessionContext`:

```typescript
export interface UpsellSessionContext {
  // ... existing fields
  purchaseType: "prayer" | "candle" | "medal" | null;
  purchaseCompleted: boolean;
}
```

---

## API Changes

### Existing Endpoints to Modify

**POST `/api/upsell/action`**

When action is `decline_candle` (final decline):
```json
{
  "phase": "complete",
  "uiHint": "show_thank_you_prayer",
  "messages": ["God bless you. Your petition is in my prayers."],
  "purchaseType": "prayer"
}
```

When action is `accept_candle`:
```json
{
  "phase": "complete",
  "uiHint": "show_thank_you_candle",
  "messages": ["Thank you. Your candle will be lit at the Grotto."],
  "purchaseType": "candle"
}
```

**POST `/api/upsell/medal`** (after shipping form)

On success:
```json
{
  "phase": "complete",
  "uiHint": "show_thank_you_medal",
  "messages": [],
  "purchaseType": "medal"
}
```

---

## Render Logic

In `confirmation.tsx`, add to the item rendering:

```tsx
// Thank you card
if (it.kind === "thank_you") {
  return (
    <div key={it.id} className="w-full px-2">
      <ThankYouCard
        variant={it.variant}
        personName={displayPersonName}
        isForSelf={isForSelf}
        situation={situation}
        userEmail={userEmail}
        onReturnHome={() => window.location.href = "/"}
      />
    </div>
  );
}
```

---

## Styling Notes

### Colors & Theming
- Use existing card styles: `bg-card/85 border-card-border backdrop-blur`
- Success accent: Consider subtle green tint for header area
- Maintain consistency with `MedalOfferCard` styling

### Icons
- Prayer: `ScrollText` or `HandHeart` from lucide-react
- Candle: `Flame` from lucide-react
- Medal: `Award` or `CheckCircle` from lucide-react

### Responsive
- Full width on mobile
- Max-width ~450px on desktop
- Adequate padding for readability

---

## Testing Checklist

- [ ] Prayer only flow (early "I need to go" exit)
- [ ] Prayer only flow (declined medal → declined candle)
- [ ] Candle purchase flow (declined medal → accepted candle)
- [ ] Medal purchase flow (accepted medal → shipping form → complete)
- [ ] Correct personName displayed for "self" vs "other"
- [ ] Email address shown correctly
- [ ] Return to home button works
- [ ] Mobile responsive layout
- [ ] Loading/error states

---

## Files to Create/Modify

### New Files
1. `client/src/components/upsell/ThankYouCard.tsx`

### Modified Files
1. `client/src/pages/confirmation.tsx` - Add thank_you ChatItem handling
2. `server/services/upsell-session.ts` - Add new UiHints and purchaseType
3. `server/services/claude-upsell.ts` - Return appropriate thank you hints

---

## Future Enhancements

- [ ] Order confirmation email trigger
- [ ] Order ID display for customer reference
- [ ] Social sharing buttons ("Share your blessing")
- [ ] Related content suggestions
- [ ] Print-friendly version of confirmation
