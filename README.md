# TAVI

Create. Send. Get paid. Quoting and invoicing for small service businesses.

> Status: **Phase 0 (foundation)**. See [`docs/foundation-proposal.md`](docs/foundation-proposal.md) for the architecture, decisions and roadmap.

## Requirements

- Node.js 22 (see `.nvmrc`)
- A Neon Postgres `dev` branch (from Phase 0.2)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3200
```

`npm install` also installs the git hooks (husky). Every commit runs lint, typecheck and the unit tests.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server on port 3200 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint (zero warnings), including module-boundary rules |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests on desktop and mobile with accessibility checks (Playwright; run `npx playwright install chromium` once first) |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui on Base UI · Zod · Vitest · Playwright. Planned: PostgreSQL 18 on Neon with Drizzle ORM, Better Auth, and deployment on Vercel.
