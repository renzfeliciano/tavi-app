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
  stamp-violet-text-dark: "oklch(0.76 0.12 285)"
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
- Light and dark themes (D24): System, Light or Dark per device. Customer portals, PDFs, the document sheet and the Stamp are always light.

## Colors

A cool, near-neutral paper-and-ink palette with a single inked accent and four semantic state colours.

### Primary
- **Stamp-pad Violet** (`oklch(0.45 0.15 285)`, token `--primary` / `--stamp`): primary buttons, document serials (`Nº QUO-000124`), the Stamp and its imprints, the current nav item's icon and label on phones, focus rings, the text caret and native control accents. Hover and pressed states use **Pressed Violet** (`oklch(0.39 0.15 285)`).
- **Violet as text** (`--primary-text`, `text-primary-text`): links and any violet words on a surface. Same ink as `--primary` on paper; lighter in dark mode (`oklch(0.76 0.12 285)`) so it keeps 4.5:1 on the dark sheet. `--primary` stays for fills (buttons, badges, the Stamp); never use `text-primary` for words.
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

- **App shell:** a sidebar at `lg` (1024px) and up, 16rem wide and collapsible to 5rem (icons with tooltips; Ctrl+B or ⌘B toggles it; the choice is a cookie, so the first paint is right). Popups from the sidebar (account, New, business switcher) are as wide as the sidebar. The page loader centres in the main panel, not the window. Below that, a sticky 56px top bar with the wordmark and a fixed bottom tab bar (Home · Quotes · **New** · Invoices · More) that respects `safe-area-inset-bottom`.
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

