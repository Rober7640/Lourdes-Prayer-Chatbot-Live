# Lourdes Chatbot Documentation

## Quick Links

| I want to... | Read this |
|--------------|-----------|
| Understand project status | [implementation-plan.md](#implementation-planmd) |
| Edit Sister Marie's prompts | [ai-architecture.md](#ai-architecturemd) |
| See the original chat script | [lourdes-chatbot-script-v2.md](#lourdes-chatbot-script-v2md) |
| Understand the upsell flow | [upsell-1-medal-spec.md](#upsell-1-medal-specmd) |
| Set up the database | [database-schema.md](#database-schemamd) |
| Write lead follow-up emails | [emails-lead-sequence.md](#emails-lead-sequencemd) |
| Write customer emails | [emails-customer-sequence.md](#emails-customer-sequencemd) |

---

## Documents

### implementation-plan.md
**Master project status and roadmap**

The central document tracking what's built, what's missing, and next steps.

- Current state (what's working)
- Phase-by-phase implementation checklist
- Environment variables reference
- Key files table
- Next steps prioritization

**Audience:** Developers, project managers

---

### ai-architecture.md
**AI file structure and prompt locations**

Technical reference for anyone editing the Claude AI integration.

- File map (`claude.ts`, `claude-upsell.ts`, session services)
- Line-by-line content locations (where to find persona, phase instructions, safety keywords)
- API endpoint reference (which endpoints use AI vs scripted responses)
- Future refactoring proposal with rationale

**Audience:** Developers editing AI prompts, anyone A/B testing copy

---

### lourdes-chatbot-script-v2 (1).md
**Original conversation flow script**

The source-of-truth for Sister Marie's persona and conversation design.

- Sister Marie persona definition
- Phase-by-phase conversation flow (welcome → bucket → deepening → payment)
- All scripted messages with typing delays
- Bucket-specific deepening flows (healing, grief, protection, family, guidance)
- Edge cases and special handling

**Audience:** Content writers, product managers, anyone designing conversation flows

---

### upsell-1-medal-spec.md
**Complete Upsell 1 specification**

Everything about the post-payment medal upsell flow.

- 10-phase message sequence (transition → the_ask → downsell)
- All scripted messages with self/other variants
- Image specifications (medal, bernadette, testimonials)
- Offer cards (medal $59, candle $19)
- Thank you cards (3 variants)
- Exit paths and user journey map

**Audience:** Developers implementing upsell, content writers editing upsell copy

---

### upsell1.md
**Upsell implementation notes**

Technical implementation record for the upsell feature.

- Files created (frontend components, backend services)
- Files modified (routes, schema)
- API endpoints added
- Component specifications

**Audience:** Developers maintaining upsell code

---

### thank-you-page-spec.md
**Thank you card specification**

Design spec for post-purchase confirmation cards.

- Three variants (prayer only, candle, medal)
- "What Happens Next" steps for each
- Sister Marie blessing messages
- Component props and usage

**Audience:** Developers, designers

---

### database-schema.md
**PostgreSQL database schema**

Complete database design documentation.

- Table definitions (sessions, messages, prayer_intentions, payments)
- Column types and constraints
- Relationships and indexes
- Status/phase enum values

**Audience:** Backend developers, DBAs

---

### emails-lead-sequence.md
**Non-customer email sequence**

5-email nurture sequence for users who abandoned before payment.

- Email content (subject lines, body copy)
- Timing (+1hr, +1day, +3days, +4days, +5days)
- AWeber setup (tags, automation, custom fields)
- A/B testing plan
- Universal language (works for self and other prayers)

**Audience:** Marketing, email automation setup

---

### returning-leads-flow.md
**Returning leads conversation flow**

What happens when a non-customer clicks a resume link.

- Entry points (email link, "I've shared a prayer before")
- Three scenarios (session valid, expired, converted)
- Welcome-back messages by phase
- Edge cases (email captured but no bucket, multiple returns, etc.)
- API endpoint design
- Implementation checklist

**Audience:** Developers implementing session resume

---

### emails-customer-sequence.md
**Customer email sequences (3 lists)**

Post-payment email sequences for customers, split by purchase type.

- **Prayer Only** — 4 emails (confirmation, +7d photo, +30d check-in, +90d re-engagement)
- **Prayer + Medal** — 5 emails (adds +14d "has it arrived?")
- **Prayer + Candle** — 4 emails (photo email includes candle photo)
- AWeber list setup and automation timing
- Re-engagement CTA: Lourdes Blessing Pack

**Audience:** Marketing, email automation setup

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| implementation-plan.md | Active | Ongoing |
| ai-architecture.md | Complete | Feb 2026 |
| lourdes-chatbot-script-v2.md | Reference | - |
| upsell-1-medal-spec.md | Complete | Feb 2026 |
| upsell1.md | Complete | Feb 2026 |
| thank-you-page-spec.md | Complete | Feb 2026 |
| database-schema.md | Complete | Feb 2026 |
| emails-lead-sequence.md | Complete | Feb 2026 |
| emails-customer-sequence.md | Complete | Feb 2026 |
| returning-leads-flow.md | Complete | Feb 2026 |

---

## Missing Documentation

Future documents to create:

- [x] `emails-customer-sequence.md` — Post-payment email sequence for customers
- [ ] `stripe-integration.md` — Payment flow implementation guide
- [ ] `aweber-integration.md` — Email service setup guide
- [ ] `deployment.md` — Production deployment instructions
- [ ] `testing.md` — Test coverage and testing strategy
