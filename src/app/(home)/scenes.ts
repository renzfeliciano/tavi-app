import type { MascotExpression } from "@/components/brand/brand-mascot";
import { formatMoney } from "@/shared/money";
import { SAMPLE_ITEMS, SAMPLE_TOTAL_MINOR } from "./sample-quotation";

// The little pictures on the home page play as scenes, one tick at a time
// (TICK_MS apart). Under "From job to paid in three steps": the quotation being
// filled in, sent, and paid. Under "Send it the way your customers read it": the
// email arriving and being opened, the PDF drawn and scanned, and the customer's
// page approved. Each scene is a pure function from a tick to the state of its
// picture, so the picture is just that state drawn. The last frame of a scene
// (or the STATIC one, for those that loop on) is the picture the page shows when
// nothing moves. Made-up people and figures only.

export const TICK_MS = 50;

const money = (minor: number) => formatMoney(minor, "PHP");
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
/** A quick start that settles: how far through a count-up we are, 0 to 1. */
const settle = (progress: number) => 1 - (1 - clamp(progress, 0, 1)) ** 3;

// ---- Step 1: the quotation being filled in -------------------------------

const NAME_PAUSE = 3;
const AMOUNT_PAUSE = 2;
const COUNT = 6;

export type MakeTiming = { name: number; amount: number; commit: number; digits: string };

/** When, in ticks, each row starts its name, starts its price, and is set. */
export const MAKE_AT: readonly MakeTiming[] = (() => {
  let at = 0;
  return SAMPLE_ITEMS.map((item) => {
    const digits = String(item.amountMinor / 100);
    const name = at;
    const amount = name + item.name.length + NAME_PAUSE;
    const commit = amount + digits.length + AMOUNT_PAUSE;
    at = commit;
    return { name, amount, commit, digits };
  });
})();

export const MAKE_LENGTH = MAKE_AT[MAKE_AT.length - 1]!.commit + COUNT;

export type MakeRow = {
  /** Its name has begun to be typed (or a row ahead of it is still waiting). */
  started: boolean;
  name: string;
  /** What is in the price box: null before it, digits while typing, money once set. */
  amount: string | null;
  /** Where the cursor is, if it is in this row. */
  typing: "name" | "amount" | null;
};

export function makeScene(tick: number): { rows: MakeRow[]; totalMinor: number } {
  const rows = SAMPLE_ITEMS.map((item, index): MakeRow => {
    const at = MAKE_AT[index]!;
    const name = item.name.slice(0, clamp(tick - at.name, 0, item.name.length));
    const typedDigits = at.digits.slice(0, clamp(tick - at.amount, 0, at.digits.length));
    const amount = tick >= at.commit ? money(item.amountMinor) : tick >= at.amount ? `₱${typedDigits}` : null;
    const typing = tick >= at.commit ? null : tick >= at.amount ? "amount" : tick >= at.name ? "name" : null;
    return { started: tick >= at.name, name, amount, typing };
  });
  const totalMinor = Math.round(SAMPLE_ITEMS.reduce((sum, item, index) => sum + item.amountMinor * settle((tick - MAKE_AT[index]!.commit) / COUNT), 0));
  return { rows, totalMinor };
}

// ---- Step 2: the quotation going out -------------------------------------

export const SEND_AT = { emailPress: 12, sent: 17, copyPress: 46, copied: 51 } as const;
const ENVELOPE_TICKS = 10;
export const SEND_LENGTH = 86;
/** The sent quotation, its note in place and no envelope in the air. */
export const SEND_STATIC = 40;

export type SendState = {
  status: "DRAFT" | "SENT";
  pressed: "email" | "copy" | null;
  flying: boolean;
  copied: boolean;
  note: "none" | "emailed" | "copied";
};

export function sendScene(tick: number): SendState {
  const pressed = tick >= SEND_AT.emailPress && tick < SEND_AT.sent ? "email" : tick >= SEND_AT.copyPress && tick < SEND_AT.copied ? "copy" : null;
  return {
    status: tick >= SEND_AT.sent ? "SENT" : "DRAFT",
    pressed,
    flying: tick >= SEND_AT.sent && tick < SEND_AT.sent + ENVELOPE_TICKS,
    copied: tick >= SEND_AT.copied,
    note: tick >= SEND_AT.copied ? "copied" : tick >= SEND_AT.sent ? "emailed" : "none",
  };
}

