---
name: TAVI
description: Carbon Copy — bond paper, blue-black ink, hairline rules and one stamp-pad violet accent.
colors:
  bond-paper: "oklch(0.985 0.003 255)"
  sheet: "oklch(1 0 0)"
  surface-sunken: "oklch(0.965 0.005 262)"
  sidebar-paper: "oklch(0.97 0.005 262)"
  blue-black-ink: "oklch(0.24 0.025 268)"
  ink-subtle: "oklch(0.42 0.02 266)"
  ink-muted: "oklch(0.5 0.02 265)"
  hairline: "oklch(0.9 0.008 260)"
  rule-strong: "oklch(0.8 0.012 262)"
  field-outline: "oklch(0.84 0.012 262)"
  stamp-violet: "oklch(0.45 0.15 285)"
  stamp-violet-pressed: "oklch(0.39 0.15 285)"
  stamp-wash: "oklch(0.955 0.025 285)"
  carbon-blue: "oklch(0.5 0.11 250)"
  approval-green: "oklch(0.52 0.12 155)"
  caution-amber: "oklch(0.7 0.14 70)"
  overdue-red: "oklch(0.53 0.19 27)"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  serial:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
  full: "9999px"
spacing:
  unit: "4px"
  field-gap: "20px"
  section-gap: "40px"
  page-gutter-mobile: "16px"
  page-gutter-desktop: "40px"
components:
  button-primary:
    backgroundColor: "{colors.stamp-violet}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-violet-pressed}"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.md}"
    height: "36px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  status-badge:
    rounded: "{rounded.full}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  document-serial:
    textColor: "{colors.stamp-violet}"
    typography: "{typography.serial}"
---

# Design System: TAVI

## Overview

**Creative North Star: "Carbon Copy"**

TAVI is built from the official-receipt booklet every Filipino business has used: pre-printed serial numbers, ruled form fields, carbon copies and a violet-inked rubber stamp. The interface is the clean, modern descendant of that booklet. The app canvas is bond paper, documents and fields are white sheets on it, text is blue-black ink, and structure comes from hairline rules rather than boxes and shadows.

There is exactly **one accent**, stamp-pad violet, and it appears only where real ink would go: document serial numbers, the Stamp mascot and its imprints, the primary action on a screen, the current navigation item and keyboard focus. Everything else is paper and ink. This scarcity is what keeps the violet reading as "official" rather than as the generic AI-SaaS indigo it would become if spread around.

