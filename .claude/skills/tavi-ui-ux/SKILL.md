---
name: tavi-ui-ux
description: TAVI's screen contract, form rules, copy and error style, empty/loading/error states, confirmations and the mobile QA matrix. Use before designing or building any screen, form, dialog or flow in tavi-app, and when reviewing UX.
---

# TAVI UI/UX

Proposal §G holds the product UX; `DESIGN.md` the visual system; `tavi-design-system` the components. Mode: **Operate** — the tool disappears into the task.

## Before building a screen, answer (§56)

1. Who uses it, in what situation (often a phone between jobs)?
2. What's the **one** primary action? Secondary actions?
3. What happens on success (toast copy, where do they land)?
4. What happens on failure (validation, server error, offline)?
5. Empty state: what is this, why it matters, what to do next?
6. Loading: which skeleton matches the final layout?
7. Mobile: what stacks, what becomes a sheet, where's the sticky action?
8. Permissions: which capability, and what does a Member see?
9. Is it needed for the MVP?

## Forms

- `Field` + `FieldLabel` (+ `FieldDescription` hint, `FieldError` with `aria-describedby`), placeholders as examples: `e.g. Dela Cruz Aircon Services`.
- Required fields are marked; optional ones say "(optional)" only when mixed.
- Server validation is the truth (Zod in the use case); return `fieldErrors` and **the entered values** (`useActionState`), never clear the form on error.
- Form-level errors: `FormAlert` (focuses itself). Buttons: `pending` + `pendingLabel` ("Sending…"), never a spinner alone; disabled while pending.
- Native `NativeSelect` for short choices; `PasswordInput` for passwords; correct `autoComplete` and `inputMode`.

## Copy

- Plain, calm, specific. Say what happened and what to do: "We couldn't send the quote. Your quote was not lost. Try again."
- Validation: "Enter a valid customer email." Never codes, stack traces or "Error 500".
- Name controls by their action ("Send quote", "Record payment"), not "Submit"/"OK".
- Money/status vocabulary comes from `presentation.ts` and `formatMoney` — never ad-hoc strings.
- Use "Tavi" in sentences, "TAVI" only in the wordmark.

## States

- Empty: `SectionEmpty`/`EmptyState` (Stamp + title + why + one action).
- Loading: `loading.tsx` skeletons matching the layout; no spinners in content.
- Errors: `error.tsx` with human copy and a retry; not-found for foreign or missing IDs.
- Success: toasts from §32 ("Quote sent", "Payment recorded", "Link copied").

## Feedback standard (founder rule)

Every action gets visible feedback; nothing happens silently.

| Situation | Feedback |
|---|---|
| Action succeeded | `toast.success("<what happened>.")`, naming the thing: "Juan Dela Cruz archived." |
| Action failed | `toast.error` with what to do next; the entered values stay |
| Reversible action (archive, remove) | Toast with an **Undo** action, no dialog |
| Destructive, hard to undo, or affects several things | **Dialog** first (below), then a toast |
| Field problem | Inline under the field (`FieldError`), plus the screen-reader summary |
| Form-level problem | `FormAlert` (takes focus) |
| Background autosave | Inline status ("Saving… / Saved"); a toast only on failure (one, with a stable `id`) |
| Navigates to a page showing the result | The page itself is the feedback |

Review every new button and server action against this table before calling a screen done.

## Confirmations (§33)

Only for destructive, financial, or many-at-once actions: void invoice, void payment, delete draft, cancel quote, record payment (summary step), sign out all other devices. Never for save/send (send is reversible via revise).

## Mobile

No horizontal scroll anywhere (E2E asserts it). Tables become stacked rows. Menus become bottom sheets. Primary action reachable with a thumb (sticky bar on long forms). Targets ≥ 44px on touch. Test at Pixel 7 in Playwright.

## Verify before calling it done

1. `npm run test:e2e` (adds the screen to the axe + overflow list in `e2e/app-shell.spec.ts`).
2. Screenshot desktop (1280) and phone (Pixel 7) with a throwaway spec; look at them.
3. Fix everything in one batch; confirm with one more round; stop.
