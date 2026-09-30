---
name: tavi-motion-design
description: TAVI's motion rules — duration and easing tokens, what may and may not animate, reduced-motion handling and mascot animation. Use when adding any transition, animation, toast, sheet or mascot moment in tavi-app.
---

# TAVI motion

Motion communicates state; it never decorates. Proposal §H; tokens in `src/app/globals.css`.

## Tokens

| Token | Value | For |
|---|---|---|
| `--duration-fast` | 120ms | press, hover, focus, checkbox |
| `--duration-normal` | 200ms | menus, popovers, tooltips, toasts, badge change |
| `--duration-slow` | 320ms | dialogs, sheets |
| `ease-out` (theme) | `cubic-bezier(0.23,1,0.32,1)` | anything entering |
| `--ease-in-out` | `cubic-bezier(0.65,0,0.35,1)` | moving on screen |
| `--ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | bottom sheets |

Exits run at ~75% of entry duration. Tailwind: `duration-(--duration-fast) ease-out`.

## Rules

- Transition specific properties (`transition-[transform,background-color]`), never `transition-all`.
- Buttons press to `scale(0.97)` (already in `Button`).
- Nothing appears from `scale(0)`; start at 0.95 + opacity.
- CSS transitions via Base UI `data-*` states first; a JS motion library only for layout animation, lazily loaded.
- **Money never animates** — no count-ups, no tweened totals.
- No page-load choreography or staggered entrances on app screens.
- Status change: crossfade the badge. Success moments: toast (≤ 200ms in) plus, where brand rules allow, one mascot beat (≤ 800ms) that never blocks the next action.

## Reduced motion

A global rule in `globals.css` collapses animations/transitions under `prefers-reduced-motion`. Mascot and imprint animations use `motion-safe:` so reduced-motion users get the static pose. Meaning is always carried by text too. E2E screenshots emulate `reducedMotion: "reduce"` for stable captures.

## Mascot animation

`BrandMascot animated` plays the press (480ms) then the imprint (320ms, 260ms delay) **once**, only for real moments: quote sent, quote approved, invoice paid, onboarding complete. Never loops, never idles, never on routine saves.