- **Button** (`src/components/ui/button.tsx`): variants default (violet), outline (sheet with strong rule), secondary, ghost, destructive (red wash with the stronger red `--danger-strong` for its text, so every state keeps 4.5:1 in both themes) and link. Presses scale to 0.97 in 120ms with a strong ease-out, and only specific properties transition. Pending state: `pending` + `pendingLabel` shows a spinner *with* present-tense text ("Sending…"), sets `aria-busy` and disables the button. Links styled as buttons use `buttonVariants()` on a `Link`, never `Button render={<a>}` (Base UI guidance).
- **Fields** (`input`, `textarea`, `select`, `field`): white sheet fields with a field-outline border, which strengthens on hover and turns violet with a 3px ring at 35% on focus. Errors use `FieldError` with `role="alert"` and `aria-describedby`. Required fields get a red asterisk (hidden from assistive technology, which reads the native `required`).
- **StatusBadge** (`src/components/status/status-badge.tsx`): pill = tone wash + tone-strong text + lucide icon + label. The quote and invoice vocabularies live in `presentation.ts` (for example, an invoice's `SENT` shows as "Unpaid", and `REJECTED` shows as "Declined").
- **KindIcon** (`src/components/kind-icon.tsx`): one icon per kind of thing a business sells, a box for a product and a wrench for a service, shared by the catalog list, the New menu and the item picker in the editor. Products always come before services (tabs, New menu, picker groups), the order of the page's title, Products & Services.
- **MoneyAmount** (`src/components/money-amount.tsx`): a `<data value="8400.00 PHP">` with tabular figures that never wraps. Formatting goes through `formatMoney`, exact from integer minor units.
- **DocumentNumber**: `Nº` (aria-hidden) plus the serial in Geist Mono violet. Unissued documents read "Draft" in muted ink.
- **Wordmark** (`brand/wordmark.tsx`): Geist Bold "TA", a violet check-mark V, then "I", announced as one image "TAVI". Running text says "Tavi".
- **BrandMascot / StampImprint** (`brand/`): expressions neutral, happy, curious, concerned, waiting, celebrating and resting; sizes xs–xl; decorative unless given a `label`. Idle life (D20): blink, breath, an occasional hop and glance, eyes that follow the pointer (from `sm` up), all off under `prefers-reduced-motion`; `idle={false}` holds it still. `animated` plays the press (480ms) then the imprint (320ms, 260ms delay) once. `imprint={false}` leaves the check out and trims the drawing to end under the pad, for a Stamp that sits beside text. Customer documents carry a still Stamp in the footer and a PAID / APPROVED imprint when settled.
- **Mascot language** (D22, D23): the Stamp has four jobs and no others, plus one lockup: the public home's header sets the TAVI wordmark alone, and its footer is signed by the happy Stamp, so the two never repeat each other. The public home is one more exception, asked for by name: it keeps a living Stamp in each section (decoration only, `aria-hidden`), and each plays a different part so no two sections repeat one motion. In how it works the Stamp walks from card to card while each card plays its own scene. In sending it stays put: the quotation leaves it and travels to the email, PDF and link cards, each of which plays its own scene. In the rest of the job it sleeps (the Zs float up) beside a card of activity until the section is in view. A neutral Stamp sits on a light chip in the violet band (its ink body would be lost on violet). At the close it lowers onto the statement beside the button, presses it Paid and lifts. The footer's Stamp presses its check once when it comes into view. Back to top is the Stamp too: it pops in, hops and taps its check every few seconds with the arrow bobbing along, wiggles when reached for, and on press the button flies up as the page scrolls up. They blink, breathe and follow the pointer like any Stamp. This does not extend to the app's own screens. *Greeting*: once after sign-in. *Companion*: one note at a time, drawn only from counted facts (`insights.ts`), with a real action and a dismiss, scoped to the pages where it matters, never repeated once dismissed, and never above a dialog. *Empty state*: the Stamp beside the title, the description and the one action. *Reaction*: a quiet mood on a form (working, success, concerned on error), always decoration, because the same thing is written in text and the screen never waits on it. It does not chase the pointer on quiet screens (`follow={false}`, as on sign-in), and the periodic stamp press is off there too (`calm`). Skeletons stay the loading indicator; the Stamp never replaces them. The one place it appears while something loads is the page loader (below), which is small, decorative, and sits over the skeleton. No LLM writes its words.
- **EmptyState / SectionEmpty**: the Stamp, a title (what this is), a description (why it matters) and one action (what to do next), on a white sheet.
- **Sidebar** (`app-sidebar.tsx`, `sidebar-nav.tsx`): workspace switcher on top, a New menu (quotation, billing statement, customer, then Product before Service, the order of the Products & Services page), then grouped navigation: Dashboard; **Sales** (Quotations, Billing statements, Payments); **Manage** (Customers, Products & Services, Reports). Settings is not in the list: it lives in the account popover at the foot, with the theme choice (System / Light / Dark, a radio group) and Sign out. The Today card (what needs attention, one action) sits above the account block and is hidden when collapsed. Count badges are centred (`inline-flex items-center justify-center leading-none`). Purchase orders, Receipts and the Books group join the nav when those phases exist. On a short window (a laptop-height screen with a mouse: the `short` variant, `max-height: 800px` and `pointer: fine`, never a phone) the rows tighten and the Today card drops its figures so everything fits without scrolling; where it still scrolls the scrollbar is slim. The foot is one shrinking column, so a long business name is cut with an ellipsis and never pushes the Ctrl B hint out. Collapsed-icon tooltips keep one element tree whether or not they are showing (`CollapsedTip` disables the tooltip rather than removing it), because the account menu and New menu anchor to that button.
- **BackLink** (`back-link.tsx`): the way up from every detail or sub-page, above its header: a bordered, button-shaped link with an arrow and "Back to Customers" (never a faint "‹ Customers"). Present on all detail and sub-pages, including Security and Recycle bin; 44px tall on touch.
- **Registration area** (`/settings/registration`, owners and admins only): the business's BIR, DTI and local registration papers. A certificate vault (upload and keep scans, `documents-card.tsx`), a filing calendar of upcoming deadlines (`deadlines-card.tsx`), and the registration form with gap checks that say what is missing in plain words. The papers carry tax numbers and home addresses, so nothing here is shown to other roles.
- **App shell** (`src/components/app-shell/`): sidebar, mobile top bar, tab bar, "New" as a menu on desktop and a bottom sheet on phones, "More" sheet, `PageHeader`, and a skip link to `#main`.
- **Auth and forms** (0.3): `AuthShell` (a centered sheet on bond paper with the wordmark above), `PasswordInput` (show/hide toggle, 44px target), `FormAlert` (a danger-wash alert that takes focus when it appears), `NativeSelect` (a styled native `<select>` for short choices, so phones get their own picker). "Unavailable" items get a **"Coming soon" badge at full contrast**, never reduced opacity (it failed WCAG contrast).
- **Settings forms** (1.1): `FormField` (`src/components/form-field.tsx`) wires a label, "(optional)" marker, hint and error to one control through a render prop; the error replaces the hint and typed values stay. Long forms are grouped into white **section sheets** (heading + one-line purpose, hairline rule, two-column fields on wide screens) with one "Save changes" at the end and a success toast. Two-option choices are **radio cards** (the checked card takes the stamp border and wash). Members see the same page with a lock notice and disabled fields rather than a hidden page. Forms re-mount their fields per server response (`key={state.submission}`) so returned values replace defaults without Base UI's uncontrolled-value warning.
- **Lists and records** (1.2): a list page is header + primary action, then a search box (`role="search"`, GET `?q=`, `ListSearch`) with view links (Active / Archived, status tabs; shown only when there is something to switch to), then **one `DataTable`** (`src/components/data-table.tsx`) for the rows. Records open on their own page with a `BackLink` above the header and the record's reversible actions (Archive/Restore) in the header; archive answers with an Undo toast, never a confirmation. `FormSection` is the shared section sheet for long forms. Three different empties: brand-new (the `SectionEmpty` with the one action), no search results ("No customers match …" + Clear search), empty archive.
  - *The table:* a CSS grid with table roles in one white panel. The panel has a fixed height (the window less the top bar, header and controls, so the footer is in view without scrolling the page; `controls={2}` for a list with tabs as well as a search, and `strip` for one with a summary strip over it; never under 22rem or over 64rem); the **only scroll is inside it, vertical**, under a sticky column header, and sideways scroll never appears. The footer sits outside the scroller and always shows the count ("Showing 26–50 of 143 customers"), the page sizes (Rows 10 / 25 / 50 / 100, default 25, from `PAGE_SIZES`; not on a phone) and a Previous / Page x of y / Next pager (left out when one page holds everything). Rows are all the same height (`min-h-16`, two lines of text), the whole row opens the record through one stretched link in the first cell, amounts are right-aligned with tabular figures. A column is `{id, header, width, align, hideBelow, phone, lead, skeleton, cell}`: `hideBelow` drops it at `md` or `lg`, `phone: "title" | "end"` places it in the phone's two-column row, `lead` draws a monogram disc (people) or a tile (things). **On a phone** the header is hidden and each row is a title and an amount with one summary line under it; the inner scroll and the footer stay. Shared cell parts: `Monogram`, `PaidProgress` (a bar with "paid of total"), `CellTitle`, `CellSub`.
  - *Summary strips* (2b, `src/components/summary-strip.tsx`): the Quotations, Billing statements and Payments lists open with a strip of figures between the header and the controls: what the list adds up to, one sheet per currency (the business's own currency is always there, in zeros before the first document; currencies are never added together). Quotations: Sent, Viewed, Approved ("to bill"); billing statements: Outstanding, Overdue (danger ink only above zero, "oldest 11 days late"), Drafts; payments: Today, Last 7 days, Last 30 days. Each tile says how many documents make it up ("None" or "Nothing owed" when it is empty) and, where there is a tab behind it, is a link to that tab. One row of tiles at every width so the table under it can be sized to fit (`PANEL_HEIGHT` has `1s` and `2s` variants for a list with a strip); a phone shows two tiles in a row (the quiet ones carry `phone: false`). Counts and amounts only: nothing animates, no gradient, no icon, no colour but the semantic wash. Its skeleton (`SummaryStripSkeleton`) shares the class constants, so the page does not shift.
  - *Paging, sizes and search:* all of it lives in the URL (`?page=`, `?size=`, `?q=`), so a list is linkable and the back button works. Changing the search, a tab or the size starts again at page 1; a size is kept while paging. Search waits 300 ms after the last keystroke, makes no request for an unchanged value, and submits at once on Enter. Navigation is throttled (`ListPending`): rapid clicks collapse into the latest one (a leading and a trailing request 300 ms apart, nothing sent twice for the same address), the controls show busy, and the footer is `aria-busy` while a request is on its way. Lists return `PageMeta` (`src/shared/pagination/page-window.ts`) with `total` (everything the business has, which decides "nothing yet") apart from `matching` (what the search found, which decides the count and the pager).
- **Documents** (1.5): `DocumentPaper` renders a quote or invoice from a `DocumentView` (built by `buildDocumentView` from the one calculation), identically in the editor preview, the saved page and later the customer's page. Letterhead top left, title and number (stamp ink) top right, customer and dates, a hairline line table (qty and price fold under the description on phones), totals right-aligned with the total on a strong rule; tax-inclusive documents note "Includes VAT 12%: ₱…" under the total. Notes and terms are plain text. **Sign-off:** every "Sent with" line (the PDF footer, the customer link's footer and the foot of every email) is the TAVI wordmark alone, never the stamp logo or the Stamp beside it; the email's is a PNG built by `npm run brand:build` (`public/icons/tavi-email-wordmark.png`).
- **Pickers:** `AsyncCombobox` (Base UI Combobox) for searching server data; an optional footer action ("Add a new customer"); `resetAfterSelect` for pickers that add rather than hold a value.
- **Examples in empty fields:** every text field shows an example of what goes in it while empty, written "e.g. …" in muted ink (`eg()` in `src/shared/text/example.ts`), so nobody has to guess the shape of an answer. Anything that depends on the country comes from the market profile (`MarketProfile.examples`: a person, a company, a business, an email, a phone number and an address; `taxId.example`; `paymentDetailExamples` per payment method; the business category's `itemExample` and `productExample`), never hard-coded in a form. Money fields show `0.00`. Not covered because the browser already shows the shape: dates and times, checkboxes, radios, files and passwords. A placeholder is never the label (every field keeps its visible label) and never a real person or number. `src/app/field-placeholders.test.ts` walks every field in the app and fails for a new one without a placeholder.
- **Autosave:** a quiet status line ("Unsaved changes", "Saving…", "Saved", "Not saved yet: finish line 2") above the form; a toast only when saving fails.
- **Sending** (1.5b): one dialog with two equal choices as radio cards (Email it / Copy link), the email's To and message prefilled and editable; the primary button names the outcome ("Send email", "Mark as sent and copy link"). Copying a link toasts "Link copied" with where to paste it (the market's share channels); if the clipboard is blocked, the toast shows the link. Revise and cancel confirm in a dialog because they close the customer's link.
- **Customer page** (`/q/[token]`): the business first ("Quotation from Santos Aircon" as the page heading, then the document paper), a status badge, a plain note with the valid-until date and how to reach the business, and a small "Sent with TAVI" footer. Dead links get one calm page with the Stamp.
- **Customer decision** (1.6): on the customer page, "Approve quote" is the one primary button (sticky at the bottom on phones) with "Decline" beside it as outline. Approve asks for the approver's name and a terms checkbox; decline asks for an optional reason. Afterwards the page shows a plain status note ("Approved by Juan Dela Cruz on 1 October 2026. Santos Aircon has been told…") in place of the buttons. The business sees the same fact above the document.
- **Billing** (1.7a): an approved quote's primary action is "Create billing statement" (the market's name); afterwards it becomes "View billing statement" and Cancel disappears. The invoice editor is the quote editor with "Due date" and a "How to pay" box in the preview. The customer's invoice page leads with the balance due and how to pay, side by side, above the document.
- **Payment QR codes** (D26): up to three labelled QR codes sit in the "How to pay" box on quotes and invoices (page, PDF), each 112 px on the page and 74 pt in the PDF on a white plate with a 2-module quiet zone, with its label beneath. Drawn from text as inline SVG, never an uploaded picture. The Settings card (Business profile) shows a live preview per row; a hidden row is dimmed and marked "Hidden". Payment acknowledgements carry no QR. In email the codes are PNG images under "Scan to pay", with the page link as the fallback.
- **Correcting a sent bill** (1.7b): Edit opens the editor without autosave; "Save changes" confirms ("It becomes revision 2…"). Void, Cancel and Void and duplicate each ask for a reason in a dialog with a destructive button; the result toasts and the page shows "Voided … : reason".
- **Payments** (1.8): on a sent bill, a Payments panel shows the balance due and "Record payment" (primary). The dialog prefills the balance and today's date; the market's withheld-tax field (PH: Form 2307) sits below with its hint; "Email a payment acknowledgement to …" is ticked when the customer has an email. Voided payments stay listed, struck through, with the reason. The acknowledgement is its own paper (From / Received from / details / Amount received, notice and disclaimer at the foot).
- **PDFs** (1.9): A4 for quotes and bills, A5 for payment acknowledgements; always light, Geist embedded, the same content and order as the paper on screen, "Page n of m" at the foot. "Download PDF" is an outline button on the business's pages and a quiet text link on the customer's (one per payment in "Payments received").
- **Dashboard** (1.10, 2.1): quick actions in the header, then the money strip: one sheet of three tiles per currency, each a link to the list behind its number and saying how many documents make it up ("3 billing statements"; Overdue adds "oldest 11 days late" and takes danger ink only when above zero; Paid in the last 30 days adds the payment count). Below it two columns from `xl` up (one column on a phone, in this order): on the left **Needs your attention** (rows lead with a tinted mark, the label in words (Overdue, Approved ready to bill, No answer yet, Unfinished draft), the number and customer, and the amount on the right with "11 days late" under it for overdue money; empty state "You're all caught up.") and the **Pipeline** (one sheet, a row of stages per document: quotations Draft, Sent, Viewed, Approved; billing statements Draft, Unpaid, Overdue; each stage a link to its list with its label, the count, what it is worth per currency (never added together) and, last, what the stage means in a few words; an empty stage is a plain muted zero); on the right **Recent activity**, grouped by day in the business's time zone (Today, Yesterday, then dates) with the time of day beside each line and a small tinted mark for the kind of event (sent and viewed in info, approved and paid in success, declined in danger, the rest neutral). People who cannot read the audit log get one full-width column. The marks are tinted discs from the semantic washes, never violet; every figure is a count or an amount, nothing animates. The first-run checklist marks finished steps with a check and "Done" and makes the next step the primary button.
- **Loading** (`src/components/skeletons.tsx`): every page has its own `loading.tsx` drawn in that page's layout: the same containers, sheets and spacing, text as muted bars in the line box the real text takes, rows in the list's own shape, so content lands where the skeleton was and nothing shifts. No spinners in content. `LoadingScreen` makes it one status region ("Loading customers" for screen readers, the bars hidden); the pulse stops under reduced motion. **Page loader** (`brand/page-loader.tsx`, styles in `globals.css`): `LoadingScreen` also lays a small unframed animation (about 160 by 148 px, no card, border or background) in the centre of the main panel on desktop (the window minus the 15rem sidebar; the app shell sets `--page-loader-inset`) and in the centre of the screen on tablet, phone and every page without a sidebar showing a small stamping station: the Stamp presses its check onto a sheet carried along a belt from a blank pile to a stamped pile, with the TAVI wordmark rising in underneath (the letters and V together), a 2.8s loop. It rides on top of the skeleton and never replaces it: `aria-hidden`, `pointer-events-none`, `fixed`, so the skeleton keeps its layout, pulse and "Loading…" label and nothing under it is blocked or shifted. It fades in only after 150ms, so a quick navigation never flashes it; pure CSS, no client JS; the Stamp stays in the light theme's colours and the imprint follows the page theme; under reduced motion it shows the finished picture (happy Stamp, imprint with its check, TAVI) after the same delay. On a hard load or refresh nothing waits on the session: the page streams first with its own skeleton and loader, while the sidebar and phone top bar stand in as empty frames of the same size (`ShellChromeFallback`) and fill in beside it (the layout's `Suspense` boundaries; the shell reads the session through the cached `loadShell`). Customer links (`q/`, `i/`), the public home and the sign-in, sign-up, forgot-password and reset-password pages pass `loader={false}` and keep the plain skeleton (customer links carry the business's branding; the sign-in pages have their own Stamp beside the form; the home is a first impression that should not wait behind an animation). Every other page, including the legal pages, onboarding and accept-terms, shows the loader (`src/app/loading-states.test.tsx` lists the exceptions). A GIF of the same loop is for downloads and decks, not for the app. **Same-page navigations:** a tab, page link or search on a list changes only its query string, so Next keeps the old rows on screen and never shows `loading.tsx` for it. Every list page (`src/components/list-pending.tsx`) wraps its controls and rows in `ListPending` and its rows and pager in `ListResults`: the controls (`ListViews`, `ListPager`, `ListSearch`, the Reports dates) report a navigation on its way, and after 150ms (the page loader's own delay) the rows are swapped for that list's skeleton, announced once as a status. The rows stay mounted underneath, hidden, so the link that was clicked keeps reporting until it is done. Search and the Reports dates go through the router in a transition (still plain GET forms without JavaScript). The skeleton is the same component `loading.tsx` draws, and for a table it is the table itself: `DataTableSkeleton` takes the same column definitions (real header text, a bar of varied length in each cell, the same rows height and footer), so the panel never changes size when the rows arrive; `src/app/loading-states.test.tsx` fails for a list page that doesn't wrap its rows.
- **Recycle bin** (`/recycle-bin`, linked from Settings): deleting a draft toasts "Draft deleted." with a View link; the page lists deleted drafts (document name, customer, total, days left, Restore, and for owners and admins Delete forever and Empty recycle bin, both behind a danger modal) and, below, archived customers, products, services and taxes with Restore. Days left turn amber at 3 or fewer. Nothing is shown as a blank box: with nothing deleted or archived it is the resting-mascot empty state.
- **Modals** (`src/components/ui/dialog.tsx`): every modal carries the Stamp in its footer, at the left end of the button row, facing the buttons (on a phone it sits above them, top left). `DialogContent` takes `mascot` (default `neutral`; `null` leaves it out) and `tone`; the footer reads them. The face says what kind of moment it is: **concerned** for something hard to undo (void, cancel, delete or discard, close account, leave or remove a member, turn off invoice mode, update an issued bill), **curious** for forms and questions (record a payment, tax rates, revise a quote, make owner), **happy** for sending, **waiting** for the idle-session warning, **neutral** otherwise (sign out other devices). `tone="danger"` adds a red edge along the card's top. The customer's approve/decline modal passes `mascot={null}`: it carries the business's branding. The Stamp is decoration (`aria-hidden`, never the only carrier of meaning). On phones a modal is a bottom sheet that rises from the screen edge (rounded top, safe-area padding); from `sm` up it is a centred card that fades and scales in over 200ms (150ms out); reduced motion shows and hides it at once. Header and footer stay in view; only the body scrolls when the content is long. Wrap everything between them in `DialogBody` (a form around all three is fine: it takes no box of its own), so the scrollbar sits on the body alone. A body that scrolls and holds nothing to tab to (plain text or a list) becomes a tab stop itself, with a focus ring, so keyboard users can scroll it; a body with fields keeps the first field as its first focus. Behaviour (what each button does, what needs a reason or a password) is unchanged.
- **Streamed shell pieces and hydration** (`src/components/app-shell/hydration.test.tsx`): the sidebar, the phone top bar, the phone tab bar and the verify-email banner stream in after the page. A modal opened before they hydrate makes Base UI mark them `aria-hidden` (and `data-base-ui-inert`), which React would report as a hydration mismatch in development. Each carries `suppressHydrationWarning` on its root element for that reason, and only there; do not widen it to their children.
- **Home page** (`src/app/(home)/page.tsx`): one public page: a sticky header (the wordmark alone, theme menu, Sign in, Get started; its glass and edge fade in once the page moves), a hero with the primary tagline as its h1 and a sample quotation (set close under the header, so on a desktop the first screen reaches the sample's Approved stamp), a three-step "how it works" (each step a live scene: a quotation being filled in with its total working itself out, the link going out, the payment being recorded; joined by arrows, the last carries the check), "Send it the way your customers read it" (an outbox: a quotation leaves the sender and travels to three cards, each with its own live scene and plain words: the email the customer gets and opens, a PDF page that is scanned and saved, the customer's own page where Approve and Decline are pressed; the pictures are `send-previews.tsx`, always light, `aria-hidden`, made-up figures from the sample quotation; hovering or pressing a card plays its scene again), "And the rest of the job" (a heading, one line and a card of recent activity on the left, six ruled rows on the right, each with a small picture that plays, so it does not repeat the strengths grid below it: downpayments and part-payments, scan to pay, reports for the accountant, saved customers and price list, revising a sent quotation, the recycle bin), six plain strengths (a violet band, each with its own small moving picture), a closing call to action (a card for a statement still owing: the Stamp lowers onto it, presses it Paid and lifts, and coming to the button sends it down at once; with the same three moments as the sign-in screens, ending in the check), and, on a phone, a Create an account bar that stays at the foot of the screen once the first screen has gone by, and a footer: the Stamp and the tagline, one line on what Tavi is, the "no tax or accounting advice" note, three link columns centred against them (Product, the sections of this page; Get started, Sign up and Sign in; Legal, the Terms of Service and Privacy Notice), and a small-print line kept to the left because the Back to top button floats at the bottom right. It claims nothing that is not true: no operator, address, socials or compliance badges. Document and channel names come from the market profile. The sample quotation (`sample-quotation.tsx`) uses made-up people and figures (Renzo Feliciano Payod Repair Services, General Trias City), says it is a sample, and stays light in dark mode like every document sheet. It shows only what the paper does today: a row discount, a row note, a Terms block that states a 50% downpayment, and VAT included in the total. The auth screens' tagline sets its last sentence in the brand colour through `brand/tagline.tsx`. Each section has its own Stamp (Mascot language), a Back to top button that is the Stamp itself (its own rule squeezes icons to 1rem, so the Stamp names its size), and a few small chips (paper, coins, a check) drift around the sample on a wide screen, kept to the card's outer edges and clear of its text. It carries only what is true today: no prices, customer counts, testimonials or BIR claims. Every feature line is checked against the app before it goes on the page (a feature still being built stays off it). It is the same page for everyone; nothing on it reads the session.
- **Reports** (2.2): period tabs (ListViews) plus a From/To form; each report is a section with its heading, one line on what counts, an outline "Download CSV" button, figure tiles like the dashboard's money strip, and white rows of label and amount. Per currency, never summed; a dashed quiet line when there's nothing.
- **Failure pages:** `(app)/error.tsx` (the concerned Stamp, "Nothing you saved was lost", Try again + Dashboard, the error reference in mono) and `(app)/not-found.tsx` (the same page for a missing record and another business's record).
- **Account in the shell:** business name under the wordmark; `AccountBlock` (initials, name, email, sign out) at the foot of the sidebar and in the phone's More sheet. `VerifyEmailBanner` (info wash) reminds unverified users before they send.
- **Motion tokens:** `--duration-fast` 120ms (press, hover), `--duration-normal` 200ms (menus, badges, toasts), `--duration-slow` 320ms (sheets, dialogs). Easing: `--ease-out` `cubic-bezier(0.23,1,0.32,1)` for entering, `--ease-in-out` for movement, `--ease-drawer` for sheets. Exits are faster than entries.
- **Home page motion** (`src/app/(home)/home.css`, plain CSS; the one script is `hover-stage.tsx`, which only sets `--mx` and `--my`, where the pointer is): the public home may do more than the app, because it is a first impression and not a tool. A background of three soft glows (stamp violet, carbon-copy blue, a warm note, all from theme tokens, so they follow light and dark) over a dotted grid, drifting slowly; a staggered entrance for the first screen and a gentle float on the sample quotation; glows that trail the page and blocks that arrive as they scroll into view (scroll-driven animations, inside `@supports`, so other browsers show the finished page); cards that lift a little under the pointer. Each section arrives its own way (a rise, from the left, from the right, a tilt up, a zoom, a pop, and a pop), so the page does not play one fade over and over; the header's glass fades in as the page moves and the phone bar rises after the first screen; the primary buttons catch the light now and then; the arrows between the steps nudge forward; and the chips around the sample bob. For a fine, hovering pointer only, things lean toward it by their depth (the glows most, then the chips and the Stamps) and the sample card tilts a few degrees. It keeps the rules below: opacity and transform only (a hover glow is a pseudo-element whose opacity fades), everything that moves sits inside `prefers-reduced-motion: no-preference` (under reduced motion the page is the same page, standing still), decoration is `aria-hidden`, and the glows stay faint enough that text keeps its contrast. The 320ms limit is for the app's own UI; the home's scroll-linked and ambient motion are not timed by it. `home-style.test.ts` checks the rules without a browser: only opacity and transform move in keyframes, nothing moves outside `no-preference`, scroll timelines sit inside `@supports`, the pointer is used only for a fine pointer, no two entrances start from the same place, every `home-` class the page uses exists in the CSS, and no set of keyframes is named twice (a second would silently replace the first everywhere). Live scenes are pure functions of a tick (`scenes.ts`) driven by one director hook (`director.ts`) that runs only while the section is in view and motion is welcome; their resting frames are the still pictures. A Next special file name (layout, template, error and the like) is never used for a helper in the route folder.
- **Motion rules:** only opacity and transform; nothing over 320ms. Closing menus, popovers and modals hold their last frame until they unmount (`[data-closed]` sets `--tw-animation-fill-mode: forwards` in globals.css), and the modal overlay has no backdrop blur, because either one shows up as a blink when it closes. Page changes are not animated: a React `<ViewTransition>` or a path-keyed wrapper around the page area holds back the new tab title for the length of the animation (the tab shows the raw address meanwhile), so page content swaps without one. `prefers-reduced-motion` turns CSS animations off (globals.css).
- **Cursor standard:** anything pressable shows the pointer; anything switched off shows `not-allowed`, or `progress` while it is working (`aria-busy`). Set once in base CSS (links, buttons, summaries, selects, labels, checkboxes, radios, and the ARIA roles for button, link, tab, menuitem, option, radio, switch, checkbox, combobox), so components do not repeat it; `Button`, `DropdownMenu`, `Select`, `Combobox`, `Input` and `Tabs` add their own disabled states. Plain text, text inputs and non-interactive boxes keep their default cursor.

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
- Don't use the mascot to carry meaning, joke about money, or let it move large or fast: idle motion stays small, and the big moment (press, imprint) plays once.
- Don't introduce a second typeface without updating this file. Dark tokens live beside the light ones in `globals.css`; a test keeps them in step and checks AA contrast.
