---
name: tavi-code-review
description: TAVI's Definition of Done and review checklist — correctness, security, tenancy, money, UX, accessibility, tests, docs — plus commit conventions. Use before declaring any TAVI change or milestone finished, before committing, and when reviewing a diff in tavi-app.
---

# TAVI code review

Don't ask "does it compile?". Ask **"would I ship this to a paying business?"**

## Definition of Done (§63)

A change is done when all of these hold (or are explicitly not applicable):

- [ ] Works end to end in the running app (screenshots at desktop + phone for UI).
- [ ] **Authorization:** every server action / route handler calls `requireOrgContext()` and `assertCan()`.
- [ ] **Tenancy:** every query is scoped to `ctx.organizationId`; foreign IDs → not found; a test proves another org can't see/touch it.
- [ ] **Validation:** Zod on the server; human errors; entered values preserved.
- [ ] **States:** loading, empty, error, success all designed.
- [ ] **Mobile:** no horizontal scroll; targets ≥ 44px; sheets instead of popovers where needed.
- [ ] **Accessibility:** axe clean in E2E; labels, focus, icon + text for status.
- [ ] **Money:** minor units, one calculation function, `MoneyAmount`; no floats.
- [ ] **Audit:** important actions recorded in the same transaction; emails via the outbox.
- [ ] **Security:** threat-model checklist (`tavi-auth-security`) run for sensitive changes; no secrets in code, logs or chat.
- [ ] **Performance:** no N+1; paginated lists; indexes for new filters.
- [ ] **Tests:** written first; unit/integration/E2E as `tavi-testing` requires; all green.
- [ ] **Design system:** tokens only; `DESIGN.md` + `/dev/design` updated for new patterns.
- [ ] **Docs:** decision log / "As built" notes in the proposal, `CLAUDE.md` rules, `.env.example` for new variables.

## Review questions

1. What's the worst thing a malicious user of *another* business could do with this?
2. What happens if this runs twice at the same time? If it fails halfway?
3. Could a number, total or status shown to a customer ever be wrong or stale?
4. Is this the simplest thing that fully works? What can be deleted?
5. Does anything here belong in a different layer (see `tavi-architecture`)?
6. Did the boundary lint, typecheck, and all three test layers actually run?

## Commits

- Run `npm run lint`, `npm run typecheck`, `npm test` (pre-commit hook enforces), plus `npm run test:int` and E2E when relevant.
- One commit per roadmap milestone (or coherent slice), message `Phase X.Y: <what>` with a body of bullet points.
- **No co-author line.** Author is the repo-local personal identity; never the global work identity.
- Never commit `.env.local` or `e2e/.auth/`.
