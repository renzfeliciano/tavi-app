# Record of processing activities (Data Privacy Act)

Prepared 2 Oct 2026 (proposal §M 1.13b, risk N.1) as the register of what personal information Tavi processes, why, where it goes and how long it stays. **Not legal advice:** to be reviewed by a lawyer before the private beta. Keep it in step with the Privacy Notice (`src/app/(legal)/privacy/page.tsx`) and the Terms of Service (`src/app/(legal)/terms/page.tsx`); bump `LEGAL.version` in `src/config/legal.ts` when either document changes materially.

## Roles

| Information | Tavi's role | The controller |
|---|---|---|
| People who use Tavi: accounts, sign-ins, business profiles, activity history | Personal information controller (PIC) | The operator in `LEGAL.operator` (still placeholders) |
| A business's customers and their documents | Personal information processor (PIP) | The business, under the data processing terms in the Terms of Service (RA 10173 Sec. 14; IRR Sec. 43–44) |

## Activities

| # | Activity | Purpose | Data subjects | Personal information | Basis | Where it's stored | Retention |
|---|---|---|---|---|---|---|---|
| P1 | Accounts and sign-in | Provide the service; security | Users | Name, email, password hash (scrypt), email confirmed, terms version and time agreed | Contract (Sec. 12(b)) | `users`, `accounts`, `verifications` | While the account is open |
| P2 | Sessions and devices | Keep people signed in; let them see and sign out devices | Users | Session ID, IP address, user agent, times | Contract; legitimate interest in security (Sec. 12(f)) | `sessions` | Until sign-out, 7 days idle or 30 days after sign-in (`SESSION_POLICY`) |
| P3 | Business profile | Print the seller's details on documents | Users (sole proprietors: the business is the person) | Registered name, TIN, address, contact details, logo, payment instructions, tax registration details | Contract; legal obligation, as tax rules require them on documents (Sec. 12(c)) | `organizations`, `files`, `invoice_registrations` | While the account is open, then as tax rules require for issued documents |
| P4 | Customers and documents (as processor) | Quotes, bills, payments, PDFs and links, for the business | The business's customers | Name, company, email, phone, address, TIN; what was sold and paid; for a qualified buyer's discount (D19), the number and name on their senior citizen, PWD, solo parent, athlete or Medal of Valor ID (sensitive: it reveals age or disability; required on the invoice by RR 7-2024 Sec. 6 B.18) | The business's own basis; our instructions are the Terms | `customers`, `quotes`, `invoices`, `payments` and their line tables | As the business directs; issued documents as tax rules require |
| P5 | Customer decisions on links | Evidence of a quote's approval or decline; "opened" status | The business's customers | Name typed, decision reason, IP address, user agent, time | The business's basis (evidence of agreement) | `quotes`, `audit_events` | With the quote |
| P6 | Activity history | Accountability, security and support; the product funnel | Users; customers (as actors) | Who did what and when; IP and user agent for sign-ins and customer decisions | Legitimate interest (Sec. 12(f)) | `audit_events` (append-only) | For as long as the records it describes exist |
| P7 | Email delivery | Send account emails and the documents a business sends | Users; customers | Address, subject, body | Contract | `outbox_messages`; Google (Gmail SMTP) | Body deleted once delivered; address and subject kept as a delivery record |
| P8 | Rate limiting | Stop abuse of sign-in and customer links | Anyone | A key derived from the IP address, counts | Legitimate interest (Sec. 12(f)) | `request_limits`, `rate_limits` | Pruned after a day |
| P11 | Team invitations (D17) | Invite people to a business by email | People invited by a business | Email address, role, who invited them, when it was accepted | Contract with the inviting business; the invitee's own contract once they accept | `invitations`; Google (Gmail SMTP) | Kept with the business; an unused invitation stops working after 7 days |
| P10 | Data download and account closure | Data portability and erasure on request (Sec. 16(e), 18) | Users; the business's customers (in the file) | Everything listed above for the business | Legal obligation | A JSON file streamed to the person; `users.closed_at`, `organizations.closed_at` | Not stored: the file is made on request; closure is permanent |
| P9 | Breached-password check | Refuse passwords known from breaches | Users | First 5 characters of the password's SHA-1 hash (not identifiable) | Legitimate interest | Have I Been Pwned (k-anonymity range API) | Not stored |

**Sensitive personal information.** An individual's TIN may count as sensitive personal information (RA 10173 Sec. 3(l)(3), "issued by government agencies peculiar to an individual"). It's processed because tax regulations require it on documents (Sec. 13(b)). To confirm with the lawyer.

## Service providers (sub-processors)

| Provider | What it does | Where | Transfer |
|---|---|---|---|
| Vercel, Inc. | Hosting; functions pinned to `sin1` (`vercel.json`) | Singapore (company in the US) | Cross-border |
| Neon | Postgres database | AWS `ap-southeast-1`, Singapore | Cross-border |
| Google (Gmail SMTP) | Email delivery (D11) | Google's infrastructure | Cross-border |
| Have I Been Pwned | Breached-password range check | Cloudflare edge | Hash prefix only |
| Resend | Email delivery, **not active yet** (wired for when a domain exists) | US | Add to the Privacy Notice before turning it on |

No analytics, advertising or error-tracking SDK is in use (Sentry is deferred, §M 0.5): add it here and to the Privacy Notice before turning it on.

## Security measures (RA 10173 Sec. 20)

HTTPS with HSTS; nonce-based CSP; passwords hashed by Better Auth; breached-password check; session limits and instant revocation; every query scoped to the business, composite foreign keys between a business's rows; customer-link tokens stored only as SHA-256; rate limits on every token route; append-only activity history (database trigger); logs redact secrets and drop query strings and link tokens; database point-in-time restore (restore drill: `docs/runbooks/restore-drill.md`).

## Breach response

Within 72 hours of knowledge or reasonable belief of a breach that puts people at real risk, notify the National Privacy Commission and the affected people (NPC Circular 16-03); as a processor, tell each affected business without undue delay so it can do the same. Use `docs/runbooks/` and the activity history to reconstruct what happened.

## Open items before the beta

1. Fill in `LEGAL.operator` (name, registered address, privacy email, data protection officer). The legal pages say "Draft" until then.
2. Lawyer review of the Privacy Notice, Terms of Service and this register.
3. Ask whether Tavi must register with the NPC (NPC Circular 2022-04 sets who must register; the answer depends on the number of people and whether sensitive personal information is processed).
4. Delete a closed business's records once its tax retention period ends. Closing an account (D16) anonymises the person straight away and closes the business, but its records stay until then; there's no deletion job yet, and the lawyer should confirm the period.
5. An owner whose business others still use must transfer ownership (Settings → Team) before closing their account; members leave the shared business when they close theirs (D17).

Done in 1.13c (D16): "Download your data" (Settings → Account and data, one JSON file, owners and admins), "Close account" (password, then the steps above) and agreeing again after `LEGAL.version` changes (`/accept-terms`).