// ---- Step 3: the downpayment and the balance coming in -------------------

export const PAY_AT = { type1: 9, press1: 16, commit1: 19, type2: 41, press2: 48, commit2: 51 } as const;
const PAY_COUNT = 7;
const DOWNPAYMENT_DIGITS = String(SAMPLE_TOTAL_MINOR / 2 / 100);
const BALANCE_DIGITS = String((SAMPLE_TOTAL_MINOR - SAMPLE_TOTAL_MINOR / 2) / 100);
export const PAY_LENGTH = 86;
/** Partly paid: the downpayment in and the balance still owing. */
export const PAY_STATIC = 32;

export type PayState = {
  status: "SENT" | "PARTIALLY_PAID" | "PAID";
  payments: { label: string; amountMinor: number }[];
  balanceMinor: number;
  /** The amount box: what is typed in it, and whether the cursor is in it. */
  field: { text: string; active: boolean };
  /** The Record button is being pressed. */
  pressed: boolean;
  paidStamp: boolean;
};

export function payScene(tick: number): PayState {
  const first = SAMPLE_TOTAL_MINOR / 2;
  const second = SAMPLE_TOTAL_MINOR - first;
  const typed = (digits: string, from: number) => digits.slice(0, clamp(tick - from, 0, digits.length));
  const inFirst = tick >= PAY_AT.type1 - 2 && tick < PAY_AT.commit1;
  const inSecond = tick >= PAY_AT.type2 - 2 && tick < PAY_AT.commit2;
  const digits = inFirst ? typed(DOWNPAYMENT_DIGITS, PAY_AT.type1) : inSecond ? typed(BALANCE_DIGITS, PAY_AT.type2) : "";

  const payments: PayState["payments"] = [];
  if (tick >= PAY_AT.commit1) payments.push({ label: "Downpayment", amountMinor: first });
  if (tick >= PAY_AT.commit2) payments.push({ label: "Final payment", amountMinor: second });

  return {
    status: tick >= PAY_AT.commit2 ? "PAID" : tick >= PAY_AT.commit1 ? "PARTIALLY_PAID" : "SENT",
    payments,
    balanceMinor: Math.round(SAMPLE_TOTAL_MINOR - first * settle((tick - PAY_AT.commit1) / PAY_COUNT) - second * settle((tick - PAY_AT.commit2) / PAY_COUNT)),
    field: { text: digits ? `₱${digits}` : "", active: inFirst || inSecond },
    pressed: (tick >= PAY_AT.press1 && tick < PAY_AT.commit1) || (tick >= PAY_AT.press2 && tick < PAY_AT.commit2),
    paidStamp: tick >= PAY_AT.commit2 + 2,
  };
}

// ---- Sending: the email, the PDF, the customer's page -------------------

export const EMAIL_AT = { header: 4, body: 12, button: 20, press: 44, opened: 50 } as const;
export const EMAIL_LENGTH = 76;
/** The whole email, its button waiting to be pressed. */
export const EMAIL_STATIC = 36;

export type EmailState = { header: boolean; body: boolean; button: boolean; pressed: boolean; opened: boolean };

/** The email a customer gets: who it is from, what it says, then the button, which they press and the quotation opens. */
export function emailScene(tick: number): EmailState {
  return {
    header: tick >= EMAIL_AT.header,
    body: tick >= EMAIL_AT.body,
    button: tick >= EMAIL_AT.button,
    pressed: tick >= EMAIL_AT.press && tick < EMAIL_AT.opened,
    opened: tick >= EMAIL_AT.opened,
  };
}

export const PDF_AT = { lines: [6, 11, 16], qr: 22, total: 28, scanFrom: 34, scanTo: 54, saved: 58 } as const;
export const PDF_LENGTH = 76;
/** The finished page, before anyone scans it. */
export const PDF_STATIC = 32;

