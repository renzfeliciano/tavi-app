---
name: tavi-brand-experience
description: TAVI's brand voice, naming convention, the Stamp mascot's usage rules, micro-interaction copy and customer-facing branding. Use when writing product copy, emails, empty states, success moments, or placing the mascot or wordmark in tavi-app.
---

# TAVI brand experience

Design System → how it looks. Motion → how it moves. **Brand experience → how it feels.** The mascot ties them together. Rule: *delight the user, never distract the user* — the app must work perfectly with the mascot removed.

## Names

- Product: **TAVI** in the wordmark (`Wordmark` component, check-mark V), **Tavi** in sentences ("Sent with Tavi", "Welcome to Tavi").
- Never hard-code names or taglines: `brand` from `src/config/brand.ts` (`brand.name`, `brand.wordmark`, `brand.taglines.primary` "Create. Send. Get paid.").
- The "TA = Travis, VI = Invoice" story appears only in an About/brand-story context.

## Voice

Friendly, calm, competent, human; slightly playful, never childish.

| Moment | Good | Not |
|---|---|---|
| Payment | "Payment recorded" | "OMG we got paid!!! 🎉💰" |
| Empty | "No quotes yet. Quotes let customers approve work before you start." | "Nothing here :(" |
| Error | "We couldn't send the quote. Your quote was not lost. Try again." | "Oops! Something broke 😬" |
| Overdue | "3 invoices are overdue" | jokes, guilt, emoji about debt |

No emoji in product UI copy. No gamification of money or debt.

## The Stamp (D3)

`<BrandMascot expression size animated label? />` — decorative (`aria-hidden`) unless given a `label`.

| Context | Expression | Animated? |
|---|---|---|
| Empty lists | `curious` | no |
| Coming soon / building | `waiting` | no |
| Onboarding, first-run checklist | `happy` | no |
| Quote sent / approved, invoice paid | `celebrating` + `StampImprint` | once |
| Errors, failed send | `concerned` (calm, never panicked) | no |
| Idle / nothing to do | `resting` | no |

Never: continuous animation, speech bubbles, the mascot as the only carrier of meaning, reactions to amounts.

## Customer-facing surfaces

On quotes, invoices, PDFs, portals and customer emails the **business's** brand leads (logo, name). TAVI appears only as a small "Sent with Tavi" footer. The mascot appears on portals only on the approved/paid confirmation.

## Emails

Sender "Business via Tavi" with Reply-To set to the business for customer emails; account emails from Tavi. Short, plain, one clear link, and a paste-able URL.
