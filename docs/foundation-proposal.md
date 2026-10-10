# TAVI — Foundation Proposal

Status: **Reviewed by founder, decisions recorded 2026-09-30** · Nothing in this document is implemented yet.

This answers §65 of the master brief (sections A–O), plus the mascot exploration the brand appendix asks for before implementation (section P) and the open decisions that block Phase 0 (section Q).

Where this proposal departed from the brief, it was marked **⚑ Pushback**. The founder's verdict on each is in the decision log below, and the sections have been updated to match.

### Decision log (2026-09-30)

| # | Decision | Effect |
|---|---|---|
| D1 | **Database: PostgreSQL 18 on Neon**, for development *and* production (MongoDB Atlas and a Docker-based local database were considered and rejected) | Neon project `tavi-app`, AWS Singapore, database `tavi`. Branch `production` is production; branch `dev` is for local development; branch `test` is for local integration tests (reset freely). **No Docker on the dev machine.** CI uses a temporary `postgres:18` service container. Neon's CLI/MCP/skills/`neon deploy` onboarding is **not used**: we only need connection strings, the app runs on Vercel, and project skills are governed by §L. PG 18 generates UUIDv7 natively (`uuidv7()`). Only the Postgres service is enabled; Neon Auth, Functions, AI gateway and Object storage are off. |
| D2 | **Launch market: Philippines first** | Defaults: PHP, `Asia/Manila`, `en-PH`, VAT 12% **inclusive**, e-wallet (GCash/Maya) payment methods, copy-link sending as a first-class channel. BIR positioning needs an accountant's review before launch (risk N.1). |
| D3 | **Mascot: Direction 1, "The Stamp"** | The wordmark's ✓-V is its imprint. The name is still open. |
| D4 | **Skills: 13 consolidated skills** (pushback accepted) | §L as written. |
| D5 | **Statuses are stored, not derived** (pushback rejected) | All 7 quote statuses and `OVERDUE` are stored. A daily job moves documents to `EXPIRED`/`OVERDUE`. Commands still re-check dates themselves (§B.3–4). |
| D6 | **Invoice `CANCELLED` is kept alongside `VOID`** (pushback rejected) | Both are terminal and keep their number. They differ in meaning (§B.4). |
| D7 | **Sent invoices stay editable until the first payment** | Every edit bumps the revision and writes a full before/after audit entry. The invoice locks once there's an active payment (§B.4). |
| D8 | **Separate Products and Services** (pushback rejected) | Two entities, two lists, and one shared "line source" interface for the editor (§B.1). |
| D9 | **Hosting: Vercel + Neon** | — |
| D10 | **Visual direction: "Carbon Copy"** (chosen 2026-09-30 from four rendered directions) | Based on the official-receipt booklet: cool bond-paper white, blue-black ink, hairline ruled fields, and **one accent, stamp-pad violet**, used only where real ink would go (document numbers, the Stamp, primary actions, focus). Geist for the UI, Geist Mono for serial numbers, both loaded with `latin-ext` for ₱. The Stamp mascot's imprint carries the wordmark's check-mark V. DESIGN.md is the source of truth once written. |
| D11 | **Free tier only for the initial release** (2026-09-30) | No purchases: Vercel Hobby (`*.vercel.app`, no custom domain), Neon Free, Sentry Developer, GitHub Free, and **Gmail SMTP** for email (App Password; about 500 emails a day; Resend stays wired for when a domain exists). BIR question goes to the RDO/BIR contact center instead of a paid accountant; until confirmed, PH documents are labelled **"Quotation"** and **"Billing Statement"**, never "Official Receipt" or "Sales Invoice". Vercel Hobby crons are daily only, so email delivery relies on the immediate after-response send, with the cron as a daily safety net. |
| D12 | **No hardcoded market values** (2026-09-30) | Everything country-specific lives in one **market profile** per country (`src/config/markets.ts`): currency, locale, time zone, default tax mode, **suggested** tax rates (PH: VAT 12%, offered as a preset, never created automatically), tax-ID label and format (PH: TIN), address labels, payment methods, share channels, document names (PH: Quotation / Billing statement / Payment acknowledgement, per D11) and document-term defaults. Each business stores `organizations.country_code` and reads its profile; the column defaults (PHP, Asia/Manila, en-PH, inclusive, 30/15 days) were dropped (migration 0007) and `province` became the neutral `region`. Examples in copy are computed (the tax-mode example is worked through the business's currency and suggested rate). Limits, link lifetimes and upload formats are named constants read by both the rule and its copy. Launching a country = adding one profile entry (and a country picker appears in onboarding once there are two). |
| D13 | **Documents follow Philippine BIR invoicing rules (RR 7-2024) and CPA practice** (2026-09-30) | Founder: "make sure our app is based on the PH standard, CPA rules, BIR regulations, especially the invoice." Every document shows the seller's registered name, VAT/Non-VAT registration statement with TIN and branch code, and registered address. Quotations, billing statements and payment acknowledgements are supplementary documents and print "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX." Bills become true **Invoices** only for a business that has registered TAVI with its RDO and entered its Acknowledgement Certificate/PTU number, date and approved serial range; then every Sec. 6(B) item is printed (VAT breakdown, buyer TIN rules, SC/PWD discount details, series range) and numbers stay inside the approved series. Payments record creditable tax withheld (Form 2307). Full mapping in §B.7. To confirm with the RDO (D11) and a CPA when available; structured e-invoicing (EIS) by 31 Dec 2026 is tracked. |
| D14 | **Registered invoices are locked once issued; invoice mode comes last** (2026-10-01) | Founder: lock them "if it is the right way and if it's forbidden". RMC 98-2026 Sec. IV.8 says an issued electronic invoice "shall not be deleted, altered, or modified" (decrease by credit note, increase by a new invoice), so in invoice mode (a business with its BIR registration entered) issued invoices can't be edited: corrections are void & reissue now, credit notes later. **D7 still applies to billing statements** (supplementary documents): editable until the first payment. Invoice mode (1.7c) moves to the end of Phase 1, after the RDO/CPA answers on CAS registration and EIS (`docs/compliance/ph-e-invoicing.md`). |
| D15 | **Privacy notice and terms: required agreement at sign-up; operator details later** (2026-10-02) | Founder chose a required checkbox at sign-up ("I agree to the Terms of Service and have read the Privacy Notice"), with the version and time recorded as evidence, over a passive "by creating an account you agree" line. The controller (operator name, address, privacy email, data protection officer) is left as clearly marked placeholders in `src/config/legal.ts` until the founder decides whether Tavi runs under his own name or a registered business; the legal pages show "Draft" until then. Both documents need a lawyer's review before the private beta (risk N.1). |
| D16 | **Close account = anonymise the person and close the business; export = one JSON file** (2026-10-02) | Founder chose, over a request-by-email flow and over deleting everything at once: closing needs the password, signs out everywhere, removes the sign-in, replaces the name and email, and closes a sole-member business (customer links off, records kept as tax rules require). "Download your data" is one JSON file (no new dependency for a ZIP of CSVs). A business shared with other people is closed by email until ownership transfer exists. |
| D17 | **Teams: owners and admins invite; one owner; business switcher; 10 people in the beta** (2026-10-02) | Founder chose to start Phase 2 with team invitations before the beta (the roadmap said to talk to beta businesses first; this item was judged lowest-regret). Owners and admins invite admins and members and change those roles; only the owner transfers ownership; a person can belong to several businesses and switches in the account menu; at most 10 people per business, pending invitations included (`TEAM_LIMITS`). |
| D18 | **Reports next (Phase 2.2), for owners and admins** (2026-10-02) | Founder chose reports over deploying for the beta, recurring invoices and SaaS billing. One Reports page: sales for a period (bills by issue date; the VAT breakdown; cancelled bills as cancelled revenue and void ones left out, D6), payments received (by method, and the tax each customer withheld, for matching their Forms 2307) and unpaid bills by age, each downloadable as a CSV for the business's accountant. Periods are calendar months, quarters and years in the business's time zone, or custom dates up to 366 days. Owners and admins only (`reports.read`); members still see the documents they work on. Totals are never summed across currencies. |
| D19 | **Finish invoice mode from the regulation text, without waiting for the RDO/CPA** (2026-10-08) | Founder: "we do not need RDO or CPA reply; we should finish this app." Read from RR 7-2024 and the discount laws (not legal advice): **REPRINT** (Sec. 6 B.21 top portion): the first PDF made of an issued registered invoice, by the business or the customer, is the original; every later PDF prints "REPRINT" prominently at the top; the web page is a view, not a print, and billing statements aren't counted. **Qualified discounts** (B.18): a bill can carry one buyer's statutory discount on every line, taken on the price before VAT; senior citizens (RA 9994, RR 7-2010) and PWDs (RA 10754, RR 5-2017) 20% and VAT-exempt, solo parents (RA 11861, RR 1-2023) 10% and VAT-exempt, national athletes and coaches (RA 10699, RR 13-2020) and Medal of Valor awardees (RA 9049) 20% with VAT kept on the undiscounted price; never combined with item discounts (the higher of a promo and the statutory discount, not both); the buyer's ID number, name and a signature line are printed with the B.18.b breakdown. The 5% SC/PWD discount on basic necessities (groceries) is left out: TAVI serves service businesses. **E-invoicing:** an EIS-ready JSON export of registered invoices (one invoice, or a period from Reports) in TAVI's own field names, with one mapping file (`e-invoice-format.ts`) to change once the BIR's EIS specification is in hand; every file says TAVI isn't BIR-certified, and nothing is transmitted to the BIR. |
| D20 | **The Stamp is redrawn and may idle; it signs documents** (2026-10-10) | Founder: the mascot looked flat and the design "AI slop"; asked for a mascot that is alive and appealing, throughout the app and on invoices. **Redrawn:** a white head with a readable face (eyes, mouth, cheeks) on an ink body with a violet pad; seven moods unchanged. **Idle life is allowed:** it blinks, breathes, hops now and then, glances around and its eyes follow the pointer; it looks away while a password is typed. The press and imprint still play once, on request, for real moments (sent, approved, paid). `prefers-reduced-motion` gets the still drawing, and nothing moves money, totals or statuses. **Placements:** beside every page title (`PageHeader`, tablet and up), the auth pages (side panel on wide screens, above the form on phones), empty and error states, and customer documents: a small still Stamp beside "Sent with TAVI" in the PDF footer, and a PAID or APPROVED imprint on a settled invoice or quote (web and PDF; `DocumentView.imprint`). The business's branding still leads. |
| D21 | **Business and customer categories** (2026-10-10) | Founder: ask what kind of business it is "in the first place", with an icon and friendlier wording, and let customers be tagged too. One list (`src/config/categories.ts`, 13 entries: food & beverage, home services, construction, beauty & wellness, health, education, creative, tech & IT, retail, transport, events, professional, other) serves both. A category is flavour only: an icon, example wording, suggested units and starter catalog names (no prices, units from the market vocabulary), and a Stamp accessory; it never changes tax, documents or money, so it holds no country-specific values (D12). `organizations.category` and `customers.category` are nullable text (migration 0024), validated against the list in the domain, not by a database constraint, so the list can grow. **Built so far:** the config and its tests, both columns, validation, the customer form's "Kind of customer" field and the icon on customer rows. **Next:** the onboarding picker, the icon beside the business name, starter catalog suggestions, category wording in placeholders, the Stamp's accessory. |
| D22 | **The Stamp as a context-aware companion; sign-in greeting** (2026-10-10) | Founder: a small companion that welcomes the user after sign-in and points at real things that need attention, never inventing anything, never an LLM for now. **Pipeline:** facts counted from the database (`gather-facts.ts`, same thresholds as the dashboard) → `insightsFrom` (pure rules, one insight per fact) → `selectInsight` (kind rank critical, action, recommended, informational, positive, then priority; only on pages in the insight's scopes; dismissed ones skipped) → `MascotCompanion`. A later AI layer can add providers or reword messages without touching the UI. **Rules:** it streams in behind the page inside `Suspense` with no fallback (never delays content or skeletons, never shifts layout); a failure means silence; facts respect the person's role; payments that "need reconciliation" and customers "without recent activity" are not offered because the data has no such source of truth. One thing at a time; the bubble settles to the Stamp alone after 12 seconds; Escape or the close button dismisses it for the session; a resolved item is acknowledged once ("Nice. That's taken care of."). It points at existing screens and never runs a workflow of its own. **Greeting:** the sign-in form leaves a timestamped mark in `sessionStorage`; the app shell takes it once, shows "Welcome back, <first name>." for about 3 seconds, and the companion waits for the corner to be free. Reduced motion shows the words without movement. **Brand changes:** a speech bubble is now allowed for these two moments (it was banned in D3); product copy still has no emoji. |
| D23 | **Idle sessions end after 30 minutes; sign-in and navigation follow the market's document names** (2026-10-10) | Founder: a real-world session should be forced out when the person is idle, and the product should read as one voice. **Session:** idle limit 30 min, renewed at most every 5 min on activity, a 60 s warning before sign-out, absolute 30 days, fresh-auth 15 min (`session-policy.ts`, one source for server and client). The client gives up `renewAfter` early so a last-second click can't outlive the server. Tabs share activity through `BroadcastChannel`; nothing goes in browser storage. Signing out lands on `/sign-in?reason=idle` or `reason=signed-out`. **Wording:** the sidebar, tab bar and New menu use `market.documents` (PH: Quotations, Billing statements), matching the page titles; "Billing statement" is deliberate PH wording, not an inconsistency. **Sign-in companion:** the Stamp mirrors the form (working, success, error) as decoration only; the error text stays the source of truth and navigation never waits for it. | Mascot and wording are presentation; the session limits are security, so they live in the policy file and its tests. |

---

## A. Architecture Assessment

### A.1 What exists today

The repository at `tavi-app/` has **no commits and no application code**. It contains:

| Path | State | Action needed |
|---|---|---|
| `.claude/skills/` | 7 vendored third-party design/Next.js skills (emil-design-eng, impeccable, taste-skill, next-best-practices, nextjs-shadcn, frontend-design, ui-ux-pro-max) | Keep. But `THIRD_PARTY_SKILLS.md` carries a precedence note written for another project ("HR workspace", "login photo"). It needs rewriting for TAVI. |
| `.claude/launch.json` | Copied from another project: the entry is named `hris-workforcehub` and uses port 4100 | Rename to `tavi` and set the port during scaffolding. |
| `.husky/pre-commit` | Runs `npm run lint`, `npm run typecheck` and `npm test` | Keep. The scripts must exist in `package.json`. The hooks don't run yet because `core.hooksPath` is unset until `npm install` triggers husky. |
| `package.json`, DB, auth, UI, tests, CI, deploy config | None | Everything below is greenfield. |
| Folder permissions | The folder is owned by `Admin`, but a non-elevated process gets **read-only** access (only `BUILTIN\Users: ReadAndExecute`) | ✅ Resolved 2026-09-30: Modify granted to `BCSPH-LPA-0588\Admin`. |

Local toolchain: Node 22.21, npm 11.12, pnpm 10.14, Python 3.12 and a `psql` 13 client. Docker Desktop is installed but not running, and a native PostgreSQL 13 service (end-of-life) is running on port 5432. TAVI uses neither (D1).

Versions checked on npm on 2026-09-30:

| Package | Version |
|---|---|
| next | 16.3.7 |
| react | 19.3.0 |
| drizzle-orm | 0.45.3 |
| better-auth | 1.7.6 |
| tailwindcss | 4.3.3 |
| zod | 4.6.5 |
| vitest | 5.0.2 |
| @playwright/test | 1.63.0 |
| @react-pdf/renderer | 4.9.0 |

Prisma's `latest` tag currently points at `8.0.0-rc.19`.

### A.2 Stack decision

| Concern | Choice | Why | Alternatives considered | Tradeoff |
|---|---|---|---|---|
| Framework | **Next.js 16 App Router, React 19, TypeScript strict** | Brief's recommendation; one deployable; RSC + Server Actions remove most API boilerplate | Remix/React Router 7, SvelteKit | Next 16 has breaking changes vs older knowledge (e.g. `middleware.ts` → `proxy.ts`). **Rule: read `node_modules/next/dist/docs/` before writing framework code**, the same convention as the founder's other repos. |
| Database | **PostgreSQL 18 on Neon** (branches: `production`, `dev`, `test`) | Transactions, row locks, check constraints and composite FKs — all used below | — | — |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | SQL-first: explicit transactions, `SELECT … FOR UPDATE`, composite FKs, check constraints and partial indexes are first-class; no generated engine binary; schema is plain TS per module | Prisma | Prisma has nicer onboarding DX, but its `latest` tag is currently an RC mid-major-transition, and row-locking/numbering code ends up in raw SQL anyway. Drizzle costs slightly more hand-written query code. |
| Auth | **Better Auth** (email + password, DB sessions, email verification, reset, rate limiting) wrapped behind our own `identity` module | Self-hosted data, DB-backed revocable sessions, active project (Auth.js is now maintained by the same team); no per-MAU cost | Clerk / WorkOS (hosted), hand-rolled | Hosted auth is faster to ship but adds per-user cost, lock-in and a third party holding customer identities. We use Better Auth for **identity + sessions only**; organizations, memberships and permissions stay in our domain, not in an auth plugin. |
| Validation | **Zod 4** at every boundary (forms, actions, route handlers, env) | Single schema drives client + server validation | Valibot | — |
| UI | **Tailwind v4 + shadcn/ui on Base UI primitives**, lucide icons, Sonner toasts | Accessible primitives we own (copied source, not a dependency); matches vendored `nextjs-shadcn` skill | Radix-based shadcn, Mantine, custom | We own and must maintain the copied components. |
| Forms | react-hook-form + zod resolver for the line-item editor; plain `<form action>` + `useActionState` elsewhere | Line items need dynamic arrays + live totals; simple forms don't need a library | — | Two form patterns, documented in the frontend skill. |
| PDF | **@react-pdf/renderer** | Deterministic, no headless Chrome, runs in serverless | Puppeteer/Playwright HTML→PDF | Separate layout components from the web preview (both consume the same view-model). |
| Email | **React Email templates + provider port** (`EmailSender` interface; Resend adapter in prod, console adapter in dev/test) | Provider-independent per §46 | Postmark, SES | — |
| Hosting | **Vercel + Neon** (see Q.1) | Zero-ops, preview deployments per PR, Neon branching for preview DBs, built-in cron | Railway/Fly + managed PG, self-host | Vendor coupling is mild: the app is a standard Next.js + Postgres app. |
| Observability | pino logs, Sentry, health routes | See §K | — | — |
| Tests | Vitest (unit + integration against real Postgres), Playwright (E2E + axe) | See §J | — | — |

### A.3 Shape: modular monolith

```
src/
  app/                        # Routing only. Pages, layouts, route handlers, server actions. Thin.
    (auth)/                   # sign-in, sign-up, verify-email, reset-password
    (app)/                    # authenticated product: dashboard, quotes, invoices, …
    (public)/q/[token]        # public quote portal
    (public)/i/[token]        # public invoice portal
    api/                      # health, cron, auth handler, PDF downloads
  modules/
    identity/                 # Better Auth wiring, session policy, request context
    organizations/            # org profile, memberships, settings, onboarding milestones
    authz/                    # capabilities, role matrix, can()/assertCan()
    customers/
    catalog/                  # products & services, tax rates
    quotes/
    invoices/
    payments/
    documents/                # numbering, share links, PDF rendering, view-models
    notifications/            # outbox, email templates, EmailSender port
    audit/
    billing/                  # plan entitlements (stub FREE plan until Phase 2)
  shared/                     # money, ids, clock, errors/Result, env, logger, rate-limit
  components/ui/              # design-system primitives (shadcn on Base UI, owned source)
  components/                 # domain display components (MoneyAmount, StatusBadge, …)
  config/                     # brand identity (brand.ts)
  db/                         # drizzle client, schema barrel, migrations
```

Every module has the same internal layout and one public entry point:

```
modules/quotes/
  domain/        # pure TS: types, state machine, invariants. Imports nothing from db/, next/, react.
  application/   # use cases: createQuote(ctx, input), sendQuote(ctx, id, …). Authz + txn + audit + outbox live here.
  infra/         # drizzle queries/repositories, always org-scoped
  schema.ts      # drizzle tables owned by this module
  index.ts       # the only import path other modules and app/ may use
```

Dependency direction is enforced with an ESLint boundaries rule, not just convention:

```
app/  →  modules/*/index  →  application  →  domain
                                  ↓
                                infra  →  db
```

- A React component never imports `db/` or `infra/`. This is enforced by the `tavi/module-boundaries` ESLint rule.
- A server action does three things: parse input with Zod, call **one** use case with the request context, and map the `Result` to UI state. It holds no business logic.
- Cross-module calls go through `index.ts`. `invoices` may call `quotes.getApprovedForConversion()` but can't touch the quotes tables.

**Performance posture (§44):** Server Components fetch data server-side. List queries are paginated with keyset cursors. Composite indexes follow the actual list filters (§C). Nothing is cached until measurements say so, and there's no Redis. `loading.tsx` plus Suspense handle perceived speed.

---

## B. Domain Model

### B.1 Entities

| Entity | Key facts |
|---|---|
| **Organization** | Business name, legal name, address, tax ID, logo, `defaultCurrency`, `timezone`, `locale`, default quote validity (days), default payment terms (days), default notes/terms, **payment instructions** (free text: bank/e-wallet details shown on invoices, since there's no processor in the MVP), `taxMode` default (`exclusive` \| `inclusive`), onboarding milestone timestamps. |
| **User** | Identity only (name, email, verified). Owned by `identity`. |
| **Membership** | `(organizationId, userId, role)`. Role ∈ Owner/Admin/Member. One Owner minimum. |
| **Customer** | Display name, company, email, phone, billing address, tax ID, preferred currency, notes, `archivedAt`. |
| **Product** | Physical or stock goods. Name, description, **SKU**, unit label (default "pc", chosen from the market's unit list), unit price + currency, default tax rate, `archivedAt`. |
| **Service** | Labour or time. Name, description, unit label (default "hour", chosen from the market's unit list), unit price + currency, default tax rate, `archivedAt`. It's a separate entity from Product (D8). Both implement a shared `LineSource` read interface, so the line-item editor can search both in one combobox, grouped under "Products" and "Services". |
| **TaxRate** | Name ("VAT 12%"), rate in basis points, `archivedAt`. |
| **Quote** (aggregate) | Header + `QuoteLine[]`. Has a customer, currency, issue date, valid-until date, notes, terms, a revision number, and a customer snapshot taken at send. |
| **Invoice** (aggregate) | Header + `InvoiceLine[]`, `sourceQuoteId?`, issue date, due date, customer snapshot, cached `amountPaid`/`balanceDue`. |
| **Payment** | Invoice, amount, currency, date, method, reference, notes, actor, receipt number, `voidedAt` + reason. |
| **ShareLink** | Public token for exactly one document. |
| **DocumentSequence** | Per-org, per-document-kind counter. |
| **AuditEvent**, **OutboxMessage** | Infrastructure-flavoured domain records. |

**Snapshots (§7):** each line stores its own `description`, `unitLabel`, `quantity`, `unitPrice`, `discount`, `taxRateName`, `taxRateBps` and computed amounts. A line's unit is picked from the market's fixed list (`market.units.options`, e.g. hour, day, job, pc, set), so the same unit is always written the same way; a unit saved before the list still shows, marked, until it is changed. `sourceKind` + `sourceId` are kept as a nullable back-reference to the product or service for reporting only and is never used to render a document. The customer's name, address, email and tax ID are copied onto the document **when it's issued**. Editing a customer or catalog item never changes an issued document.

### B.2 Money and calculation rules (§13)

- **Amounts are integers in minor units** plus an ISO-4217 currency code. The currency exponent comes from `Intl.NumberFormat(…, {style:'currency'}).resolvedOptions().maximumFractionDigits`, which handles cases like JPY=0 and KWD=3. In TypeScript they're `number`, guarded by `Number.isSafeInteger`; in Postgres they're `bigint`. The safe-integer ceiling is about 90 trillion PHP, which is fine. This avoids passing `bigint` across the RSC boundary.
- **Quantity** is a decimal with up to 4 places (1.5 hours), stored as `numeric(14,4)` and computed as a scaled integer (×10 000).
- **Rates** are integer basis points (12% = 1200). **Discounts** are either basis points or a fixed minor-unit amount.
- **Rounding:** half away from zero, applied **per line**, then lines are summed. A customer can check every line on the document, and the total equals the sum of what they see. All of this lives in one pure function, `calculateDocument()`, so the web preview, PDF, public portal and persistence can never disagree.

```
lineGross    = round(unitPrice × qty)
lineDiscount = pct ? round(lineGross × bps / 10000) : min(fixed, lineGross)
lineNet      = lineGross − lineDiscount
lineTax      = exclusive ? round(lineNet × rate / 10000)
                         : lineNet − round(lineNet × 10000 / (10000 + rate))   # tax contained in price
lineTotal    = exclusive ? lineNet + lineTax : lineNet
document     = Σ over lines (subtotal, discount, tax, total), tax also grouped per rate for display

# A qualified buyer's discount on the whole bill (D19), on the price before tax:
base         = exclusive ? lineNet : lineNet − lineTax
qualified    = round(base × rate / 10000)
taxExempt    → lineTax = 0, taxWaived = the lineTax above, lineTotal = base − qualified
otherwise    → lineTax unchanged (on the undiscounted price), lineTotal = base + lineTax − qualified
```

**Tax-inclusive mode is in the MVP.** Philippine pricing is commonly VAT-inclusive, and retrofitting inclusive mode later changes every stored total. Documents snapshot their `taxMode`.

**Multi-currency:** each document has exactly one currency (defaulting from customer, then organization). There's no FX conversion. Dashboard totals are grouped per currency, never summed across currencies.

### B.3 Quote state machine (§15)

All 7 statuses from the brief are **stored** (D5): `DRAFT`, `SENT`, `VIEWED`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.

```
                ┌──────────── revise (rev+1, old link revoked, new valid-until) ────────────┐
                ▼                                                                            │
  DRAFT ── send ──► SENT ── customer opens link ──► VIEWED                                   │
    │                 │                               │                                      │
    │                 ├───────────────┬───────────────┤                                      │
    │                 ▼               ▼               ▼                                      │
    │             APPROVED        REJECTED ────────────────────────────────────────────────┤
    │         (customer, or      (customer, or                                               │
    │          manual w/ note)    manual w/ note)                                             │
    │                 │                                                                      │
    │                 └── convert ──► invoice created (quote keeps APPROVED, invoiceId set)  │
    │                                                                                        │
    │   SENT | VIEWED ── valid-until passes (daily job, or on an approve attempt) ──► EXPIRED ┘
    │
    └── delete (drafts only, hard delete)
  DRAFT | SENT | VIEWED | EXPIRED | APPROVED (not yet converted) ── cancel ──► CANCELLED (terminal)
```

- **`VIEWED`** is set on the customer's **first** open of the public link. The business previewing its own quote never counts as a view.
- **`EXPIRED` has two paths:**
  - A **daily job** moves `SENT`/`VIEWED` quotes whose valid-until date has passed (in the org's timezone) to `EXPIRED`. It's idempotent, and it's audited with a `system` actor.
  - The **approve command re-checks the date itself** and expires the quote on the spot if needed. So a quote can never be approved after its valid-until date, even if the job hasn't run yet. The customer sees: "This quote expired on 14 Oct. Ask Acme Repairs for an updated quote."
- **Number assigned at first send**, not at draft creation, so deleted drafts never burn numbers. A revision keeps its number and shows it as `QUO-000012 · Rev 2`.
- **Approval binds to content:** approving stores a SHA-256 hash of the exact rendered view-model the customer saw, plus their typed name, timestamp, IP and user agent. Revising a sent quote revokes the old link, so a stale tab can't approve outdated terms.

### B.4 Invoice state machine (§17)

All 7 statuses from the brief are **stored** (D5, D6): `DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`, `CANCELLED`.

After any payment, payment void, edit or daily run, the status of an issued invoice comes from **one pure function**, so it can never drift:

```
issuedInvoiceStatus(total, activePaid, dueDate, today):
  activePaid >= total       → PAID
  dueDate < today (org tz)  → OVERDUE          # shown as "Overdue · ₱X of ₱Y paid" when activePaid > 0
  activePaid > 0            → PARTIALLY_PAID
  otherwise                 → SENT
```

```
  DRAFT ── issue/send ──► SENT ⇄ PARTIALLY_PAID ⇄ PAID        (payments recorded / voided)
    │                       │          │
    │                       └────┬─────┘
    │                            ▼  due date passes (daily job) — or recomputed on payment/edit
    │                         OVERDUE ──► PARTIALLY_PAID / PAID as payments arrive
    │
    │   SENT | OVERDUE (no active payments) ── void (reason required) ───► VOID       (terminal, number kept)
    │   SENT | OVERDUE (no active payments) ── cancel (reason required) ─► CANCELLED  (terminal, number kept)
    └── delete (drafts only)
```

**`VOID` vs `CANCELLED`** (D6). Both are terminal, both require a reason and no active payments, and both keep their number:

| Status | Meaning | Reporting |
|---|---|---|
| **VOID** | Issued **in error** (wrong customer, duplicate). The document should never have existed. | Excluded from all figures. |
| **CANCELLED** | Validly issued, but the **sale was called off** (job cancelled, customer withdrew). | Shown as "cancelled revenue" so the business can see lost deals. |

**Editing sent invoices** (D7; billing statements only — registered invoices are locked once issued, D14):

- A sent invoice is editable in `SENT` or `OVERDUE` **while it has no active payments**. You can change line items, dates, notes and terms, but **not the customer or currency**; to change those, void it and create a new one.
- An edit runs in a transaction with the invoice locked:
  - totals are recalculated and `revision` goes up by 1;
  - the **full before/after** lines and totals are written to the audit event;
  - the status is recomputed (moving the due date out can take `OVERDUE` back to `SENT`).
- The customer's link stays the same. The portal shows the latest version with an "Updated 14 Oct" note. The business can choose whether to email the customer that the invoice changed.
- Once any payment is recorded, the invoice **locks**. If every payment is later voided, it becomes editable again.
- **"Void & duplicate"** remains available as a one-click correction for locked invoices. Credit notes are Phase 2+.
- **Quote → invoice conversion** copies the lines and snapshots, and a unique constraint on `invoices.source_quote_id` makes a double-click idempotent.
- Payment status (`UNPAID`/`PARTIALLY_PAID`/`PAID`, §18) is a pure function of `total` and the sum of active payments. It's recomputed inside the payment transaction and never set by hand.

### B.5 Payments (§18)

- **Record:** runs in a transaction with the invoice locked (`FOR UPDATE`).
  - The currency must equal the invoice currency, and the amount must be between 0 and the balance due (no overpayment in MVP).
  - The receipt number (`REC-000001`) is assigned, `amountPaid` and status are recomputed, an audit event is written, and a notification is queued.
- **Void:** requires a reason. The payment is never deleted, and status is recomputed.
- **Methods:** bank transfer, cash, card, cheque, e-wallet (GCash/Maya, etc.), other. This is a `method` enum plus a free-text reference.
- **Provider-ready:** a `provider` column (defaults to `manual`) and a nullable `providerPaymentId` let Stripe, PayMongo or Xendit webhooks record payments through the same use case later.

### B.6 Document numbering (§14)

- A `document_sequences` table stores `(organization_id, kind)` as the primary key, plus `prefix`, `next_value` and `padding`.
- Numbers are allocated with `UPDATE … SET next_value = next_value + 1 RETURNING next_value - 1`, **inside the same transaction** that issues the document. The row lock serializes concurrent issuers, and the number becomes gapless because a rolled-back transaction also rolls back the increment.
- The backstop is a unique constraint on `(organization_id, number)`.
- Defaults are `QUO-`, `INV-` and `REC-` with a padding of 6. The only customization in the MVP is the prefix and padding, which leaves the format function extensible.

### B.7 Philippine invoicing rules (D13)

Source: Revenue Regulations No. 7-2024 (EOPT Act, RA 11976), Sections 2, 3 and 6, read from the regulation text; RR 11-2024 amends it and RR 26-2025 sets structured e-invoicing (EIS) for large taxpayers, e-commerce and CAS users by 31 Dec 2026. **Not legal or tax advice:** each item is to be confirmed with the business's RDO (D11) and, when available, a CPA. The sourced compilation (with questions for the RDO/CPA) is in `docs/compliance/ph-e-invoicing.md`.

**Document types.**
- An **Invoice** is the primary evidence of a sale of goods *and* services (official receipts are no longer primary). Only a **duly registered** invoice counts: pre-printed with an Authority to Print, or generated by a system the taxpayer has registered with the BIR (CAS/"other similar system", which gets an Acknowledgement Certificate or Permit to Use).
- Everything else issued to customers (quotations, billing statements, statements of account, payment/acknowledgement receipts, credit memos) is a **supplementary document**: it can't support the buyer's input-tax claim and must show, in bold, **"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX."** (Sec. 6 B.15).

**How TAVI applies this (D13).**
- Every TAVI document shows the seller's registered name, the registration statement with TIN and branch code ("VAT Reg TIN 123-456-789-00000" / "Non-VAT Reg TIN …"), and the registered address (B.1–B.3).
- Quotations and payment acknowledgements are supplementary documents and always carry the notice.
- Bills are **Billing Statements with the notice by default**. A business that has registered TAVI with its RDO enters its Acknowledgement Certificate/PTU number, date issued and approved serial range; its bills then become **Invoices** (title chosen from "Invoice", "Service Invoice", "Sales Invoice", "Billing Invoice"…) with every Sec. 6(B) item, numbered only within the approved series, and without the notice.
- All of this is market data (`src/config/markets.ts`, D12), not code.

**Invoice contents (Sec. 6 B, Sec. 3 B) and where TAVI implements them.**

| Requirement | TAVI | When |
|---|---|---|
| Seller registered name; optional trade name (B.1) | Business profile: registered name + business name | 1.1 (done) |
| VAT / Non-VAT statement + TIN + branch code (B.2) | Tax registration status in the business profile; TIN with branch code | D13 groundwork |
| Registered business address (B.3) | Business profile address | 1.1 (done) |
| The word "Invoice", prominent (A.3, B.4) | Invoice mode title; billing statements otherwise | 1.7 |
| Date; serial number printed prominently (B.5, B.7) | Issue date; gapless per-series numbering, never reused | 1.4–1.7 |
| Buyer registered name, address, TIN; not required for B2C (B.6); required for sales of ₱1,000+ to VAT-registered buyers (Sec. 3 B.4) | Customer snapshot; TIN prompt when the rule applies | 1.7 |
| Quantity, unit cost, description (B.8–B.10) | Line items | 1.5 (done) |
| Total; VAT shown separately; VAT included in the total (B.11–B.12) | `calculateDocument` + document totals | 1.4–1.5 (done) |
| Mixed sales broken into VATable Sales, VAT Amount, Zero-Rated Sales, VAT-Exempt Sales (B.13); "VAT-Exempt Sale" / "Zero-rated Sale" wording (B.14) | Tax rates get a category (VATable, zero-rated, exempt); totals show the four-line breakdown | 1.7 |
| Non-VAT: "EXEMPT" if not subject to VAT or percentage tax (B.16); Sales Subject to Percentage Tax vs Exempt Sales breakdown (B.17) | From the tax registration status | 1.7 |
| Senior Citizen / PWD / NAAC / Solo Parent / MOV sales: ID number, 5% or 20% discount and 12% VAT-exemption breakdown, signature (B.18) | A per-bill "Special discount" (market `qualifiedDiscounts`), computed by `calculateDocument`, printed with the buyer's ID, the B.18.b breakdown and a signature line; the 5% basic-necessities discount is left out (D19) | 1.12d (done) |
| System-generated invoices: ACCN/PTU number, series range, date issued at the bottom; "REPRINT" on reprints (B.21) | Invoice-mode settings; the first PDF of an issued registered invoice is the original, every later one prints "REPRINT" at the top (D19) | 1.12a, 1.12c (done) |
| Invoices required from ₱500 (VAT-registered: always) (A.1–A.2) | Guidance copy only; TAVI doesn't block small sales | 1.7 |
| Electronic invoicing (RR 11-2025 as amended by RR 26-2025; RMC 98-2026): covered taxpayers (e-commerce/internet sellers, LTS, large taxpayers, **users of CAS/CBA and other invoicing software**; micro taxpayers under ₱3M exempt) must issue structured e-invoices by **31 Dec 2026**, with a Permit to Issue and EIS certification (JSON); issued e-invoices can't be altered (credit note / new invoice) | Issued registered invoices are locked (D14). An EIS-ready JSON export of registered invoices (per invoice and per period) in TAVI's own field names, with one mapping file for the official specification; not BIR-certified and not transmitted (D19). PTI/EIS certification and ESP status remain the business's and TAVI's to pursue — see `docs/compliance/ph-e-invoicing.md` | 1.12e (done) |

**Accounting practice (CPA view)** that TAVI follows: numbers are gapless, sequential and never reused or deleted (cancel/void keeps the number, D6); issued documents are immutable except the audited pre-payment edit (D7); every change is in the append-only audit log; VAT in tax-inclusive prices is price × rate ÷ (1 + rate), per line (§B.2); corporate customers may withhold creditable tax (BIR Form 2307) when paying, so payments (1.8) record **tax withheld** alongside cash so the balance closes; records are kept for the period the Tax Code requires (not deleted by TAVI).

---

## C. Database Model

Conventions:

- **IDs:** UUIDv7 via PG 18's native `uuidv7()` column default (time-ordered, so it's index-friendly). IDs are never used as a security boundary.
- **Timestamps:** `created_at`/`updated_at` as `timestamptz`.
- **Business dates:** issue, due and valid-until dates are `date`, not `timestamptz`. This avoids timezone off-by-one errors.
- **Statuses:** `text` plus a `CHECK` constraint rather than Postgres enums, which keeps migrations cheap.
- **Tenant integrity:** every tenant-owned table has `organization_id NOT NULL` and `UNIQUE (organization_id, id)`. Foreign keys between tenant tables are **composite**, for example `invoices(organization_id, customer_id) → customers(organization_id, id)`, which makes a cross-tenant reference impossible at the database level rather than just unlikely.

```
identity (Better Auth-managed schema, owned by modules/identity)
  users(id, name, email citext UNIQUE, email_verified, …)
  sessions(id, user_id, token_hash, expires_at, created_at, updated_at, ip, user_agent, active_organization_id)
  accounts(…password hash…), verifications(…)

organizations(id, name, legal_name, address jsonb, tax_id, logo_file_id, default_currency char(3),
              timezone, locale, tax_mode, quote_validity_days, payment_terms_days, default_notes,
              default_terms, payment_instructions, onboarded_at, first_quote_sent_at, …)
memberships(id, organization_id, user_id, role CHECK in(owner,admin,member), UNIQUE(organization_id,user_id))

customers(id, organization_id, display_name, company, email, phone, billing_address jsonb, tax_id,
          currency, notes, archived_at)                       IDX (organization_id, lower(display_name))
tax_rates(id, organization_id, name, rate_bps CHECK 0..100000, archived_at)
products(id, organization_id, name, description, sku, unit_label, unit_price bigint, currency,
         tax_rate_id?, archived_at)          UNIQUE (organization_id, sku) WHERE sku IS NOT NULL
services(id, organization_id, name, description, unit_label, unit_price bigint, currency,
         tax_rate_id?, archived_at)

quotes(id, organization_id, customer_id, number?, revision, status, currency, tax_mode,
       issue_date, valid_until, customer_snapshot jsonb, notes, terms,
       subtotal, discount_total, tax_total, total  (bigint, CHECK >= 0),
       sent_at, viewed_at, decided_at, decision_name, decision_note, decision_content_hash,
       decision_ip, decision_user_agent, cancelled_at)
       UNIQUE (organization_id, number)   IDX (organization_id, status, valid_until)
quote_lines(id, organization_id, quote_id, position, source_kind? (product|service), source_id?, description, unit_label,
            quantity numeric(14,4), unit_price, discount_kind, discount_value, tax_rate_name,
            tax_rate_bps, line_subtotal, line_discount, line_tax, line_total)

invoices(… same header shape …, revision, source_quote_id UNIQUE NULL, due_date, amount_paid, balance_due,
         issued_at, voided_at, void_reason, cancelled_at, cancel_reason)
         UNIQUE (organization_id, number)   IDX (organization_id, status, due_date)
invoice_lines(… same as quote_lines …)

payments(id, organization_id, invoice_id, amount bigint CHECK > 0, currency, paid_on date, method,
         reference, notes, receipt_number, provider default 'manual', provider_payment_id,
         recorded_by, voided_at, void_reason, voided_by)
         UNIQUE (organization_id, receipt_number)

document_sequences(organization_id, kind, prefix, next_value, padding, PRIMARY KEY(organization_id, kind))

share_links(id, organization_id, document_kind, document_id, token_hash UNIQUE, expires_at,
            revoked_at, created_by, first_viewed_at, last_viewed_at, view_count)

audit_events(id, organization_id?, actor_type (user|customer|system), actor_id?, action, entity_type,
             entity_id, metadata jsonb, ip, user_agent, created_at)   -- append-only
             IDX (organization_id, entity_type, entity_id, created_at)

outbox(id, organization_id, kind, payload jsonb, status, attempts, next_attempt_at, last_error,
       created_at, sent_at)                                   IDX (status, next_attempt_at)

files(id, organization_id, purpose, storage_key, mime_type, byte_size, sha256, created_by)
rate_limits(key, window_start, count)   -- UNLOGGED table; Postgres-backed limiter, no Redis
```

**Soft deletion, only where justified (§12):**

| Record | Deletion behaviour |
|---|---|
| Customers, products, services, tax rates | Archived with `archived_at`, because issued documents reference them |
| Draft quotes and draft invoices | Hard delete |
| Issued documents | Never deleted; they're cancelled or voided instead |
| Payments | Voided, never deleted |
| Audit events | Append-only; the app's database role has **no UPDATE/DELETE grant** on the table |

Migrations use drizzle-kit and generate reviewed SQL files that are committed to the repo. Nothing is auto-pushed to a shared database.

---

## D. Authentication / Session Model (§9–10)

| Topic | Decision |
|---|---|
| Sign-in method | Email + password at launch. Google sign-in is a cheap follow-up that measurably lifts signup conversion (Phase 1.5). |
| Password storage | Better Auth's default memory-hard hash (scrypt). Minimum 12 characters plus a breached-password check (HaveIBeenPwned k-anonymity range API). No composition rules. |
| Email verification | **Progressive.** A user can sign up and build quotes immediately, but must verify before **sending** anything to a customer. This protects deliverability and stops phishing through the platform without blocking first value. |
| Password reset | Single-use hashed token, 30-minute expiry. Response copy is identical whether or not the account exists. |
| Session token | Opaque random token, stored hashed in `sessions`, sent as an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie with the `__Secure-` prefix. Nothing auth-related ever goes in `localStorage`. |
| Idle timeout | **30 minutes** (D23; originally 7 days). Renewed at most every 5 minutes on activity, with a 60-second warning before sign-out. |
| Absolute timeout | **30 days** from sign-in, then a hard re-login. Better Auth's expiry slides, so the absolute cap is an explicit check on `session.created_at` in our request context. |
| Fresh-auth window | Changing password or email, deleting the org, transferring ownership and (later) changing payout settings all require a sign-in within the last **15 minutes**. Otherwise a re-auth dialog appears. |
| Cookie cache | **Off** at launch. One indexed session lookup per request is cheap at our scale and gives **instant revocation**. Revisit with measurements. |
| Logout | Deletes the session row and clears the cookie. |
| Multi-device | Allowed. Settings → Security lists active sessions (device, last active) with "Sign out" per device and "Sign out everywhere else". |
| Password change / reset | Change revokes all *other* sessions. Reset revokes *all* sessions. |
| Session fixation | A new token is issued on every sign-in and privilege change. Tokens are never accepted from URLs. |
| Suspicious activity (MVP) | Sign-in attempts are rate-limited per IP and per email, using progressive delay rather than hard lockout (hard lockout lets attackers lock victims out). All logins are audited with IP and user agent. "New device sign-in" emails come in Phase 2. |
| Active organization | Stored **on the server-side session row**, not in the URL or a client cookie. It's re-validated against `memberships` on every request. |
| Enforcement layers | `proxy.ts` (Next 16) does an optimistic redirect only, based on cookie presence. **Real enforcement** is `requireOrgContext()`, memoized per request with React `cache()`, called by every page, server action and route handler. Middleware alone is never trusted (§9). |
| As built (0.3) | Better Auth 1.7 with the Drizzle adapter over our own tables (`users`, `sessions`, `accounts`, `verifications`, `rate_limits`; database-generated UUIDv7 IDs). Four deliberate deviations from the rows above: (1) Better Auth stores the session **token as issued**, not hashed; the cookie carries it HMAC-signed, and tokens are never selected by our own queries or sent to the browser (device sign-out works by session ID). (2) Sign-up **does say** when an email already has an account: an enumeration-safe sign-up needs email-first verification, which would cost first-quote time. Sign-in and password reset stay enumeration-safe, and sign-up is rate-limited. (3) Sign-in, sign-up and reset forms call Better Auth's HTTP endpoint through its client, **not server actions**, because its rate limiter only covers the endpoint. (4) The breached-password check **fails closed**: if the Pwned Passwords API is unreachable, sign-up asks the user to retry. |
| Expiry UX | An expired session makes the server action return a typed `UNAUTHENTICATED` result. The client opens an inline re-auth dialog **without discarding form state**: "Your session expired. Sign in again — your quote is still here." Quote and invoice drafts also autosave server-side. |

---

## E. Authorization Model (§11)

Capabilities are literal code, not a database-driven permissions engine:

```ts
// modules/authz/capabilities.ts
export type Capability =
  | 'customers.read' | 'customers.write'
  | 'catalog.read'   | 'catalog.write'
  | 'quotes.read'    | 'quotes.write'   | 'quotes.send' | 'quotes.decide'   // manual approve/reject
  | 'invoices.read'  | 'invoices.write' | 'invoices.send' | 'invoices.void'
  | 'payments.read'  | 'payments.record' | 'payments.void'
  | 'organization.manage' | 'users.manage' | 'billing.manage' | 'organization.delete'
  | 'audit.read' | 'reports.read';

// modules/authz/policy.ts
can(ctx, cap): boolean
assertCan(ctx, cap): void   // throws ForbiddenError → mapped to a human message at the action boundary
```

The request context comes from the server session only:

```
{ userId, sessionId, organizationId, role, capabilities }
```

**Proposed default role matrix:**

| Capability group | Owner | Admin | Member |
|---|---|---|---|
| customers, catalog (read/write) | ✓ | ✓ | ✓ |
| quotes read/write/send/decide | ✓ | ✓ | ✓ |
| invoices read/write/send | ✓ | ✓ | ✓ |
| invoices.void | ✓ | ✓ | — |
| payments.read | ✓ | ✓ | ✓ |
| payments.record / payments.void | ✓ | ✓ | — |
| organization.manage, users.manage, audit.read | ✓ | ✓ | — |
| reports.read (sales, payments and unpaid totals, D18) | ✓ | ✓ | — |
| billing.manage, organization.delete, ownership transfer | ✓ | — | — |

**Resource ownership / IDOR (§8):**

- Every `infra/` query takes `ctx` and filters on `ctx.organizationId`.
- Lookups by ID that miss for the current tenant return **Not Found**, never Forbidden, so the existence of another tenant's record never leaks.
- Composite foreign keys (§C) back this up at the database level.
- The organization ID is never read from request input.

**Plan entitlements** (§38) are a separate axis:

- `entitlements(org)` returns limits such as `maxCustomers`, `teamMembers` and `customBranding` from the plan.
- `assertWithinLimit(ctx, 'maxCustomers')` enforces them.
- In the MVP there's a single FREE plan with generous limits, so the check points exist before billing does.

Team invitations are Phase 2. The MVP has one owner per organization, but the authz layer is built and fully tested now, so adding invitations later is purely additive.

---

## F. Design System Strategy (§21–22)

### F.1 Source of truth

- `PRODUCT.md` and `DESIGN.md` at the repo root follow the vendored `impeccable` skill's convention and hold product context and visual decisions.
- Tokens live in `src/app/globals.css` as CSS custom properties exposed through Tailwind v4 `@theme`. **Components only use semantic tokens.** Raw palette values are banned outside `globals.css`, and a lint rule rejects arbitrary colour classes.
- A non-production `/dev/design` route shows every token and primitive. It's cheaper than Storybook and good enough until the team grows.

### F.2 Tokens

| Group | Tokens |
|---|---|
| Surface | `bg`, `surface`, `surface-raised`, `surface-sunken`, `overlay` |
| Text | `text`, `text-muted`, `text-subtle`, `text-inverse` |
| Line | `border`, `border-strong`, `focus-ring` |
| Brand | `accent`, `accent-hover`, `accent-fg`, `accent-subtle` — **one** accent colour, chosen with the mascot/wordmark (§P) |
| Semantic | `success`, `warning`, `danger`, `info`, each with `-fg`/`-subtle` |
| Document status | One map, `status → {token, icon, label}`: draft (neutral), sent (info), viewed (info + eye icon), approved/paid (success), partially paid (warning), overdue (danger), rejected/void/cancelled/expired (muted). **Always icon + label, never colour alone.** |
| Type | One UI sans with excellent **tabular figures** and full glyph coverage for **₱ € £ ¥** (the ₱ glyph is missing from many fonts; this is a hard requirement). Candidates to test in the brand step: Geist, Onest, Instrument Sans. The scale is 12/13/14/16/18/22/28/36; app body text is 14px, and the public portal and PDFs use 15–16px. |
| Space | 4px base: 1, 2, 3, 4, 6, 8, 12, 16, 24 (×4px) |
| Radius | `sm` 4 · `md` 6 · `lg` 10 · `full`. Restrained. Cards don't get pill corners. |
| Shadow | `sm` (resting controls), `md` (popovers), `lg` (dialogs/sheets). Neutral, offset, no coloured glow. |
| Motion | See §H |

### F.3 Components

- **Primitives:** these come from shadcn on Base UI and are copied into `src/components/ui/`: Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Dialog, Sheet (bottom sheet on mobile), DropdownMenu, Popover, Tooltip, Tabs, Badge, Card, Table, Skeleton, Alert, Toast (Sonner), Avatar, Separator and Pagination.
- **Domain display components:** these are the ones that make TAVI feel like one product:
  - `MoneyAmount`: tabular, currency-aware, negative/zero handling, never animated.
  - `StatusBadge`
  - `DocumentNumber`
  - `DateLabel`: org timezone, with relative time on hover.
  - `LineItemsEditor`
  - `DocumentView`: one renderer for the in-app preview **and** the public portal.
  - `EmptyState`: a mascot slot plus the three-question copy from §29.
  - `EntityList`: table on desktop, stacked rows on mobile, with the same data and no horizontal scroll.
  - `FormField`: label, required marker, description, inline error, and `aria-describedby` wiring.
- **Dark mode:** the tokens are dark-ready, but only light ships in the MVP. The public portal and PDFs are always light.

### F.4 Design-skill precedence

The vendored skills conflict in places, so the order is set here and recorded in `THIRD_PARTY_SKILLS.md`:

1. This document and `DESIGN.md`.
2. `impeccable` and `emil-design-eng` for product UI.
3. `taste-skill` for the marketing page only (its own §13 excludes dashboards).
4. `nextjs-shadcn` and `next-best-practices` for implementation.
5. `frontend-design` and `ui-ux-pro-max` as reference only.

---

## G. UI/UX Strategy

### G.1 Navigation (§24)

- **Desktop:** a left sidebar with **Dashboard · Quotes · Invoices · Payments · Customers · Products & Services**, and Settings pinned to the bottom. Quotes and Invoices come before Customers because they're the daily work.
- **Mobile:** a bottom tab bar, **Home · Quotes · New · Invoices · More** (as built in Phase 0.4). "New" opens a bottom sheet with New quote, New invoice, Add customer and Record payment. "More" holds Customers, Payments, Products & Services and Settings.

### G.2 Dashboard: "what needs my attention?" (§25)

1. **Needs attention** list, ordered by urgency:
   - overdue invoices
   - approved quotes **not yet invoiced**
   - quotes waiting more than 7 days
   - drafts older than 3 days

   Approved-but-not-invoiced quotes are the highest-value nudge in the product.
2. **Money strip**, per currency: Outstanding · Overdue · Paid in the last 30 days.
3. **Recent activity** from the audit log, written in human language, e.g. "Acme approved QUO-000012 · 2h ago".
4. **Quick actions:** New quote, New invoice, Add customer.
5. **First-run:** a 3-step checklist replaces the dashboard until it's complete (§G.5).

### G.3 Quote editor, the critical path (§26)

- **One page, no wizard.** On desktop, the form is on the left and a **live document preview** on the right. The preview is the trust signal: users see exactly what their customer will see. On mobile, the form is stacked, a **sticky total bar** sits at the bottom, and a "Preview" button opens a full-height sheet.
- **Order of fields:** Customer → Line items → Dates → Notes/Terms → Preview → Save/Send.
- **Customer combobox with inline "Create customer"** in a nested sheet. You never leave the quote to add a customer.
- **Line items:** pick from the catalog or type free text; Enter adds a line; lines can be reordered; totals update live from the same `calculateDocument()` the server uses.
- **Smart defaults:** currency comes from the customer, then the org. Valid-until is today plus the org's validity days. Terms default from settings. The last-used tax rate is remembered.
- **Autosave for drafts:** debounced server save with a quiet "Saved" indicator. Nothing is lost.
- **Send dialog:** the email is prefilled with an editable message. **"Copy link" is a first-class alternative to email.** Many small businesses, especially in the PH market, send quotes over WhatsApp, Viber or Messenger. Sending by link must feel just as official.

### G.4 Public portals (§16)

- The business's branding comes first: logo, name, colours stay neutral. A small "Sent with TAVI" footer doubles as a low-key growth loop.
- **Quote portal:**
  - A large, unmistakable **Approve quote** button, sticky at the bottom on mobile, with **Decline** as a secondary action.
  - Approving opens a small dialog asking for the approver's name and a checkbox to accept the terms. Declining asks for an optional reason.
  - A clear confirmation state follows, and the PDF is downloadable.
- **Invoice portal:**
  - The balance due is prominent, and the business's payment instructions sit next to it.
  - Payment history and receipts are listed, and PDFs are downloadable.
  - Online payment is a Phase 4 addition to this page.
- **No third-party scripts on the portals** (see §I).

### G.5 Onboarding: time to first quote (§36–37)

```
Sign up (name, email, password)
  → "What's your business called?" + currency (preselected from locale)   ← only required setup
  → Dashboard with checklist: ① Add a customer ② Create your first quote ③ Send it
```

Everything else is asked **at the moment it matters**. On first send: "Your quote will show your business address and logo — add them now?" (skippable). On the first invoice: payment instructions. Milestone timestamps on `organizations` make up the funnel (§48).

### G.6 Screen contract

Before a screen is built, its spec in the `ui-ux` skill must answer:

- the user goal
- the primary and secondary actions
- the empty, loading and error states
- mobile behaviour
- required permissions

**States:**

- **Loading:** `loading.tsx` skeletons that match the final layout.
- **Errors:** `error.tsx` with human copy, e.g. "Something went wrong. Your quote was not lost. Try again."
- **Buttons:** a spinner **with** present-tense text ("Sending…"), and they're disabled while pending to prevent double submits.
- **Form errors:** inline, next to the field, with focus moved to the first invalid field.

**Confirmations (§33):**

- Confirm only destructive or financial actions: void invoice, void payment, delete draft, cancel quote, record payment (a summary step).
- Saving and sending never need a confirm; sending is reversible through revise.

---

## H. Motion Strategy (§31)

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | Hover, press, focus ring, checkbox |
| `--duration-normal` | 200ms | Dropdowns, popovers, tooltips, toasts, badge change |
| `--duration-slow` | 320ms | Dialogs, sheets, page-level panels |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Anything entering |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Things moving on screen |
| Exit | About 75% of the entry duration | Leaving is faster than arriving |

Rules:

- **CSS transitions first**, driven by Base UI `data-state` attributes. A JS motion library is added only for layout animation (line add/remove, list reorder), and loaded lazily.
- **Press feedback:** buttons scale to 0.97 on `:active`.
- **Money never animates.** Totals never count up or tween, because an intermediate figure is a wrong figure. Only the container around a changed total may flash subtly.
- **Status changes** crossfade the badge. The success moments (Quote sent / approved, Payment recorded, Invoice paid) get a toast plus, where the brand system allows, a brief mascot beat (≤ 800ms). They never block the next action.
- **`prefers-reduced-motion`:** transforms are replaced with opacity-only changes or instant state, and the mascot shows its static pose. Meaning is always also carried by text.

---

## I. Security Model (§40–42)

| Threat | Mitigation |
|---|---|
| **IDOR / broken access control** | Org-scoped repository functions that require `ctx`; Not Found for foreign IDs; composite foreign keys; `assertCan` in every use case; a **tenant-isolation test suite** that seeds two orgs and runs every query and command from each side (§J). |
| **Public link guessing / leakage** | 256-bit random tokens (base64url), with **only the SHA-256 hash stored**, so a database leak doesn't expose live links. Each token is scoped to exactly one document, revocable and expiring: quotes at valid-until + 30 days, invoices 90 days after they're paid. Access is rate-limited per IP. Portal responses carry `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`. **No analytics or third-party scripts on portals**, because the token sits in the URL. |
| **Forwarded link approved by the wrong person** | Accepted risk for the MVP (it's normal industry practice). It's mitigated by the typed name, the content hash, IP/user-agent capture, an audit entry and an instant email to the business. Optional email-OTP approval can be added later as a per-org setting. |
| **XSS** | React escaping only. `dangerouslySetInnerHTML` is banned by lint. Notes and terms are **plain text** rendered with `white-space: pre-wrap`, with no markdown/HTML in the MVP. A nonce-based CSP applies. |
| **Malicious uploads** (logo only in MVP) | PNG/JPEG/WebP checked by **magic bytes**, not extension; max 2 MB; **re-encoded server-side with sharp** (strips metadata and payloads); **no SVG**. Stored in object storage under a random key and served via signed or proxied URL. **As built (1.1):** stored in Postgres (`files.data`, ≤ 1 MiB after re-encoding, checked by the database), `limitInputPixels` against decompression bombs, served only to the owning organization with `Content-Security-Policy: sandbox` and `nosniff`. |
| **SQL injection** | Drizzle parameterization. `sql.raw` is lint-banned outside `db/`. |
| **CSRF** | Server Actions get Next's Origin check, and cookies are SameSite=Lax. Mutating route handlers check `Origin` explicitly. The public approve/decline goes through a POST server action, never a GET. |
| **Session attacks** | See §D: rotation, hashed tokens, revocation, fresh-auth for sensitive changes. |
| **Brute force / abuse** | A Postgres-backed limiter on sign-in, sign-up, reset, public portal views and approve/decline, and **send actions** (per-org daily email cap). |
| **Platform used for phishing** | Sending requires a verified email. Mail goes out as `"<Business> via TAVI" <notify@…tavi domain>` with **Reply-To set to the business**, so a customer's domain is never spoofed. Send caps apply, and there's a report-abuse link in the footer. |
| **Information leakage** | A typed error → human message map at the boundary; no stack traces; enumeration-safe sign-up and reset copy; `server-only` import guards on server modules; secrets are never `NEXT_PUBLIC_`. |
| **Secrets / config** | `shared/env.ts` validates all env with Zod at boot and fails fast. |
| **Headers** | HSTS, CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` and a Permissions-Policy. |
| **Supply chain** | Committed lockfile, `npm audit` in CI, Renovate with grouped weekly updates. |
| **Data loss** | Neon point-in-time restore, and a documented restore drill before beta. |

**Threat-model review** is mandatory (via the `auth-security` skill) for any change touching auth, sessions, authz, public links, uploads or money movement.

---

## J. Testing Strategy (§43)

| Layer | Tooling | Covers |
|---|---|---|
| **Unit** (`npm test`, which the pre-commit hook runs, so it must stay fast) | Vitest + **fast-check** for property tests | `calculateDocument()` (properties: total = Σ lines; never negative; inclusive/exclusive consistency; rounding mode), currency exponents and formatting, quote and invoice state machines (**table-driven: every state × every event**), payment status derivation, the authz matrix (snapshot of role → capabilities), number formatting, token hashing. **Test-first for all `domain/` code.** |
| **Integration** (`npm run test:int`) | Vitest against **real Postgres**: the Neon `test` branch locally, a `postgres:18` service container in CI. There's one migrated template DB, and each test file runs in a transaction that's rolled back. | Every use case: quote lifecycle, conversion idempotency, invoice lifecycle, payment lifecycle, audit rows written, outbox rows written in the same transaction. **Concurrency tests:** 50 parallel issues must produce 50 unique consecutive numbers; two concurrent payments must never exceed the balance. **Tenant-isolation suite** over every repository function. PGlite was rejected here because it can't exercise row-lock concurrency. |
| **E2E** (`npm run test:e2e`) | Playwright; desktop and mobile (Pixel/iPhone) projects; `@axe-core/playwright` | The §43 critical path end-to-end (sign-up → org → customer → quote → send → portal approve → convert → record payment → PAID). Smoke tests for the auth flows. Axe checks on every key screen. |
| **Visual/manual QA** | A checklist in the `ui-ux` skill | The small phone, large phone, tablet and desktop matrix from §59. |

**CI (GitHub Actions)** runs lint, typecheck, unit, integration and E2E on every PR, and on the `main`/`staging` branches.

---

## K. Observability Strategy (§45)

- **Logging:** a pino JSON logger in `shared/logger.ts`. Each line carries the request ID (from `x-vercel-id`, or generated in `proxy.ts`), route, `organizationId`, `userId`, duration and outcome.
  - **Redaction paths** are configured centrally: passwords, tokens, cookies, `authorization`, share-link tokens and email bodies.
  - IDs are logged instead of emails or names.
- **Errors:** Sentry (`@sentry/nextjs`) via `instrumentation.ts`, covering server, edge and client, with PII scrubbing and release tagging.
- **Tracing:** OpenTelemetry through Next's built-in instrumentation hook, exported to Sentry performance for now.
- **Health:** `/api/health` (liveness) and `/api/health/ready` (database ping plus outbox backlog). An external uptime pinger watches both.
- **Background work:** the outbox exposes a pending count and the age of its oldest message. It alerts if a message is older than 15 minutes or any message reaches 5 attempts.
- **Database:** Neon metrics plus `pg_stat_statements` for slow queries, reviewed weekly during beta.
- **Product funnel** (§48): derived from organization milestone timestamps plus `audit_events`, exposed as a SQL view. **No separate analytics SDK in the MVP.** A `track()` port exists so PostHog can plug in later, but never on public portals.
- **Audit ≠ logs:** audit events are durable business records in Postgres. Logs are operational and disposable.

**Background jobs (§47):**

- There's **no job system**.
- Emails go through a **transactional outbox**: the row is written in the same transaction as the business change, then flushed right after commit via Next's `after()`.
- A Vercel Cron route (every 5 minutes) retries failures with backoff.
- A **daily status job** (Vercel Cron, runs hourly and processes each org whose local date has rolled over) moves quotes to `EXPIRED` and invoices to `OVERDUE`. It's idempotent and audited as `system`; commands still re-check dates themselves (§B.3–4).
- The same daily run queues overdue reminder emails.
- So an email failure can never corrupt or roll back financial state (§46).

---

## L. Claude Code Skills Structure (§49–55)

⚑ **Pushback (accepted, D4):** the brief lists 21 skills. Many would be thin, overlap each other, and overlap the 7 vendored design skills already present. Thin, overlapping skills cause conflicting guidance and poor triggering. The proposal is **13 project skills**, each with a distinct job. The brief's full list is kept as a mapping so nothing is lost.

```
CLAUDE.md                  → @AGENTS.md (Next 16 regenerates its block there) + project rules, commands, module map
PRODUCT.md, DESIGN.md      → impeccable-format product + visual context
.claude/skills/
  architecture/            modular-monolith rules, module anatomy, dependency direction, ADR template (Why/Alternatives/Tradeoffs/Future impact), performance rules
  database/                drizzle conventions, composite tenant FKs, migrations workflow, indexing, transactions & locking
  financial-domain/        money/rounding/tax spec, numbering, state machines, snapshots, payments invariants, "money never animates"
  auth-security/           sessions, authz capabilities, tenant isolation, public links, uploads, threat-model checklist
  ui-ux/                   §56 product-design questions, screen contract, states, forms, error copy, mobile QA matrix
  design-system/           tokens, primitives, domain components, no one-off styling, precedence of vendored skills
  motion-design/           duration/easing tokens, what may animate, reduced-motion rules
  brand-experience/        TAVI voice & naming convention, mascot usage rules & states, illustration style, micro-interaction catalog
  accessibility/           WCAG 2.2 AA checklist, axe in E2E, focus management, dialog/sheet patterns, no colour-only meaning
  testing/                 pyramid, TDD for domain, what each change must add, fixtures, concurrency & isolation suites
  code-review/             Definition of Done (§63) as a checklist; "would I ship this?"
  ops/                     observability, env/secrets, deploy, migrations in prod, incident notes
  product/                 funnel, analytics events, startup-validation questions, "is this MVP?" gate
```

| Brief's skill | Lives in |
|---|---|
| architecture, performance | `architecture` |
| backend | `architecture` + `financial-domain` |
| database | `database` |
| authentication, authorization, security | `auth-security` |
| payments, financial-domain | `financial-domain` |
| product-design, ui-ux | `ui-ux` |
| frontend | `design-system` + vendored `next-best-practices`/`nextjs-shadcn` |
| design-system | `design-system` |
| motion-design | `motion-design` |
| brand-experience | `brand-experience` |
| accessibility | `accessibility` |
| testing | `testing` |
| code-review | `code-review` |
| observability, devops | `ops` |
| product-management, startup-validation | `product` |

The full 21 can still be split out if you prefer. It's a mechanical change.

---

## M. MVP Roadmap

Every milestone ends green on lint, typecheck and tests, is reviewed against `code-review`, and is committed. UI milestones also go through the §57 visual loop in the browser at mobile and desktop widths.

### Phase 0: Foundation

| # | Milestone | Exit criteria |
|---|---|---|
| 0.1 | **Scaffold:** Next 16 (read bundled docs first), TS strict, Tailwind v4, shadcn/Base UI, ESLint + boundaries rule, Vitest, Playwright, husky scripts, `env.ts`, CI, fix `launch.json`, rewrite `THIRD_PARTY_SKILLS.md` precedence, `CLAUDE.md` and `PRODUCT.md`. (`DESIGN.md` moves to 0.4: impeccable writes it together with the visual direction.) | `npm run dev` serves a page; CI green |
| 0.2 | **Database:** Drizzle over node-postgres (`pg`: real transactions and row locks), Neon branches (`dev`, `test`), migrations, UUIDv7 via `uuidv7()`, `organizations` and `document_sequences` tables with gapless numbering, a test-DB harness that refuses to wipe the app database. **Memberships moved to 0.3**, because they reference users, which arrive with Better Auth. The tenant-isolation suite grows with the first tenant-owned tables (0.3 and Phase 1). | The integration test suite runs locally and in CI |
| 0.3 | **Identity & authz:** Better Auth, sign-up/in/out, verify, reset, session policy (§D), sessions page, `requireOrgContext`, capabilities + matrix tests. Also brought in from 0.2: memberships, plus minimal onboarding (business name + currency), since an organization context needs an organization. | Auth E2E smoke tests green; authz unit tests green |
| 0.4 | **Design foundations:** tokens, font, primitives, domain display components, app shell (sidebar + mobile tab bar + New sheet), empty/loading/error patterns, `/dev/design`, **wordmark + chosen mascot direction** (placeholder component API) | Visual review at 4 breakpoints; axe clean |
| 0.5 | **Platform:** logger, Sentry, health routes, audit module, outbox + console email adapter, rate limiter, security headers/CSP. **As built:** a small dependency-free structured logger (JSON in production, secrets redacted, credentials scrubbed from strings) instead of pino; `instrumentation.ts` logs every unhandled server error. **Sentry is deferred** until the Sentry account and DSN exist; it plugs into the same hook. Nonce-based CSP makes every page render per request. Audit log is append-only via a database trigger. Outbox claims rows with `FOR UPDATE SKIP LOCKED` and has a Resend adapter. A Postgres fixed-window rate limiter serves routes outside Better Auth. | Headers verified; the outbox retry test passes |
| 0.6 | **Skills:** write the 13 project skills from what was actually built (not before). **As built:** named with a `tavi-` prefix (`tavi-architecture`, …, `tavi-product`), so they never clash with Claude Code's built-in skills such as `code-review`, and it's obvious they're project rules. Listed in `CLAUDE.md`. | Skills reviewed |

### Phase 1: Money MVP (vertical slices, each usable end-to-end)

| # | Slice |
|---|---|
| 1.1 | Onboarding (business + currency) and Settings: business profile, logo upload, defaults, payment instructions, tax rates, numbering prefixes **As built:** business profile columns on `organizations` (legal name, TIN, contact, address, quote validity and payment-terms days, default notes/terms, payment instructions); the logo lives in a new `files` module as **Postgres `bytea`** (no object storage on the free tier), re-encoded by sharp to fit 600 px (PNG if transparent, else JPEG), one per organization, served to members only from `/api/files/[id]`; `tax_rates` in the `catalog` module (basis points, one default, archive/restore, unique active names); numbering prefix/digits edit the existing `document_sequences` row and never reset the counter. Settings pages `/settings/business`, `/settings/tax-rates`, `/settings/numbering` are read-only for members; every change needs `organization.manage` and is audited. The receipt kind is labelled **"Payment acknowledgements"** in the UI (D11). No tax rate is seeded: non-VAT businesses leave it empty; the empty state offers the market's suggested taxes as presets (D12). |
| 1.2 | Customers: list, search, create (including inline from the quote editor), edit, archive **As built:** `customers` module and table (flat address columns like the business profile, nullable `currency` = "bill in the business's currency", `UNIQUE (organization_id, id)` as the target for composite foreign keys from quotes and invoices, index on `(organization_id, lower(display_name), id)`). List at `/customers`: search across name, company, email and phone (`ILIKE` with wildcards escaped), Active/Archived views, 25 per page, all as GET parameters so it works without JavaScript. Add at `/customers/new` (only the name is required), edit on `/customers/[id]`, archive with an Undo toast instead of a confirmation (reversible). All roles hold `customers.read/write`; every change is audited (field names only, no contact details in the log). The reusable `CustomerForm` takes an `onSaved` callback so the quote editor can embed it in a sheet: the **inline create ships with the editor in 1.5**. App-wide `error.tsx` (retry + reference) and `not-found.tsx` (same page for missing and foreign IDs) were added. |
| 1.3 | Products and Services (two lists, one shared picker in the editor) **As built:** `products` and `services` tables in the `catalog` module, same shape except the product SKU (unique per business, case-insensitive). Prices are typed in the business's locale and parsed exactly into integer minor units of the item's own currency (`parseMoneyInput`, no floats; `formatAmountForInput` writes them back). The optional default tax rate is a composite foreign key `(organization_id, tax_rate_id) → tax_rates(organization_id, id)`, so an item can't point at another business's rate; a newly chosen rate must be active, and an archived one an item already uses may stay. New items start with the business's currency, its default tax rate and the market's usual unit (`units` in the market profile: PH "pc" / "hour"). One set of use cases serves both kinds; `searchLineSources` returns active products and services together for the editor's picker (UI in 1.5). Screens: `/catalog` (Services first, then Products; search, archived view, paging), `/catalog/{services|products}/new` and `/{id}`; archive has Undo. Shared list controls (`ListSearch`, `ListViews`, `ListPager`) and `ArchiveToggle` now serve customers and catalog. |
| 1.4 | **Money engine** (`calculateDocument`, property tests), built test-first *before* any editor UI **As built:** `calculateDocument({ taxMode, lines })` in `src/modules/documents/domain/calculation.ts`, exported from `@/modules/documents` and, for the editor's live preview, `@/modules/documents/client`. Integer-only: products are computed in BigInt and every result must be a safe integer (a `RangeError` means input beyond the form limits). Returns per-line gross/discount/net/tax/total, document subtotal/discount/tax/total, and tax grouped per name + rate in order of first use (a 0% rate still shows as a group). Quantities are scaled ×10 000 (`parseQuantityInput` / `formatQuantity`, up to 999,999.9999). Verified by hand-worked examples (each checked with exact fractions) and 8 fast-check properties (total = Σ lines; all amounts non-negative safe integers; discount ≤ gross; exclusive total = net + tax, inclusive total = net with tax inside; inclusive ↔ exclusive within one minor unit; breakdown sums to the tax total; line order doesn't matter; input never mutated; `roundDiv` exact), also run once at 20 000 cases each. Typed numbers (prices, quantities, tax percentages) now share one locale-aware parser (`parseDecimalInput`), so the tax-rate percentage also reads "19,5" in de-DE and `formatRate` follows the locale. |
| 1.5 | Quotes: editor + live preview + autosave, numbering, send by email **and** copy link, revise, cancel **As built (1.5a, drafts and editor):** `quotes` and `quote_lines` (migration 0010; composite keys to the business's customers; totals stored from `calculateDocument`; each line snapshots its tax name and rate and keeps the rate id so a draft can reselect it). State machine in `quotes/domain/transitions.ts` with a table test of every status × event. Drafts parse through `parseQuoteDraft` / `parseDocumentLines` (same code in the browser and on the server; errors keyed `lines.<n>.<field>`). The editor (`/quotes/new`, `/quotes/[id]`): Base UI comboboxes for customers (with inline "Add a new customer" in a sheet) and products/services, free-text lines, per-line discount and tax, reorder, live preview through the shared `DocumentPaper` / `buildDocumentView`, and autosave (debounced; one save at a time; the draft is created on the first change so opening the page saves nothing; the address switches to the draft's URL). Mobile: sticky total bar and a preview sheet. Autosaves aren't audited (created/deleted are). Dates are calendar days in the business's time zone (`todayIn`). Sending, links, revise and cancel follow in 1.5b. **As built (1.5b, sending):** `sendQuote` (verified sender required; customer, at least one item and a valid-until date from today; number allocated at first send, kept by revisions; customer snapshot with market-formatted address; old links revoked, a new share link opened; audited with channel; optional email through the outbox as "Business via Tavi" with Reply-To the business). `share_links` (migration 0012): 256-bit base64url tokens, SHA-256 stored, revocable, expiring at valid-until + 30 days. `createQuoteLink` (another link, earlier ones stay open), `reviseQuote` (DRAFT, revision + 1, today's date and a fresh valid-until, live customer again, links revoked), `cancelQuote` (optional reason, links revoked). Customer page `/q/[token]`: read-only quotation with letterhead ("VAT Reg TIN …") and the supplementary-document notice (D13), rate-limited per IP, one neutral page for unknown/revoked/expired links, portal headers (`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `no-store` in production), logo served through the token. Send dialog: email or copy link as equals; the editor saves its latest content before sending. Approve/decline and VIEWED are 1.6. |
| 1.6 | Public quote portal: approve/decline, business notification email, VIEWED tracking **As built:** `recordSharedQuoteOpen` marks a SENT quote VIEWED on the first open (audited as `customer`; skipped when a member of the business opens its own link). `decideSharedQuote(token, …)` (no session; the token is the authorization): approve needs a typed name and the terms box, decline takes an optional reason (`QUOTE_DECISION_LIMITS`); re-checks valid-until in the business's time zone and expires the quote on the spot (audited as `system`); refuses a decided/closed quote; binds to content: the page sends `sharedQuoteContentHash` (SHA-256 of the canonical content, not status or timestamps) and a mismatch is refused; stores name/reason, hash, IP and user agent; audits `quote.approved`/`quote.rejected` with IP/UA; emails every member who can `quotes.read` (confirmed emails only) through the outbox. Rate-limited per IP (10/min). The customer page shows Approve (primary, sticky on phones) and Decline, each in a dialog, then a confirmation; the business's quote page shows "Opened by the customer", "Approved by … · time" or "Declined · reason". Manual approve/reject by the business (`quotes.decide`), the daily expiry job and the PDF download follow later. |
| 1.7 | Convert → invoice; invoice editor/issue/send; public invoice portal; void & duplicate **As built (1.7a, drafts, conversion, sending):** `invoices` and `invoice_lines` (migration 0013; same shape as quotes plus `due_date`, `payment_instructions` snapshotted at issue, `amount_paid_minor` for 1.8 with a no-overpayment check, and `source_quote_id` UNIQUE with a composite foreign key to the business's quotes); quotes gain `converted_at` / `converted_invoice_id`. The draft parser is shared (`parseDocumentDraft` in documents; `parseQuoteDraft` / `parseInvoiceDraft` name the second date). Invoice state machine (`invoices/domain/transitions.ts`, table-tested) and the one status function `issuedInvoiceStatus` (§B.4). `convertQuoteToInvoice`: APPROVED and not yet converted; copies customer, line snapshots, notes and terms into a DRAFT dated today with the payment terms; the quotes module locks and marks the quote (`lockApprovedQuoteForConversion`, `markQuoteConverted`), so invoices never touch the quotes tables; a second call finds the same invoice; a converted quote can't be cancelled, and deleting the draft invoice frees it again. `issueInvoice`: verified sender, customer and an item; number from the invoice series; customer snapshot; status from `issuedInvoiceStatus` (OVERDUE straight away if backdated); link at `/i/<token>` (open until due date + `INVOICE_LINK_DAYS_AFTER_DUE`, interim until 1.8 closes links 90 days after payment); optional email through the outbox. Customer page `/i/[token]`: balance due and how to pay first, then the document with the supplementary-document notice (bills are billing statements until invoice mode, D13); first open recorded (`viewedAt`, audited) unless a member opens it; portal headers now cover `/q/` and `/i/`. The quote editor became the shared `DocumentEditor` (`src/app/(app)/_documents/`), given its kind and its draft's server actions. Documents take the market's names (PH: "Billing statement"); navigation keeps the app's section names. **As built (1.7b, corrections):** `editIssuedInvoice` (SENT/OVERDUE, no payments; customer and currency fixed; revision + 1, `edited_at` (migration 0014), full before/after lines and totals in the `invoice.edited` audit, status recomputed; same link, the customer's page says "Updated …"). `voidInvoice` / `cancelInvoice` (D6; `invoices.void`, reason required, `INVOICE_REASON_MAX`, number kept, link stays open and says so). `voidAndDuplicateInvoice` (void + a new DRAFT with the same customer, lines, notes and terms, dated today, in one transaction). UI: `/invoices/[id]/edit` is the shared editor in "issued" mode (no autosave; "Save changes" confirms in a dialog); the invoice page offers Copy link, Edit, Void and duplicate, Void, Cancel (reason dialogs). **Next:** 1.7c invoice mode (moved after 1.11 by D14) (D13, pending the founder's D7 decision and the RDO/CPA answers). |
| 1.8 | Payments + receipts; payment status; void payment **As built:** `payments` module and table (migration 0015): `amount_minor` received plus `withheld_minor` (tax the customer withheld, PH Form 2307; both settle the balance), method (`PAYMENT_METHODS`, named per market in `paymentMethodLabels`; `taxWithheld` label/hint per market, null where there's none), reference, notes, receipt number from the receipt series, `provider`/`provider_payment_id` for gateways later, void fields (never deleted). `recordPayment` (`payments.record`): invoice locked first through the invoices seam (`lockInvoiceForPayment`, `settleInvoice`, so payments never touch invoice tables), only SENT/PARTIALLY_PAID/OVERDUE (`isPayable`), no overpayment, date not in the future, settled = Σ active (amount + withheld), status from `issuedInvoiceStatus`, link closes 90 days after it's paid (`INVOICE_LINK_DAYS_AFTER_PAID`, §I), audited, optional payment acknowledgement email to the customer (notice + "Not a BIR official receipt."). `voidPayment` (`payments.void`, reason required): same lock order, status recomputed; editing (D7) unlocks again only when no active payments remain. UI: Payments panel on the issued invoice (balance, Record payment dialog with method, reference, Form 2307 field and the acknowledgement checkbox; history with Void), acknowledgement page `/payments/[id]` (`AcknowledgementPaper`), Payments list `/payments`, "Payments received" on the customer's `/i/` page. `/payments/new` was removed: the New menu's Record payment opens the invoices list. |
| 1.9 | PDFs: quote, invoice and receipt (with ₱/€ glyph verification) **As built:** `@react-pdf/renderer` 4.9.0 (on Next's server-external list) draws `DocumentPdf` (quotes, invoices) and `AcknowledgementPdf` from the same view-models as the web paper (`DocumentView`, `AcknowledgementView`, now built once by `acknowledgementView`). Geist Regular/SemiBold (OFL, licence alongside) are embedded from `src/components/document/pdf/fonts` and shipped with every `/**/pdf` route (`outputFileTracingIncludes`); a test checks the fonts have every character money formatting prints in every offered currency and locale (₱ € £ ¥…), and that 60 lines break across pages (the table header and "Page n of m" footer repeat on each page). Logos are embedded as data URIs (`pdfLetterhead`). Downloads: members at `/quotes|invoices|payments/[id]/pdf` (drafts say "Draft"); customers through their link at `/q/[token]/pdf`, `/i/[token]/pdf` and `/i/[token]/receipts/[number]/pdf` (rate-limited, active payments only). Responses are attachments with ASCII file names (`pdfFileName`), `private, no-store`, `noindex`. "REPRINT" marking belongs to invoice mode (1.12). |
| 1.10 | Dashboard (needs attention, money strip, activity) + first-run checklist **As built:** the three-step checklist shows until the first quote is sent, each step ticked from real data (`listCustomers`, `quoteProgress`); funnel milestone timestamps (§48) are not stored yet. Then the dashboard: quick actions; a money strip per currency (Outstanding and Overdue from `invoiceMoneySummary`, judged by due date so it's right before the daily job exists; Paid in the last 30 days from `paymentsReceivedSince`, cash only); Needs attention, most urgent first: overdue (`overdueInvoices`), approved but not invoiced, unanswered after 7 days, drafts untouched for 3 days (`quotesNeedingAttention`; thresholds in `DASHBOARD_RULES`); Recent activity from the audit log in plain words (`describeActivity`, market document names, `timeAgo` via Intl), shown to people with `audit.read`. |
| 1.11 | **Hardening:** full critical-path E2E, a11y pass, mobile QA matrix, security review, performance pass, backup restore drill, production deploy **As built (1.11a, daily status job):** `/api/cron/daily` (CRON_SECRET) runs `expireQuotesPastValidity` and `markOverdueInvoices` for each business on its own calendar day (`listOrganizationClocks`), audited as `system` (`invoice.overdue` added), idempotent; `vercel.json` schedules it daily at 16:05 UTC and the outbox at 16:20 UTC (Hobby allows daily crons only). **As built (1.11b, security review, first pass):** nothing on a customer page is taken from the browser except the token, the decision and the content hash (the expired-quote message now uses the business's locale and name, §B.3); the send dialog's choice is re-checked on the server by `parseDelivery` (`DELIVERY_LIMITS`: address ≤ 254, message ≤ 2,000, shared with the dialog), so a malformed or oversized request gets a message instead of a server error; the portal logo routes are rate-limited (`portal-logo:` bucket, `PORTAL_RATE_LIMIT`) like every other token lookup; an incoming `x-request-id` is kept only if it's a short plain ID (`acceptRequestId`), else replaced, in `proxy.ts` and in error logs; the customer's approve/decline is shape-checked (`parseQuoteDecision` takes `unknown`; the terms box counts only when literally `true`; a malformed post gets "Your answer didn't come through…" and leaves the quote untouched); error logs carry `loggablePath` (no query string, `/q/[token]`, `/i/[token]`), since customer-link tokens are in the path. Reviewed and fine as built: authz in every command, UUID checks on ids, tenant-scoped reads, token hashing/expiry/revocation, escaped email HTML, outbox bodies dropped once sent, cron secret, CSP and portal headers, Better Auth rate limits and session policy. Known, accepted: the hosting platform's own access logs still record full portal URLs; failed outbox messages keep their body for diagnosis. Per-business email limit (founder, 2026-10-02): `DOCUMENT_EMAIL_LIMIT` = 50 emails per hour, counted from the business's outbox rows (`documentEmailsAllowed`, index `outbox_messages_organization_created_idx`, migration 0016); checked before anything changes, so over the limit a quote or invoice stays a draft ("Copy the link instead") and a payment isn't recorded until it's retried without the acknowledgement email. Every outbox row with the business's id counts, including approve/decline notices to the business. Verified on Postgres 18 (integration) and a production build (E2E, desktop + mobile). **As built (1.11c, critical-path E2E and device matrix):** `e2e/critical-path.spec.ts` walks customer → quote → sent by link → customer approves → billing statement → sent → customer sees the balance → payment recorded → customer sees it paid and gets the acknowledgement PDF, on desktop **and** Pixel 7 (it runs as the shared setup owner, now email-confirmed in `auth.setup.ts`, so it adds no sign-ups); every step is axe-checked (toasts excluded mid-animation) with no sideways scroll, and the customer pages are also checked at 320px. `e2e/device-matrix.spec.ts` covers small phone (320), large phone (430) and tablet (768), all touch, on every signed-in screen (`e2e/screens.ts`, shared with app-shell): no sideways scroll and touch targets ≥ 44px. Fixes it found: back links, list-view tabs, the phone top bar's wordmark and dashboard activity links were 24–40px tall on touch (now 44px), and the combobox's clear/open buttons grew to 40px inside its 44px field. **As built (1.11d, performance pass):** measured on a production build with one business holding 60 customers, quotes, billing statements and 30 payments: SQL statements per request are constant as data grows (dashboard 13, run in parallel; lists 5; document pages 8–10; customer pages 9–10; PDFs 6–8), so no N+1; every filter and sort has an index (checked against `pg_indexes`); server time 15–50 ms per page and 70–100 ms per PDF against a local database; about 180 kB of gzipped JavaScript per page, shared by every route (Next/React runtime), and 16 kB of CSS. The one real problem was distance: Vercel runs functions in Washington (`iad1`) by default while the database is in Singapore, so each of the dashboard's queries would have crossed the Pacific. `vercel.json` now pins functions to `sin1` (Hobby allows one region), guarded by `src/config/vercel.test.ts`. **As built (1.11e, restore drill and deploy runbooks):** `npm run db:restore-check -- save|check <file>` (`src/db/restore/restore-check.ts`, read-only, self-contained) fingerprints every table (row count + md5 of its rows) and compares a database restored from Neon's history with the moment it was taken, ignoring tables that change on their own (sessions, verifications, rate limits); dry-run here against a copied database (match, then a one-row edit caught). `docs/runbooks/restore-drill.md` restores into a new branch from a past point, never over `production`; `docs/runbooks/production-deploy.md` covers push, env vars, migration, deploy, cron and smoke checks, and rollback. **Left for the founder (needs the Neon and Vercel accounts):** push to GitHub, run the drill on the real project, and do the first deploy by those runbooks. |
| 1.12 | **Invoice mode (D13, D14), last:** BIR registration details (AC/PTU number, date, approved series), "Invoice" titles, full Sec. 6(B) contents (VAT breakdown, buyer TIN rule, SC/PWD discount), numbering inside the approved series, issued invoices locked (void & reissue; credit notes later), and EIS/JSON readiness, after the RDO/CPA answers **As built (1.12a, the parts that don't depend on the RDO/CPA answers; founder, 2026-10-02):** `invoice_registrations` (migration 0017, one row per business, owned by the invoices module): certificate number, date issued, approved series and printed title (from `market.invoiceRegistration.titles`), plus the serial counter and `turned_off_at`; Settings → Invoice registration (`/settings/invoicing`, `organization.manage`, audited `invoice.registration_saved` / `invoice.registration_turned_off`, turning off asks first). `parseInvoiceRegistration` (no future date, series ≥ 1, end ≥ start and never below a serial already issued). In invoice mode `issueInvoice` takes the next serial under a row lock (`claimRegisteredSerial`: gapless, a rollback gives it back, refused once the series is used up, leaving the draft untouched), prints it zero-padded to the series width, and snapshots the registration on the invoice (`invoices.registration`), so later changes never alter what was printed. Registered invoices take their title everywhere (page, editor, email, portal, PDF, acknowledgements, activity), drop the supplementary-document notice and print the registration at the foot (B.21, `registrationFooter`); they can't be edited once issued (`canEditIssued`, `REGISTERED_INVOICE_LOCKED`, D14), void & duplicate is the correction. Billing statements already sent stay as they were; turning invoice mode off keeps the counter. **As built (1.12b, contents from the regulation text, founder 2026-10-02):** saving a registration needs the business's tax registration first. Each registered invoice keeps its sales breakdown in its snapshot (`salesBreakdown`): VAT-registered sellers get VATable Sales, VAT Amount, Zero-Rated Sales and VAT-Exempt Sales (B.13), from the convention that a rate above 0% is VATable, a 0% rate is zero-rated and no tax is VAT-exempt, with "Zero-rated sale" / "VAT-exempt sale" on those lines (B.14); non-VAT sellers get "Sales Subject to Percentage Tax" (B.17) and exempt sellers "EXEMPT" (B.16). Labels and the ₱1,000 buyer-TIN threshold live in the market profile; the send dialog reminds (never blocks) when a registered invoice reaches it and the customer has no TIN (Sec. 3 B.4, `buyerTaxIdReminder`). **As built (1.12c, REPRINT; D19, 2026-10-08):** `invoices.print_count` and `first_printed_at` (migration 0023, with 1.12d's columns). The business's and the customer's PDF routes count each PDF of an issued registered invoice in one `UPDATE … RETURNING` (`recordInvoicePrint`, `recordSharedInvoicePrint`; concurrent downloads can't both be the original), audited `invoice.printed` / `invoice.reprinted`; `copyForPrint` makes print 1 the original and every later one a reprint, which prints the market's `invoiceRegistration.reprint` ("REPRINT") boxed at the top of the PDF. The invoice page's button says "Download reprint" once printed. Drafts and billing statements aren't counted. **As built (1.12d, qualified discounts; D19):** market `qualifiedDiscounts` (PH: senior citizen, PWD, solo parent, national athlete or coach, Medal of Valor awardee, each with its rate, VAT treatment and ID label). `calculateDocument` takes an optional `qualifiedDiscount { rateBps, taxExempt }` and returns per line and in total `qualifiedDiscountMinor` and `taxWaivedMinor` (unit and property tests). The bill snapshots the kind, rate, tax treatment, ID label, ID number and name (`invoices.qualified_discount`, plus `qualified_discount_minor` and `tax_waived_minor` on bills and lines, migration 0023); `parseInvoiceDraft` checks it against the market and refuses it alongside item discounts. Editor: a "Special discount" section on bills; the document shows the B.18.b breakdown (Total Sales (VAT Inclusive), Less: VAT, Amount Net of VAT, Less: discount, Add: VAT, Total Amount Due) in place of the usual totals, the buyer's name and ID, and a signature line. A registered invoice's sales breakdown counts a tax-exempt discounted sale as VAT-exempt, before the discount; reports show sales before special discounts, then the discounts, and the sales CSV gains a "Special discount" column. Edits before payment, void & duplicate and the data download carry it. The Privacy Notice and the processing register name the new (sensitive) data; `LEGAL.version` is 2026-10-08. **As built (1.12e, e-invoice export; D19):** `buildEInvoice` (invoices domain) lays a registered invoice out as structured data (seller, buyer, system registration, lines with sale type, special discount, totals with the B.13–B.17 breakdown and the tax withheld from active payments); `e-invoice-format.ts` is the one mapping file to JSON (decimal strings, ISO dates, a `format` block saying TAVI isn't BIR-certified). `registeredInvoicesForExport` (invoices) + `taxWithheldByInvoice` (payments) + the business profile come together in `eInvoiceFor` / `eInvoicesForPeriod` (reports module, `reports.read`). Downloads: "Download e-invoice" on a registered invoice, and "Download e-invoices (JSON)" in Reports → Sales (void and cancelled invoices included, marked, so the series has no gaps). Not done: transmission to the BIR, PTI/EIS certification and the official field names, which need the EIS specification. |
| 1.13 | **Beta readiness:** the product funnel (§K, §48) and the Data Privacy Act basics (privacy notice, processor terms with businesses, processing register) **As built (1.13a, funnel):** the `business_funnel` view (migration 0018) gives each business's first customer, quote, sent quote, approval, bill, sent bill and payment, plus its last user activity, straight from the audit log (no new writes, no analytics SDK). `npm run funnel` (`src/db/funnel/funnel.ts`, read-only, `FUNNEL_DATABASE_URL`) prints how many businesses reached each step, the median time from business created to first sent quote (the north star) and each business's furthest step. **As built (1.13b, privacy notice and terms; founder 2026-10-02, D15):** public pages `/privacy` and `/terms` (route group `(legal)`, `LegalDocument`), linked from sign-up, the sign-in pages' footer, the home page and the customer pages (`LegalLinks`). The Privacy Notice covers Tavi as controller for account data (RA 10173 Sec. 16(b)); the Terms include the data processing terms that make Tavi each business's processor (Sec. 14, IRR Sec. 44). Who runs Tavi and the documents' version live in `src/config/legal.ts` (`LEGAL`), not in a market profile, since the law that governs the operator doesn't change with the country a business bills in; the operator details are placeholders and the pages say "Draft" and list what's missing (`missingLegalDetails`) until they're filled in. Sign-up needs the box "I agree to the Terms of Service and have read the Privacy Notice": the form sends `termsVersion`, and Better Auth's user-create hook refuses anything but the current `LEGAL.version` (`acceptedTermsVersion`, `TERMS_NOT_ACCEPTED`), then stamps `users.terms_version` and `terms_accepted_at` from the server's clock (migration 0019; the time can't be sent by the browser) and records the version on `auth.signed_up`. `docs/compliance/processing-register.md` is the record of processing activities (purposes, bases, sub-processors, retention, security, breach response, open items). **Left for the founder:** fill in `LEGAL.operator`, a lawyer's review of both documents and the register, and whether NPC registration applies; account closure and export are by email for now, and there's no re-acceptance screen yet for a new version (both done in 1.13c). **As built (1.13c, beta-prep gaps; founder 2026-10-02, D16):** a new `privacy` module orchestrates other modules through their public entry points (nothing depends on it). *Agree again:* `OrgContext.termsVersion`; the app layout sends anyone whose version isn't `LEGAL.version` to `/accept-terms` (checkbox, "Agree and continue" or "Sign out instead"); `acceptTerms` takes only the current version, stamps the server's time and audits `auth.terms_accepted`. *Download your data:* Settings → Account and data → `/settings/account/export` (owners and admins, `organization.manage`; others get 404), one JSON file `tavi-export-<date>.json` with the business, the person's account, tax rates, products, services, customers, quotes and bills with their lines, payments and the invoice registration, read in one repeatable-read transaction, notes explaining minor units and basis points, no link tokens, logo bytes or activity history; 5 per 10 minutes per person (`EXPORT_RATE_LIMIT`); audited `organization.exported`. *Close account:* a dialog that says what happens and needs the password (`confirmCurrentPassword`: Better Auth `verifyPassword`, 5 tries per 15 minutes per person since server calls skip Better Auth's limits); `closeAccount` in one transaction refuses if any of the person's businesses has other members (nothing changes), otherwise deletes sessions, the credential and pending links, renames the user "Closed account" with `closed-<id>@closed.invalid` and sets `users.closed_at`, and for each business sets `organizations.closed_at` and revokes every customer link (migration 0020); audited `auth.account_closed` and `organization.closed`; the daily job skips closed businesses; the browser's cookies are dropped and it lands on `/account-closed`. Records stay for tax retention; deleting them afterwards is an open item in the processing register. |
| — | **Private beta with 5–10 real businesses.** Talk to them before any Phase 2 work. |
| 2.1 | **Team invitations (D17; started before the beta at the founder's request, 2026-10-02):** `invitations` (organizations module, migration 0021): lowercased email, role admin/member, SHA-256 of a 256-bit token, invited by, expiry (`TEAM_LIMITS.invitationSeconds`, 7 days), accepted/revoked; one open invitation per address per business (partial unique index). Owners and admins (`users.manage`) invite (`inviteMember`: email limit checked first; the business row is locked, members + open invitations ≤ `TEAM_LIMITS.maxPeople` = 10; re-inviting an address cancels its old link; email through the outbox with `/invite/<token>`), cancel, change admin ⇄ member, remove; nobody changes the owner or themselves; the owner transfers ownership (`ownership.transfer`: new owner, old owner → admin, one transaction); members and admins can leave. `/invite/[token]` (portal headers, `loggablePath` masks the token, rate-limited per IP) shows who invited whom as what; signed out → sign up or sign in with `?invite=` (only a well-formed token is followed back: `invitationReturnPath`); signed in → "Join …", which needs the account email to equal the invited one (a forwarded email isn't enough), adds the membership, switches the session to it and opens its dashboard; accepting twice is harmless; closed businesses and expired, cancelled or used invitations get one neutral page. Settings → Team lists people and invitations (resend expired ones). Account menu: "Switch business" when someone belongs to several (`listMyBusinesses`, `switchBusiness` re-checks membership). Closing an account now leaves shared businesses and refuses only when the person owns one others still use (transfer first). Audited `team.*`. Member names are read with a join on `users`, because identity already depends on this module. |
| 2.2 | **Reports (D18):** the report math (2.2a), its queries (2.2b), then the Reports page with CSV downloads (2.2c). **As built (2.2a, report math):** a `reports` module whose `domain/` works from plain rows the invoices and payments modules will return: `presetPeriod` / `parseReportPeriod` (this or last month, quarter and year around today in the business's time zone, or `?from=&to=` up to `REPORT_LIMITS.maxDays`, falling back to this month with the reason), `summarizeSales` (per currency: issued count, total, before tax and tax; of which registered invoices; cancelled revenue apart; the VATable / VAT / zero-rated / exempt breakdown summed from each bill's line categories), `summarizePayments` (received and withheld, by method, and withheld by customer with their tax ID), `summarizeUnpaid` (outstanding in `AGING_BUCKETS`: not yet due, 1–30, 31–60, 61–90 and over 90 days past due, the dashboard's overdue test; by customer, most owed first) and `toCsv` (RFC 4180, CRLF, a UTF-8 byte-order mark for Excel, and a leading apostrophe on text a spreadsheet would run as a formula). `daysBetween` joined `@/shared/dates/calendar`. **As built (2.2b, queries):** `reports.read` (owners and admins, §E). The invoices module answers `invoicesIssuedBetween` (issue date in the period, not draft or void, oldest first; each bill's line categories through `salesBreakdown`; its title through `invoiceTitle`), `unpaidInvoices` (`OWING_INVOICE_STATUSES`, now shared with the dashboard) and `invoiceParties`; the payments module answers `paymentsReceivedBetween` (active payments by paid-on date, newest first). `salesReport`, `paymentsReport` and `unpaidReport` in `reports/application` check `reports.read`, ask those modules for rows and sum them in `domain/`. Migration 0022 indexes `invoices (organization_id, issue_date)`. Integration tests cover the period edges, cancelled and void bills, drafts, voided payments, tax withheld by customer, aging, another business's figures and members being refused. **As built (2.2c, page):** `/reports` (owners and admins; `notFound` otherwise, and Reports shows in the sidebar and the phone's More sheet only for them, via `ShellAccount.canReadReports`): period tabs (this or last month, quarter, year) and a From/To form, with `parseReportPeriod`'s message in a `FormAlert`; Sales (count, total, before tax, tax; the VATable / VAT / zero-rated / exempt rows in the market's invoice words for VAT sellers, the percentage-tax row for non-VAT ones; registered and cancelled bills noted), Payments received (received, the market's withheld tax, by method, tax withheld by customer with their TIN) and Unpaid bills (outstanding and the five aging buckets, who owes the most); each per currency, top 10 customers on screen. Each section downloads its CSV from `/reports/csv?report=sales|payments|unpaid` (one row per bill or payment, exact decimals, column names in the market's words, `toCsv`'s formula guard). A matched `loading.tsx`; `/reports` joined the axe and overflow screens; the invoices E2E checks the figures, the unpaid CSV and a bad date range. |

Phase 2+ follows the brief (SaaS billing, invitations, recurring invoices, reports, …) and is **re-prioritized from beta feedback**, not planned in detail now.

---

## N. Technical Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Regulatory: Philippine invoicing rules.** Under the EOPT Act, invoices became the primary sales document. Computer-generated invoices used as *official* invoices generally need BIR registration/accreditation (CAS/e-invoicing). A TAVI "invoice" may not qualify as an official BIR invoice for the business's customers. The EU has similar e-invoicing mandates (EN 16931). | **High** (business, not code) | **Get a PH accountant or tax lawyer's read before marketing in the PH.** Options: position documents as quotations/billing statements alongside the business's official receipts; label them clearly; or pursue accreditation later. Also cover RA 10173 (Data Privacy Act): privacy policy, a DPA with businesses, and a data-processing register. |
| 2 | **Next.js 16 API drift** vs model knowledge | Medium | Read `node_modules/next/dist/docs/` before framework code (existing AGENTS.md convention); the `next-best-practices` skill. |
| 3 | **Money correctness:** rounding, inclusive tax, multi-currency display | High | One pure calc function, property tests, snapshots, per-currency aggregation only. |
| 4 | **Email deliverability and platform abuse** | Medium | Verified-email gate, send caps, SPF/DKIM/DMARC on a dedicated sending subdomain, "via TAVI" sender with business Reply-To, and copy-link as the alternative channel. |
| 5 | **Tenant-isolation regressions** as the code grows | High | Composite foreign keys, `ctx`-required repository signatures, the isolation suite, and a lint rule. Postgres RLS kept as a Phase 2+ defence-in-depth option. |
| 6 | **Better Auth is fast-moving** | Low–Med | It's wrapped behind `modules/identity`; pin versions; upgrade deliberately. |
| 7 | **Serverless ↔ Postgres connections** | Low | Neon pooled connection string or serverless driver; no long transactions. |
| 8 | **PDF fidelity:** font registration, ₱ glyph, long line items, page breaks | Medium | Embed the brand font in react-pdf; golden-file tests on rendered text; page-break test with 60 lines. |
| 9 | **Timezones:** "due today" and "expired" off by one | Medium | `date` columns, org timezone in the context, `Clock` injected into domain logic for tests. |
| 10 | **Scope creep before users** | High | §O, beta gate after Phase 1, the `product` skill's "is this MVP?" check. |
| 11 | **Consistency of AI-generated code across sessions** | Medium | Skills written from real code, lint boundaries, code-review DoD, test gates in pre-commit and CI. |
| 12 | **Brand name availability:** "Tavi" may be registered or taken as a domain or trademark in target markets | Medium | Check IPOPHL, USPTO, EUIPO and domains **before** investing in logo/mascot production. |
| 13 | **Dependence on Neon for local development** (needs internet; free-tier compute limits) | Low | Dev runs against the Neon `dev` branch; Docker Postgres remains a drop-in fallback because the app only sees a connection string. |
| 14 | **Vercel Hobby is for non-commercial use** under Vercel's terms | Medium | Fine for a free beta. Before charging any business: move to Vercel Pro, or a host whose free plan allows commercial use (e.g. Cloudflare Workers via OpenNext). |
| 15 | **Gmail SMTP limits and deliverability** (daily cap; sender is a Gmail address) | Low–Med | Enough for a beta; customer documents mostly travel as copy-link. Switch to Resend with a verified domain before growth. |

---

## O. Things We Should NOT Build (yet)

Everything in the brief's §61 (microservices, Kubernetes, event bus, payment processing, ledger, ERP, payroll, CRM, marketplace, native apps, AI features, workflow designer, SSO, analytics platform), plus these decisions specific to this plan:

- Editing invoices after a payment exists → void & duplicate. No credit notes yet.
- Overpayments, refunds, customer credit balances.
- FX conversion or cross-currency totals.
- Rich-text or markdown notes → plain text only.
- A numbering-format editor → prefix + padding only.
- Org-slug URLs (`/acme/invoices`) → active org lives on the session.
- Postgres RLS, Redis, queues, workers → app-level scoping + outbox + cron.
- Team invitations, SaaS billing, recurring invoices → Phase 2.
- Dark mode, i18n framework, Storybook → tokens are dark-ready, `Intl` handles formatting, `/dev/design` covers the gallery.
- A marketing site beyond one landing page.
- An analytics SDK → milestone timestamps + audit-derived funnel.
- Email-OTP quote approval → later, as an opt-in per org.

---

## P. Mascot & Brand Directions (Appendix §17: choose before implementation)

**Shared constraints:** the mascot must read at 16px as a silhouette; be flat 2–3 colour; use one stroke weight matching the icon set; have no mouth-heavy expressions (eyes and posture carry emotion); never be required for meaning; and stay off the portals except the footer mark and the approved/paid confirmation.

**Wordmark note (applies to all directions):** the **V in TAVI can double as a check mark ✓**. Approved and paid are the product's two defining moments, so the logo, the favicon and the success states can share one glyph. This is the thread that ties the brand system together.

### Direction 1 — "The Stamp" · ✅ chosen (D3)

| | |
|---|---|
| **Concept** | A small rubber-stamp character: a rounded handle for a head with two dot eyes, sitting on a rectangular base. Its stamp face prints the **TAVI ✓**. |
| **Role** | The thing that makes work *official*. It stamps "Approved", "Sent" and "Paid". |
| **Personality** | Dependable, calm, quietly proud of a job done well. A dry sense of humour, never goofy. |
| **Shape language** | A cylinder over a rectangle: stable, grounded, a very strong silhouette. With no limbs, emotion comes from eye shape, head tilt and squash. |
| **Colour** | Ink-coloured body (the text/neutral token) with the **brand accent only in the imprint**. It sits naturally in a restrained UI. |
| **Why it fits** | Its signature motion (a press-down that leaves an imprint, about 400ms) *is* the product's success moment, which makes the mascot's animation functional rather than decorative. It's an office object rather than a creature, so it stays professional in a money context. |
| **UI usage** | An invoice paid shows the stamp pressing "PAID ✓" onto a mini document. An empty quote list shows the stamp waiting beside a blank page. The error state shows the stamp tilted with a small ink smudge, calm rather than alarmed. A sent quote shows it lifting off the page as a toast appears. |
| **Weaknesses** | The skeuomorphic office metaphor could read as dated if it's over-rendered, so it must stay flat and geometric. The range of poses is narrower than a creature's. It could look like an "approve tool" icon if it has no eyes. |

### Direction 2 — "The Fold" (origami messenger)

| | |
|---|---|
| **Concept** | A small bird folded from a single sheet of document paper. The fold lines are visible and the eye is one round dot. |
| **Role** | The courier that carries work from business to customer and brings the answer back. |
| **Personality** | Light, quick, helpful, optimistic. |
| **Shape language** | Triangles and crisp creases, angular and lightweight. |
| **Colour** | A paper-white body with a neutral outline, plus an accent-coloured inner fold. |
| **Why it fits** | It literalizes "Create → Send → Get paid". Folding an invoice into a bird is a lovely send animation. |
| **UI usage** | Send: the document folds and lifts off. Waiting: perched on the quote. Approved: returns carrying a ✓. |
| **Weaknesses** | Paper planes and birds are crowded brand space (messaging apps, social networks). The origami crane is a cliché. It needs a distinctive fold pattern to be ownable, and it's harder to make readable at 16px. |

### Direction 3 — "The Otter" (warm companion)

| | |
|---|---|
| **Concept** | A sea otter, drawn as a flat geometric capsule, holding a small round token to its chest. Sea otters keep a favourite stone, so the idea is "keeps what matters safe". |
| **Role** | A calm companion that looks after your business's money. |
| **Personality** | Warm, patient, competent, the most emotionally expressive of the four. |
| **Shape language** | Soft capsule body, circular face, minimal features. |
| **Colour** | A warm neutral body with an accent-coloured token. |
| **Why it fits** | It gives maximum warmth and memorability and is distinctive in B2B finance. It has a wide range of poses (floating = waiting, holding a document, a small clap = celebrating). |
| **Weaknesses** | **The highest risk of feeling childish or consumer-grade** in a financial tool, and the most illustration effort per pose. Animal mascots invite comparisons with well-known brand animals. It needs strict restraint to stay professional. |

### Direction 4 — "The Mark" (abstract, logo-native)

| | |
|---|---|
| **Concept** | A tiny character whose body is the ✓-V from the wordmark, softened into a leaning bean shape with two eyes. |
| **Role** | The embodiment of "done". |
| **Personality** | Minimal, crisp, confident. |
| **Shape language** | Pure geometry. The mascot is the logo. |
| **Colour** | Accent body on neutral backgrounds; inverts cleanly. |
| **Why it fits** | The tightest brand coherence of the four. It works perfectly as a favicon or app icon and costs the least to produce. |
| **Weaknesses** | **The least personality and pose range**, so it risks becoming a "generic smiling blob". Check-mark logos are a crowded space. It struggles to express waiting or concern. |

### Recommendation

**Direction 1 (The Stamp), with Direction 4's ✓-V as its imprint.** The mascot's one signature action is the product's core success moment. It stays professional without trying hard, and the logo ↔ mascot ↔ status system share one mark.

**Name ideas** to check for trademark conflicts before use:

- **"Mark"**: check-mark, "mark as paid", hallmark.
- **"Seal"**
- **"Tik"**

**Proposed brand convention:** the wordmark is set in capitals, **TAVI**. Running text uses **Tavi** ("Sent with Tavi", "Welcome to Tavi"), because all-caps in sentences reads as an acronym or as shouting. The alternative is TAVI everywhere, which is also workable if applied consistently. See Q.5.

---

## Q. Decisions

**Resolved 2026-09-30:** folder permissions, hosting, database, launch market, mascot direction, skills structure and every pushback. See the decision log (D1–D9) at the top of this document.

**Still open (these don't block Phase 0; defaults apply until you decide):**

1. **Brand casing.** Default: the wordmark is **TAVI**, and running text says **Tavi**.
2. **Member role defaults.** Default: Members **can't** record or void payments (§E). This only matters once team invitations arrive in Phase 2.
3. **Mascot name.** Candidates: Mark, Seal, Tik. Needs a trademark check first.
4. **Brand-name clearance.** Check "Tavi" with IPOPHL, USPTO and EUIPO and check domain availability before investing in logo production (risk N.12).
5. **BIR review.** An accountant's read before any PH marketing (risk N.1).
