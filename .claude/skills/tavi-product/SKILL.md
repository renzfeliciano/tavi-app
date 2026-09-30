---
name: tavi-product
description: TAVI's product compass — who it's for, the critical path and funnel, the "is this MVP?" gate, what not to build, decision-log discipline, and startup validation. Use when scoping a feature, prioritizing, writing a roadmap change, or deciding whether something belongs in TAVI at all.
---

# TAVI product

Mission: **make it ridiculously easy for a small business to turn work into money.** `PRODUCT.md` holds product truth; the proposal holds the plan and decisions.

## Who

Small service businesses in the Philippines first (D2): contractors, aircon/repair, cleaning, agencies, freelancers — often on a phone between jobs. Their customers approve and pay from a link sent over Messenger, Viber or email, without an account.

## The critical path

```
Sign up → business → customer → quote → send (email or copy link) → customer approves
→ convert to invoice → send → payment recorded → PAID
```

Everything in Phase 1 serves this path. **Time to first sent quote** is the north-star activation metric.

## Funnel (derived from audit events + milestones; no analytics SDK)

signup → organization created → first customer → first quote → first quote sent → first approval → first invoice → first payment.

## The MVP gate — ask before building anything

1. Does it make the critical path faster, clearer or more trustworthy?
2. Would a first paying customer notice it's missing?
3. Is there a simpler version that ships this week?
4. What does it cost to maintain?
5. Is it on the "not yet" list (proposal §O)? Then no, unless the founder changes the decision log.

## Not yet (§O)

Microservices, payment processing, ledger/ERP/payroll/CRM, native apps, AI features, team invitations/billing/recurring invoices (Phase 2), dark mode, i18n framework, analytics SDK, credit notes, FX conversion, rich-text notes, POS integration (Phase 4 API if beta users ask).

## Decisions

The founder decides; record every decision in the proposal's decision log (next `D` number) with its effect. Work proceeds **top to bottom** through the roadmap without asking which milestone is next; stop only for a genuine decision or missing credentials.

## Validation

After Phase 1: private beta with 5–10 real businesses. Watch where they stall in the funnel, talk to them weekly, and re-prioritize Phase 2 from what they actually do — not from the brief's wish list.

## Compliance

Get a PH accountant's read on BIR invoicing (EOPT Act, CAS/e-invoicing) before marketing TAVI documents as invoices (risk N.1). Data Privacy Act (RA 10173): privacy policy, DPA with businesses, processing register before beta.
