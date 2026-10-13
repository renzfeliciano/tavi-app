# Security checks

How to re-check Tavi's security, and what the October 2026 review found. Run the whole routine before opening sign-up to the public, and the first two steps before every release. Run scanners only against your own code and your own staging site, never against anyone else's.

## Before every release

1. `npm audit --omit=dev` (CI's `audit` job already fails on a critical advisory; read the high ones yourself). Anything in `next`, `better-auth`, `pg`, `sharp`, `nodemailer` or `@react-pdf/renderer` is fixed before release. `next` is pinned to an exact version, so upgrade it on purpose (`npm install next@<version> eslint-config-next@<version> --save-exact`) and rerun the full test suites.
2. If the release touches sign-in, sessions, permissions, customer links, uploads, headers or logging, walk the threat-model checklist in `.claude/skills/tavi-auth-security/SKILL.md`.

## Accepted advisories

Build-time tools only; none runs while the app answers requests.

| Date accepted | Package | Why it stays |
|---|---|---|
| 2026-09-30 | `esbuild` (moderate) under `drizzle-kit` | Affects esbuild's dev server, which Tavi never runs |
| 2026-10-14 | `shadcn`, `ts-morph`, `fast-glob`, `micromatch`, `braces` (high) | Pattern-matching slowness (ReDoS) in a code generator, fed only local files. `shadcn/tailwind.css` is imported at build time. `braces` had no patched release on this date |
| 2026-10-14 | `eslint-config-next`, `@next/eslint-plugin-next` (high) | Linting only, on the developer's machine and in CI |

Look again when `shadcn`, `drizzle-kit` or `eslint-config-next` next update.

## Code smells and bugs: SonarLint in your editor

Tavi does not use a SonarQube server. SonarLint, SonarSource's editor extension (listed as "SonarQube for IDE" since its 2025 rename; VS Code id `SonarSource.sonarlint-vscode`), checks the file you have open and needs no server, token or account. Install it and leave it in standalone mode (do not connect it to a server).

It applies the same JavaScript and TypeScript rules the October 2026 review ran through ESLint (SonarJS), so what it shows is what that review saw: notices about object keys on typed lookups (not reachable with attacker-chosen keys) and about nested conditionals and complexity (style). Fix what it flags in code you are already changing; do not rewrite files for it. A security notice on code that handles input from a browser or a customer link gets a real look. Nothing in the build, the commit hook or CI depends on it.

## Web scan: OWASP ZAP baseline

Against staging only. It crawls and watches responses, with no attack payloads.

```bash
docker run --rm -v "$(pwd):/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://<your-staging-url> -r zap-baseline.html
```

On Windows PowerShell write `${PWD}` for `$(pwd)`. Expect a warning for `style-src 'unsafe-inline'` (the UI libraries set inline styles; scripts are nonce-only).

Last run: 14 October 2026, on a local production build (spider, passive and active scans, ZAP 2.16.1). It reported no high findings. It raised two medium notices: the `style-src 'unsafe-inline'` warning, and that the plain "not found" page at `/api` has no CSP header (the proxy skips `/api` paths, that page shows nothing a visitor typed, and no API route is affected). It found one real problem, the account forms having no `method` (fixed, see the table above). The rest were informational: addresses with a token in them (customer links work that way by design), redirects with no body, and comments in the framework's own scripts.

## Dependency database: OWASP Dependency-Check

```bash
docker run --rm -v "$(pwd):/src" owasp/dependency-check --scan /src \
  --exclude "**/.next/**" --format HTML --out /src/dependency-check-report
```

The first run downloads the vulnerability database and is slow. It overlaps with `npm audit`; use it as a second opinion.

## What the tests already guard

| Rule | Test |
|---|---|
| Every page folder of the signed-in app is in `PROTECTED_PREFIXES`, so a signed-out visitor is redirected, not shown a page shell | `src/shared/security/headers.test.ts` |
| `/dev` pages answer 404 in production before any page runs | `src/proxy.test.ts` |
| A person cannot rewrite the record of the terms they agreed to | `src/modules/identity/infra/auth.int.test.ts` |
| Inviting a teammate, and sending a quote or bill, need a confirmed email | `src/modules/organizations/application/team.int.test.ts` and the sending tests |
| The account forms are POST forms, so a password typed before the page's script has loaded never lands in the web address | `src/app/(auth)/form-method.test.tsx` |
| Log redaction and user-agent parsing stay linear-time on long input | `src/shared/logger/logger.test.ts`, `src/modules/identity/domain/device.test.ts` |
| Email is capped per business (50 an hour), per person across businesses (80) and for Tavi as a whole (150), and each refusal says which | `src/modules/notifications/application/document-email-limit.int.test.ts`, with entry-point tests in the quotes and team suites |
| One business can never read or change another's records or files | the tenant-isolation suites in each module's `*.int.test.ts` |

## Known gaps (October 2026 review, not yet decided)

- **The shared sending quota can still be used up on purpose.** Email is capped per business (50 an hour), per person (80) and overall (150), but 150 an hour is more than a free Gmail account's daily limit (about 500), so a few confirmed accounts could use a day's quota in a few hours and stop other people sending. Sharing a link always works, and the message says Tavi is busy. Fine for a closed beta of people you know; before public sign-up, send from a domain with its own provider (proposal D11) or add a daily cap.
- **Sign-up says when an email already has an account.** Deliberate and rate limited; sign-in and password reset do not give this away.
- **No lockout per account.** Sign-in, sign-up and reset are limited per origin address (10 a minute for sign-in and sign-up, 5 in 15 minutes for reset and resend). Add a per-account throttle together with two-step sign-in.
- **The origin address comes from `X-Forwarded-For`.** Safe on Vercel, which overwrites it. On any other host, make the proxy overwrite it, or the limits and the customer-decision log can be spoofed.
- **`style-src 'unsafe-inline'`.** Move to style nonces when the UI libraries allow it.
- **Uploaded PDFs are stored as received.** They download as files and are never rendered in a page. Add a malware scan if strangers upload at scale.
- **No independent penetration test yet.** Commission one before taking real customer data at scale.

## If something goes wrong

Within 72 hours of knowing about a breach that puts people at real risk, notify the National Privacy Commission and the people affected; tell each affected business without delay (details in `docs/compliance/processing-register.md`). Logs are JSON lines searchable by request ID; the append-only activity history (`audit_events`) shows who did what and when.
