---
name: tavi-design-system
description: How to use and extend TAVI's "Carbon Copy" design system — semantic tokens, primitives (shadcn on Base UI), domain display components, and when to update DESIGN.md and /dev/design. Use whenever you style anything, add a component, or pull in a shadcn primitive in tavi-app.
---

# TAVI design system

`DESIGN.md` is the rulebook (tokens, named rules, do's and don'ts). `/dev/design` (development only) shows everything rendered. Vendored design skills rank below `DESIGN.md` (see `.claude/skills/THIRD_PARTY_SKILLS.md`).

## Tokens only

Use semantic classes: `bg-background` (bond paper), `bg-card` (the sheet), `bg-surface-sunken`, `bg-sidebar`, `text-foreground`, `text-ink-subtle`, `text-muted-foreground`, `border-border`, `border-border-strong`, `border-input`, `text-stamp` / `bg-primary` (the one accent), `bg-stamp-subtle`, and state families `success|warning|danger|info` with `-strong` (text) and `-subtle` (wash). Shadows `shadow-xs…lg`. Radii `rounded-md` (controls), `rounded-xl` (panels), `rounded-full` (badges).

Never raw colours, hex, `bg-violet-*`, gradients, glows or coloured side stripes.

**The Real Ink Rule:** violet only for serials, the Stamp, the one primary action per view, the current location and focus.

## Components to reach for

| Need | Use |
|---|---|
| Amount | `MoneyAmount` |
| Document number | `DocumentNumber` |
| Status | `StatusBadge` (icon + label) |
| Empty list | `SectionEmpty` / `EmptyState` |
| Page title + actions | `PageHeader` |
| Form field | `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `Textarea`, `NativeSelect`, `PasswordInput` |
| Form-level error | `FormAlert` |
| Button / link that looks like one | `Button` (with `pending`) / `Link` + `buttonVariants()` |
| Menus, sheets, dialogs | `DropdownMenu`, `Sheet` (bottom on phones), `Dialog` |
| Brand | `Wordmark`, `BrandMascot`, `StampImprint` |

## Base UI specifics

- Compose with `render={<X />}` (not Radix's `asChild`), e.g. `DropdownMenuTrigger render={<Button />}`.
- Never render a link through `Button` — use `buttonVariants()` on `Link` (Base UI docs).
- Check APIs with `npx shadcn@latest docs <component>` or `node_modules/@base-ui/react/docs/`, not memory.

## Adding a shadcn primitive

1. `npx shadcn@latest add <name> --yes`.
2. Tune to the system: heights `h-9` + `pointer-coarse:h-11` for controls, `rounded-md`, `bg-card` fields with `shadow-xs`, specific `transition-[…]` with `duration-(--duration-fast) ease-out`, focus ring `ring-ring/35`.
3. Remove dark-mode-only assumptions (light-only MVP).
4. Add it to `/dev/design` and, if it adds a pattern, to `DESIGN.md` → Components.

## Changing the system

A new token, component pattern or rule updates `DESIGN.md` **and** `.impeccable/design.json` in the same change, plus `/dev/design`. Unavailable things get a full-contrast "Coming soon" badge — never opacity (it failed WCAG contrast once).