export type PdfState = { lines: number; qr: boolean; total: boolean; scanning: boolean; saved: boolean };

/** A page being made: its rows, the payment QR code and the total, then the code scanned and the page saved. */
export function pdfScene(tick: number): PdfState {
  return {
    lines: PDF_AT.lines.filter((at) => tick >= at).length,
    qr: tick >= PDF_AT.qr,
    total: tick >= PDF_AT.total,
    scanning: tick >= PDF_AT.scanFrom && tick < PDF_AT.scanTo,
    saved: tick >= PDF_AT.saved,
  };
}

export const LINK_AT = { press: 30, approved: 36, told: 52 } as const;
export const LINK_LENGTH = 80;
/** The page as the customer first sees it. */
export const LINK_STATIC = 20;

export type LinkState = { pressed: boolean; approved: boolean; told: boolean };

/** The customer's page: Approve is pressed, the page says it is approved, and the business is told. */
export function linkScene(tick: number): LinkState {
  return {
    pressed: tick >= LINK_AT.press && tick < LINK_AT.approved,
    approved: tick >= LINK_AT.approved,
    told: tick >= LINK_AT.told,
  };
}

// ---- Scenes in turn -------------------------------------------------------

/** Ticks the Stamp takes to hop from one scene to the next. */
export const GAP = 14;
const HOLD = 50;

export type Timeline = {
  lengths: readonly number[];
  /** The tick each scene begins at. */
  starts: readonly number[];
  /** The tick the whole run ends at, after the last scene has held for a while. */
  total: number;
  /** Where each scene is at this tick: waiting at its first frame, playing, or finished. */
  locals: (tick: number) => number[];
  /** The scene the Stamp is on, or hopping toward. */
  stepAt: (tick: number) => number;
};

/** Scenes that play one after another, a GAP apart, and the whole run held at the end for `hold` ticks. */
export function makeTimeline(lengths: readonly number[], gap = GAP, hold = HOLD): Timeline {
  const starts: number[] = [];
  let at = 0;
  for (const length of lengths) {
    starts.push(at);
    at += length + gap;
  }
  const last = lengths.length - 1;
  return {
    lengths,
    starts,
    total: starts[last]! + lengths[last]! + hold,
    locals: (tick) => lengths.map((length, i) => clamp(tick - starts[i]!, 0, length)),
    stepAt: (tick) => starts.reduce((step, start, i) => (i > 0 && tick >= start - gap ? i : step), 0),
  };
}

// ---- The three steps in turn ----------------------------------------------

export const LENGTHS = [MAKE_LENGTH, SEND_LENGTH, PAY_LENGTH] as const;
export const STEPS = makeTimeline(LENGTHS);
export const STARTS = STEPS.starts as readonly [number, number, number];
export const TIMELINE_LENGTH = STEPS.total;

/** Where each of the three pictures is at this tick. */
export function locals(tick: number): [number, number, number] {
  return STEPS.locals(tick) as [number, number, number];
}

/** The step the Stamp is on, or hopping toward. */
export function stepAt(tick: number): 0 | 1 | 2 {
  return STEPS.stepAt(tick) as 0 | 1 | 2;
}

/** Curious while the quotation is being filled in, pleased once it is made and sent, celebrating when it is paid. */
export function stampMood(step: 0 | 1 | 2, local: number): MascotExpression {
  if (step === 0) return local >= MAKE_LENGTH - COUNT ? "happy" : "curious";
  if (step === 1) return "happy";
  return local >= PAY_AT.commit2 ? "celebrating" : local >= PAY_AT.commit1 ? "happy" : "curious";
}

// ---- The three ways to send, in turn --------------------------------------

export const CHANNELS = makeTimeline([EMAIL_LENGTH, PDF_LENGTH, LINK_LENGTH], GAP, 40);

/** Pleased by the email, curious over the PDF until it is saved, waiting on the customer until they approve. */
export function channelMood(step: number, local: number): MascotExpression {
  if (step === 0) return "happy";
  if (step === 1) return local >= PDF_AT.saved ? "happy" : "curious";
  return local >= LINK_AT.approved ? "celebrating" : "waiting";
}
