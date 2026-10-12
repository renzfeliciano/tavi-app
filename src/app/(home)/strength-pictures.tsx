import type { CSSProperties } from "react";
import { FileTextIcon, MailIcon, SmartphoneIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { SAMPLE_BUSINESS } from "./sample-quotation";

// Six small pictures for the violet band, one on each card: a phone being tapped,
// a link travelling to a customer, a letterhead being typed, a document's
// statuses ticking off, pesos and VAT in turn, and the roles on a team. Each
// plays on its own in CSS alone (home.css: nothing but opacity and transform,
// looping, and only for people who have not asked for less motion), so none needs
// a script. What they draw here is the frame they rest on when nothing moves.
// They sit on a light chip, like the paper and phones they stand for, which also
// reads on the violet in either theme. Made-up names and numbers, and decoration
// only: the words on the card say the same thing.

const FRAME = "relative grid h-24 w-full place-items-center overflow-hidden rounded-lg bg-card text-foreground";
/** Where a piece stands in a staggered loop (home.css reads --i). */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/** Made for your phone: a quotation on a phone, and a finger tapping Send. */
export function PhoneTapPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="absolute top-3 grid h-24 w-16 content-start gap-1.5 rounded-t-xl border-2 border-foreground/80 bg-background p-1.5">
        <span className="mx-auto h-0.5 w-5 rounded-full bg-foreground/30" />
        <span className="h-1.5 w-full rounded-full bg-border-strong" />
        <span className="h-1.5 w-2/3 rounded-full bg-border-strong" />
        <span className="home-press relative grid h-4 place-items-center rounded bg-primary text-[0.5rem] font-medium text-primary-foreground">
          Send
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="home-tap-loop size-6 rounded-full bg-stamp/40" />
          </span>
        </span>
      </div>
    </div>
  );
}

/** Nothing for customers to sign up to: a link goes to a customer, and they approve it. */
export function LinkTravelPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="relative flex h-12 w-52 items-center justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-stamp-subtle text-stamp">
          <FileTextIcon className="size-4" />
        </span>
        <span className="absolute inset-x-11 top-1/2 border-t border-dashed border-border-strong" />
        <span className="absolute inset-x-11 top-1/2 -mt-2">
          <MailIcon className="home-travel size-4 text-stamp" style={{ "--run": "104px" } as CSSProperties} />
        </span>
        <span className="relative grid size-9 place-items-center rounded-lg bg-muted text-foreground">
          <SmartphoneIcon className="size-4" />
          <span className="home-approve absolute -top-3 -right-4 rounded-full bg-success px-1.5 py-0.5 text-[0.55rem] font-semibold text-white">Approved</span>
        </span>
      </div>
    </div>
  );
}

/** Your business comes first: its own name typed at the head of the page, and Tavi a small line at the foot. */
export function LetterheadPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="grid w-full content-between gap-2 px-4 py-3">
        <div className="grid gap-1.5">
          <span className="relative w-fit overflow-hidden font-heading text-xs font-semibold">
            {SAMPLE_BUSINESS}
            {/* Slides away to the right and the name is there, as if typed (a caret rides its edge). */}
            <span className="home-cover absolute inset-y-0 left-0 w-full border-l border-foreground bg-card" />
          </span>
          <span className="h-1 w-2/3 rounded-full bg-border-strong" />
        </div>
        <span className="flex items-center justify-end gap-1 text-[0.55rem] text-muted-foreground">
          Sent with <Wordmark size={9} />
        </span>
      </div>
    </div>
  );
}

const STATUSES = ["Draft", "Sent", "Approved", "Paid"];

/** Records you can follow: the statuses a document goes through, ticked off one after another. */
export function HistoryPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <ol className="grid w-full grid-cols-4 px-3">
        {STATUSES.map((status, index) => (
          <li key={status} className="relative grid justify-items-center gap-1.5">
            {index < STATUSES.length - 1 && (
              <span className="absolute top-[0.3125rem] left-1/2 h-0.5 w-full bg-muted">
                <span className="home-tick-line block h-full w-full bg-stamp" style={at(index)} />
              </span>
            )}
            <span className="relative z-10 size-3 rounded-full bg-muted">
              <span className="home-tick absolute inset-0 rounded-full bg-stamp" style={at(index)} />
            </span>
            <span className="text-[0.6rem] font-medium">{status}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const CHIPS = ["₱ PHP", "VAT 12%", "TIN 000-000-000", "GCash"];

/** Built for the Philippines: pesos, VAT, a TIN and the way people pay, one after another. */
export function PesoPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={`${FRAME} grid-cols-1`}>
      {CHIPS.map((chip, index) => (
        <span
          key={chip}
          data-rest={index === 0 ? "" : undefined}
          className="home-cycle col-start-1 row-start-1 rounded-full border border-border-strong bg-background px-3.5 py-1.5 font-mono text-xs font-medium"
          style={at(index)}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

const ROLES = [
  { initials: "TR", role: "Owner" },
  { initials: "MS", role: "Admin" },
  { initials: "LC", role: "Member" },
];

/** Your team, with limits: an owner, an admin and a member, each taking a turn to be the one in the light. */
export function RolesPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="grid justify-items-center gap-2">
        <div className="flex -space-x-2">
          {ROLES.map(({ initials }, index) => (
            <span key={initials} className="relative grid size-9 place-items-center rounded-full border-2 border-card bg-stamp-subtle font-mono text-[0.65rem] font-semibold text-stamp">
              {initials}
              <span data-rest={index === 0 ? "" : undefined} className="home-cycle-3 absolute -inset-1 rounded-full border-2 border-stamp" style={at(index)} />
            </span>
          ))}
        </div>
        <div className="grid text-[0.65rem] font-medium">
          {ROLES.map(({ role }, index) => (
            <span key={role} data-rest={index === 0 ? "" : undefined} className="home-cycle-3 col-start-1 row-start-1 text-center" style={at(index)}>
              {role}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
