# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, PostgreSQL 18 on Neon, Drizzle ORM, Better Auth, deployed on Vercel. Decided by the founder on 2026-09-30; see `docs/foundation-proposal.md` (decision log D1, D9).

## Users

- **Primary:** owners and staff of small service businesses: freelancers, consultants, agencies, contractors, repair and maintenance, cleaning and other professional services. They are often on a phone between jobs and need to turn finished or agreed work into money quickly. The product must stay industry-neutral.
- **Secondary:** the business's customers. They receive a quote or invoice link, often over WhatsApp, Viber or Messenger rather than email, and must review, approve and see how to pay **without creating an account**.

## Product Purpose

Make it ridiculously easy for a small business to turn work into money. The critical path is: create customer → quote → send → customer approves via a secure link → convert to invoice → record payment → invoice paid.

Success in the MVP means a new business reaches its first sent quote quickly (the "time to first quote" metric), and real businesses complete the full path through to a recorded payment.

## Positioning

Ordinary, dependable software with no AI dependency, focused narrowly on the quote-to-paid workflow for small businesses. It's built Philippines-first: VAT-inclusive pricing by default, PHP, e-wallet payment methods, and link-based sending over chat apps treated as first-class. It deliberately avoids feeling like traditional accounting software.

## Operating Context

- The business works on mobile and desktop. The customer is usually on a phone.
- Documents: quotes (`QUO-`), invoices (`INV-`) and receipts (`REC-`), each with a PDF.
- MVP payments are recorded manually (bank transfer, cash, card, cheque, GCash/Maya, other). The business's payment instructions are shown on invoices.
- Launch market: the Philippines (PHP, `Asia/Manila`, `en-PH`). Other currencies are supported per document, with no FX conversion.

## Capabilities and Constraints

- The capabilities, domain rules and state machines are specified in `docs/foundation-proposal.md` §B.
- Multi-tenant (organizations) with roles Owner, Admin and Member, and capability-based authorization.
- Money is stored as integer minor units with a currency code. Issued documents snapshot their line items and customer details.
- Sent invoices are editable until the first payment (D7). Quote and invoice statuses are stored (D5). Invoices have both `VOID` and `CANCELLED` (D6). Products and Services are separate lists (D8).
- **Undecided:** the final UI typeface and brand accent colour (Phase 0.4), and the mascot's name.
- **Open compliance question:** whether TAVI invoices can serve as official BIR invoices. This needs an accountant's review before PH marketing.

## Brand Commitments

- **Name:** TAVI. The wordmark is "TAVI"; running text uses "Tavi" (the default until the founder rules otherwise). "TA" is inspired by Travis and "VI" by Invoice; this is only told in an About/brand-story context.
- **Personality:** friendly, modern, approachable, fast, simple, trustworthy, slightly playful, professional, human rather than corporate.
- **Taglines** (configurable, never hard-coded): "Create. Send. Get paid." and "Simple invoicing for modern businesses." They live in `src/config/brand.ts`.
- **Mascot:** Direction 1, "The Stamp": a small rubber-stamp character whose imprint is the ✓-shaped V from the wordmark. "Delight the user, never distract the user." It's used sparingly, never needed to understand anything, and never jokes about money.
- **The customer's business branding leads on its own documents and portals.** TAVI appears there only as a small "Sent with Tavi" footer.

## Evidence on Hand

None yet: no customers, testimonials, metrics or brand assets exist. Future work must not invent any.

## Product Principles

1. **Time to first quote beats completeness.** Ask for setup details at the moment they matter, not up front.
2. **Trust is visible.** Clear document numbers, totals, statuses, timestamps and audit history. Money never animates.
3. **The customer's task is sacred.** On public pages: review, then approve, then pay, with nothing competing for attention.
4. **Build for the first paying customer, not imaginary ones.** When in doubt, leave it out of the MVP.

## Accessibility & Inclusion

WCAG 2.2 AA: keyboard access, visible focus, meaning never carried by colour alone, `prefers-reduced-motion` respected, touch targets sized for phones. Automated axe checks run in the E2E suite.