The product is an Operate surface: calm, dense enough for real work, and familiar in its patterns (sidebar, tab bar, sheets, menus). Personality lives in precise details (the check-mark V in the wordmark, serials set like pre-printed numbers, the Stamp's press) and never in decoration.

**Key characteristics:**
- Bond paper, white sheets, blue-black ink, hairline rules.
- One accent (stamp-pad violet), used like ink, never as a fill field.
- Status always carries an icon and a label; colour is never the only signal.
- Money is tabular, never wraps and never animates.
- Light only for the MVP. Public portals and PDFs are always light.

## Colors

A cool, near-neutral paper-and-ink palette with a single inked accent and four semantic state colours.

### Primary
- **Stamp-pad Violet** (`oklch(0.45 0.15 285)`, token `--primary` / `--stamp`): primary buttons, document serials (`Nº QUO-000124`), the Stamp and its imprints, the current nav item's icon and label on phones, focus rings, the text caret and native control accents. Hover and pressed states use **Pressed Violet** (`oklch(0.39 0.15 285)`).
- **Stamp Wash** (`oklch(0.955 0.025 285)`): text selection and the "current step" chip in checklists. Never a panel background.

### State colours (semantic, not brand)
- **Carbon Blue** (`oklch(0.5 0.11 250)`, token `--info`): sent and viewed.
- **Approval Green** (`oklch(0.52 0.12 155)`, `--success`): approved and paid.
- **Caution Amber** (`oklch(0.7 0.14 70)`, `--warning`): partially paid. Its text uses `--warning-strong` for contrast.
- **Overdue Red** (`oklch(0.53 0.19 27)`, `--danger` / `--destructive`): overdue, declined, destructive actions, field errors.

Each has `-strong` (text on light grounds) and `-subtle` (badge ground) partners in `src/app/globals.css`.

### Neutral
- **Bond Paper** (`oklch(0.985 0.003 255)`, `--background`): the app canvas.
- **Sheet** (`oklch(1 0 0)`, `--card` / `--popover`): documents, panels, form fields, menus.
- **Sidebar Paper** (`oklch(0.97 0.005 262)`, `--sidebar`): navigation chrome, a second neutral layer.
- **Sunken** (`oklch(0.965 0.005 262)`, `--surface-sunken`): recessed regions.
- **Blue-black Ink** (`oklch(0.24 0.025 268)`, `--foreground`): all primary text.
- **Subtle Ink** (`oklch(0.42 0.02 266)`, `--ink-subtle`): secondary text, inactive nav.
- **Muted Ink** (`oklch(0.5 0.02 265)`, `--muted-foreground`): captions, descriptions, placeholders.
- **Hairline** (`oklch(0.9 0.008 260)`, `--border`): rules and dividers. **Strong Rule** (`oklch(0.8 0.012 262)`, `--border-strong`) for outline buttons and emphasis. **Field Outline** (`oklch(0.84 0.012 262)`, `--input`).

### Named Rules
**The Real Ink Rule.** Violet appears only where a real stamp or pen would leave ink: serials, the Stamp, the one primary action, the current location, focus. Never as a card, header or section background, never as a gradient, never as a glow.

**The Two Signals Rule.** Every status is an icon plus a word. Colour only reinforces it.

## Typography

**UI font:** Geist (fallback `ui-sans-serif, system-ui`), loaded with `latin` **and `latin-ext`**, because ₱ lives in latin-ext.
**Serial font:** Geist Mono, for document numbers and other printed identifiers only.

**Character:** one neutral workhorse sans carries every role. Hierarchy comes from size and weight steps, not from a display face. The mono is a measurement face (serial numbers), never a "technical" costume.

### Hierarchy
- **Page title** (600, 1.5rem/24px, tracking -0.025em): one per screen, from `PageHeader`.
- **Section title** (600, 1rem–1.125rem): card and section headings.
- **Body** (400, 0.875rem/14px): app text. Public portals and PDFs step up to 15–16px.
- **Label** (500, 0.75rem/12px): badges, captions, tab labels (11px on the phone tab bar).
- **Serial** (Geist Mono 400, 0.875rem, tabular): `Nº QUO-000124`, in stamp violet.

### Named Rules
**The Tabular Money Rule.** Amounts always use tabular figures (`MoneyAmount`, and `tabular-nums` on any table), never wrap, and are right-aligned in columns. A candidate font must render ₱ and support `tnum`; Geist and Geist Mono both passed that check on 2026-09-30.

## Layout

- **App shell:** a fixed 240px sidebar at `lg` (1024px) and up. Below that, a sticky 56px top bar with the wordmark and a fixed bottom tab bar (Home · Quotes · **New** · Invoices · More) that respects `safe-area-inset-bottom`.
- **Content column:** max width 72rem (`max-w-6xl`), with gutters of 16px on phones, 24px from `sm` and 40px from `lg`. Bottom padding clears the tab bar on phones.
- **Rhythm:** a 4px base. Fields are 20px apart, groups 12–16px, sections 32–40px. There is more space above a heading than below it.
- **Responsive rule:** layout changes structurally (sidebar → tab bar, rows → stacked rows, menus → bottom sheets), never through fluid type. Nothing scrolls sideways; E2E tests assert this on every app screen at desktop and Pixel 7 widths.
- **Touch:** on coarse pointers, buttons and fields grow to 44px (48px for large); tab-bar targets are at least 56px tall.

## Elevation & Depth

Depth is mostly tonal: paper, then sheet, then popover, separated by hairlines. Shadows are small, offset and tinted with the ink colour. There are no coloured glows.

### Shadow Vocabulary
- **xs** (`0 1px 1px oklch(0.24 0.025 268 / 0.05)`): resting sheets, fields, outline and primary buttons.
- **sm** (`0 1px 2px … / 0.06, 0 1px 1px … / 0.04`): the Stamp's "New" disc on the tab bar.
- **md** (`0 4px 12px -2px … / 0.1, 0 2px 4px -2px … / 0.06`): menus, popovers, toasts.
- **lg** (`0 18px 40px -12px … / 0.2, 0 4px 10px -4px … / 0.08`): dialogs and sheets.

### Named Rules
**The Paper Stack Rule.** Surfaces stack like paper: flat at rest, lifted only when they float above the page (menus, sheets, dialogs, toasts).

## Shapes

- The radius base is `--radius: 0.5rem`. Buttons and fields use `md` (≈6px), cards and panels `xl` (≈11px), bottom sheets use `xl` on their top corners, and badges are pills.
- Hairline (1px) borders only. No coloured side stripes, no dashed borders except the "Needs your attention" placeholder, which is dashed because it is a slot waiting to be filled.
- **The Stamp** is a flat geometric figure (circle knob, trapezoid neck, rounded-rect mount, violet rubber strip) with eyes only, and no mouth. Its imprint is the wordmark's asymmetric check-mark V.

## Components

- **Button** (`src/components/ui/button.tsx`): variants default (violet), outline (sheet with strong rule), secondary, ghost, destructive (red wash) and link. Presses scale to 0.97 in 120ms with a strong ease-out, and only specific properties transition. Pending state: `pending` + `pendingLabel` shows a spinner *with* present-tense text ("Sending…"), sets `aria-busy` and disables the button. Links styled as buttons use `buttonVariants()` on a `Link`, never `Button render={<a>}` (Base UI guidance).
- **Fields** (`input`, `textarea`, `select`, `field`): white sheet fields with a field-outline border, which strengthens on hover and turns violet with a 3px ring at 35% on focus. Errors use `FieldError` with `role="alert"` and `aria-describedby`. Required fields get a red asterisk (hidden from assistive technology, which reads the native `required`).
- **StatusBadge** (`src/components/status/status-badge.tsx`): pill = tone wash + tone-strong text + lucide icon + label. The quote and invoice vocabularies live in `presentation.ts` (for example, an invoice's `SENT` shows as "Unpaid", and `REJECTED` shows as "Declined").
- **MoneyAmount** (`src/components/money-amount.tsx`): a `<data value="8400.00 PHP">` with tabular figures that never wraps. Formatting goes through `formatMoney`, exact from integer minor units.
- **DocumentNumber**: `Nº` (aria-hidden) plus the serial in Geist Mono violet. Unissued documents read "Draft" in muted ink.
- **Wordmark** (`brand/wordmark.tsx`): Geist Bold "TA", a violet check-mark V, then "I", announced as one image "TAVI". Running text says "Tavi".
- **BrandMascot / StampImprint** (`brand/`): expressions neutral, happy, curious, concerned, waiting, celebrating and resting; sizes xs–xl; decorative unless given a `label`. `animated` plays the press (480ms) then the imprint (320ms, 260ms delay) once. `prefers-reduced-motion` shows the static pose.
- **EmptyState / SectionEmpty**: the Stamp, a title (what this is), a description (why it matters) and one action (what to do next), on a white sheet.
- **App shell** (`src/components/app-shell/`): sidebar, mobile top bar, tab bar, "New" as a menu on desktop and a bottom sheet on phones, "More" sheet, `PageHeader`, and a skip link to `#main`.
- **Auth and forms** (0.3): `AuthShell` (a centered sheet on bond paper with the wordmark above), `PasswordInput` (show/hide toggle, 44px target), `FormAlert` (a danger-wash alert that takes focus when it appears), `NativeSelect` (a styled native `<select>` for short choices, so phones get their own picker). "Unavailable" items get a **"Coming soon" badge at full contrast**, never reduced opacity (it failed WCAG contrast).
- **Settings forms** (1.1): `FormField` (`src/components/form-field.tsx`) wires a label, "(optional)" marker, hint and error to one control through a render prop; the error replaces the hint and typed values stay. Long forms are grouped into white **section sheets** (heading + one-line purpose, hairline rule, two-column fields on wide screens) with one "Save changes" at the end and a success toast. Two-option choices are **radio cards** (the checked card takes the stamp border and wash). Members see the same page with a lock notice and disabled fields rather than a hidden page. Forms re-mount their fields per server response (`key={state.submission}`) so returned values replace defaults without Base UI's uncontrolled-value warning.
- **Lists and records** (1.2): a list page is header + primary action, a search box (`role="search"`, GET `?q=`) with view links (Active / Archived, shown only when there is something archived), rows as full-width links on one sheet (name and company, then contact, then city on wide screens), and Previous / Next paging. Three different empties: brand-new (the `SectionEmpty` with the one action), no search results ("No customers match …" + Clear search), empty archive. Records open on their own page with a `BackLink` above the header and the record's reversible actions (Archive/Restore) in the header; archive answers with an Undo toast, never a confirmation. `FormSection` is the shared section sheet for long forms.
- **Documents** (1.5): `DocumentPaper` renders a quote or invoice from a `DocumentView` (built by `buildDocumentView` from the one calculation), identically in the editor preview, the saved page and later the customer's page. Letterhead top left, title and number (stamp ink) top right, customer and dates, a hairline line table (qty and price fold under the description on phones), totals right-aligned with the total on a strong rule; tax-inclusive documents note "Includes VAT 12%: ₱…" under the total. Notes and terms are plain text.
- **Pickers:** `AsyncCombobox` (Base UI Combobox) for searching server data; an optional footer action ("Add a new customer"); `resetAfterSelect` for pickers that add rather than hold a value.
- **Autosave:** a quiet status line ("Unsaved changes", "Saving…", "Saved", "Not saved yet: finish line 2") above the form; a toast only when saving fails.
- **Sending** (1.5b): one dialog with two equal choices as radio cards (Email it / Copy link), the email's To and message prefilled and editable; the primary button names the outcome ("Send email", "Mark as sent and copy link"). Copying a link toasts "Link copied" with where to paste it (the market's share channels); if the clipboard is blocked, the toast shows the link. Revise and cancel confirm in a dialog because they close the customer's link.
- **Customer page** (`/q/[token]`): the business first ("Quotation from Santos Aircon" as the page heading, then the document paper), a status badge, a plain note with the valid-until date and how to reach the business, and a small "Sent with TAVI" footer. Dead links get one calm page with the Stamp.
- **Customer decision** (1.6): on the customer page, "Approve quote" is the one primary button (sticky at the bottom on phones) with "Decline" beside it as outline. Approve asks for the approver's name and a terms checkbox; decline asks for an optional reason. Afterwards the page shows a plain status note ("Approved by Juan Dela Cruz on 1 October 2026. Santos Aircon has been told…") in place of the buttons. The business sees the same fact above the document.
- **Failure pages:** `(app)/error.tsx` (the concerned Stamp, "Nothing you saved was lost", Try again + Dashboard, the error reference in mono) and `(app)/not-found.tsx` (the same page for a missing record and another business's record).
- **Account in the shell:** business name under the wordmark; `AccountBlock` (initials, name, email, sign out) at the foot of the sidebar and in the phone's More sheet. `VerifyEmailBanner` (info wash) reminds unverified users before they send.
- **Motion tokens:** `--duration-fast` 120ms (press, hover), `--duration-normal` 200ms (menus, badges, toasts), `--duration-slow` 320ms (sheets, dialogs). Easing: `--ease-out` `cubic-bezier(0.23,1,0.32,1)` for entering, `--ease-in-out` for movement, `--ease-drawer` for sheets. Exits are faster than entries.

## Do's and Don'ts

**Do**
- Use semantic tokens (`bg-card`, `text-muted-foreground`, `text-stamp`) and never raw colours in components.
- Pair every status colour with an icon and a label.
- Show amounts with `MoneyAmount`; right-align them in columns.
- Give every empty list the three answers: what, why, what next.
- Keep one primary (violet) action per view; everything else is outline, ghost or link.
- Check phone width: stacked rows instead of wide tables, bottom sheets instead of popovers.

**Don't**
- Don't use violet as a background field, gradient, glow or decorative stripe.
- Don't animate money, count numbers up, or add entrance choreography to app screens.
- Don't add a kicker or eyebrow label above headings, or number sections for decoration.
- Don't use Unicode glyphs (✓, →) in place of icons; use lucide or authored SVG.
- Don't use the mascot to carry meaning, joke about money, or animate it continuously.
- Don't introduce a second typeface or a dark theme without updating this file.
