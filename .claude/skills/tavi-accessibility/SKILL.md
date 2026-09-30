---
name: tavi-accessibility
description: TAVI's WCAG 2.2 AA checklist and the patterns already built for it — labels, errors, focus, landmarks, status semantics, contrast, touch targets, reduced motion — plus how accessibility is tested. Use for every UI change in tavi-app, not as a final cleanup.
---

# TAVI accessibility

Target WCAG 2.2 AA. Every app screen is checked by axe in E2E at desktop and phone widths.

## Checklist for any UI change

- **Labels:** every input has a visible `FieldLabel` bound by `htmlFor`/`id`. Placeholders are examples, never labels.
- **Errors:** `aria-invalid` on the field, `FieldError` linked by `aria-describedby`; form-level errors use `FormAlert` (`role="alert"`, focuses itself). Don't rely on colour.
- **Status:** always icon + text (`StatusBadge`); icons are `aria-hidden="true"`.
- **Buttons:** icon-only buttons get an `sr-only` label (see `AccountBlock` sign-out). Pending buttons set `aria-busy` and keep a text label.
- **Navigation:** landmarks (`main#main`, `nav aria-label="Main"`), `aria-current="page"` on the current item, the skip link in the app layout.
- **Headings:** one `h1` per page (`PageHeader` / `AuthHeading`), then in order.
- **Contrast:** text ≥ 4.5:1, large ≥ 3:1. Never dim content with `opacity` — it failed axe on Settings; use a full-contrast "Coming soon" badge instead.
- **Focus:** visible ring on everything interactive (`ring-ring/35`); dialogs/sheets trap and restore focus (Base UI does this — don't fight it).
- **Touch:** ≥ 44px targets on coarse pointers (`pointer-coarse:` sizes are built into controls).
- **Motion:** respect `prefers-reduced-motion` (global rule + `motion-safe:`).
- **Language & data:** `lang="en-PH"` on `<html>`; money in `<data value>`; dates formatted for people.
- **Mascot:** decorative unless labelled; never the only way to understand something.

## Testing

- Add every new screen to the axe loop in `e2e/app-shell.spec.ts` (signed-in) or `e2e/auth.spec.ts` (signed-out).
- Keyboard paths get an E2E test when they're critical (see "skip straight to the content").
- Next.js renders a hidden `role="alert"` route announcer: scope alert assertions by text (`getByRole("alert").filter({ hasText })`).
- axe can't judge everything: tab through new flows once, and check focus order and visible focus.
