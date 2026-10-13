# TAVI

Create. Send. Get paid. Quoting and invoicing for small service businesses, Philippines first.

Status: **pre-launch.** The core product is built and tested end to end: customers, products and services, quotes with customer approval by link, billing statements and invoices, payments and receipts, PDFs, reports with CSV downloads for the accountant, teams, a recycle bin, and the Data Privacy Act basics. Before the first real business signs up, work through the [production deploy runbook](docs/runbooks/production-deploy.md) and the [security checks](docs/runbooks/security-checks.md). The architecture, decisions and roadmap live in [`docs/foundation-proposal.md`](docs/foundation-proposal.md).

## What it does

- **Customer, quote, approval, invoice, payment.** A quote goes to the customer by email or link; they approve it by typing their name, and the business sees who approved and when. An approved quote converts to a bill, and payments are recorded against it.
- **Philippine invoicing rules.** Documents follow BIR RR 7-2024: a bill is a billing statement until the business enters its BIR registration, then it is an invoice. See proposal §B.7.
- **Several businesses per account, with roles.** Owners, admins and members, each with a fixed set of capabilities. Teammates join by emailed invitation.
- **Your data stays yours.** Download everything as one file, close your account, and recover deleted drafts from the recycle bin for 30 days.

## Requirements

- Node.js 22 (see `.nvmrc`)
- A Neon Postgres project with `dev` and `test` branches (see `.env.example`)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (comments in the file say how)
npm run db:migrate           # create the tables in DATABASE_URL_DIRECT
npm run dev                  # http://localhost:3200
```

`npm install` also installs the git hooks (husky). Every commit runs lint, typecheck and the unit tests.

Without an email provider configured, development prints emails to the terminal; production refuses to send them. Never commit `.env.local`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server on port 3200 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run vercel-build` | What Vercel runs: apply pending migrations, then build |
| `npm run lint` | ESLint (zero warnings), including module-boundary rules |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:int` | Integration tests on real Postgres (Neon `test` branch, which it wipes) |
| `npm run test:e2e` | End-to-end tests on desktop and mobile with accessibility checks (Playwright; run `npx playwright install chromium` once first) |
| `npm run db:generate` / `db:migrate` / `db:studio` | Create migrations, apply them, browse data |
| `npm run db:restore-check` | Check that a restored database is complete (see the [restore drill](docs/runbooks/restore-drill.md)) |
| `npm run funnel` | Print the product funnel: how far each business has got |
| `npm run brand:build` | Rebuild the icon set and email wordmark from the logo picture |

## Testing

Three layers, all run by CI (GitHub Actions) on every pull request and on `main` and `staging`:

- **Unit and component** (`npm test`): fast, no database. Domain rules are written test-first, including property tests for the money maths.
- **Integration** (`npm run test:int`): every use case against real Postgres, including concurrency and a check that one business can never reach another's records. It wipes the test database and refuses to run against `DATABASE_URL`.
- **End to end** (`npm run test:e2e`): the sign-up to paid-invoice path in a real browser, on desktop and phone sizes, with accessibility (WCAG 2.2 AA) checks on every key screen.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui on Base UI · Zod · Better Auth (email and password) · PostgreSQL on Neon with Drizzle ORM · Nodemailer over Gmail SMTP, or Resend once there is a domain · Vitest · Playwright. Hosted on Vercel in Singapore (`vercel.json`), with two Vercel crons for daily status changes and the email outbox.

## How the code is laid out

- `src/app` holds the pages and route handlers. `src/proxy.ts` (Next 16's replacement for middleware) sets the security headers and sends signed-out visitors to sign in.
- `src/modules/<name>` holds one feature each (customers, quotes, invoices, payments, identity, organizations and so on), split into `domain` (pure rules), `application` (use cases), `infra` (database and services) and `schema.ts`. Modules import each other only through `@/modules/<name>`; ESLint enforces it.
- `src/shared` holds code every module uses (money, dates, logging, security headers, validation). `src/db` holds the database client and migrations. `src/config` holds the market profile, brand and legal details.
- `e2e` holds the Playwright tests, `scripts` the build and deploy helpers, and `docs` the proposal, runbooks and compliance notes.

## Security

Every signed-in request gets its business from the server-side session, never from anything the browser sends, and every action checks the person's role in code. Customer links use 256-bit random tokens stored only as hashes. Scripts run only with a per-request nonce, passwords need 12 characters and are checked against known breaches in production, and sign-in, sign-up, resets and customer links are rate limited. The full model is in proposal §I, and the routine for re-checking it (dependency audit, SonarLint in your editor, OWASP ZAP) is in [`docs/runbooks/security-checks.md`](docs/runbooks/security-checks.md).

Found a vulnerability? Please report it privately to the owner, not in a public issue.

## Documentation

| Where | What |
|---|---|
| [`docs/foundation-proposal.md`](docs/foundation-proposal.md) | Architecture, domain rules, decisions (D1 and up), roadmap |
| [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md) | What Tavi is for, and the "Carbon Copy" design system |
| [`docs/runbooks`](docs/runbooks) | First production deploy, restore drill, security checks |
| [`docs/compliance`](docs/compliance) | The processing register for the Data Privacy Act, and the e-invoicing notes |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for AI coding assistants in this repository |

## License

Proprietary. Copyright (c) 2026 Renzo Feliciano Payod. All rights reserved. See [LICENSE](./LICENSE). Third-party packages keep their own licences.
