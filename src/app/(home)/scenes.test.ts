import { describe, expect, it } from "vitest";
import { formatMoney } from "@/shared/money";
import { SAMPLE_DOWNPAYMENT_MINOR, SAMPLE_ITEMS, SAMPLE_TOTAL_MINOR } from "./sample-quotation";
import {
  CHANNELS,
  EMAIL_AT,
  EMAIL_LENGTH,
  EMAIL_STATIC,
  GAP,
  LENGTHS,
  LINK_AT,
  LINK_LENGTH,
  LINK_STATIC,
  PDF_AT,
  PDF_LENGTH,
  PDF_STATIC,
  MAKE_AT,
  MAKE_LENGTH,
  PAY_AT,
  PAY_LENGTH,
  PAY_STATIC,
  SEND_AT,
  SEND_LENGTH,
  SEND_STATIC,
  STARTS,
  TIMELINE_LENGTH,
  channelMood,
  emailScene,
  linkScene,
  locals,
  makeScene,
  makeTimeline,
  pdfScene,
  payScene,
  sendScene,
  stampMood,
  stepAt,
} from "./scenes";

// The three pictures under "From job to paid" play as little scenes, one tick
// at a time. These are pure: a tick in, a picture's state out. The finished
// frame of each is the picture the page shows when nothing moves.

const money = (minor: number) => formatMoney(minor, "PHP");

describe("makeScene: the quotation being filled in", () => {
  it("starts on an empty first row with the cursor in its name, and nothing else begun", () => {
    const scene = makeScene(0);

    expect(scene.rows[0]).toMatchObject({ started: true, name: "", amount: null, typing: "name" });
    expect(scene.rows[1]).toMatchObject({ started: false, name: "", amount: null, typing: null });
    expect(scene.rows[2]).toMatchObject({ started: false, typing: null });
    expect(scene.totalMinor).toBe(0);
  });

  it("types the name a letter at a time", () => {
    expect(makeScene(MAKE_AT[0]!.name + 5).rows[0]!.name).toBe("Appli");
    expect(makeScene(MAKE_AT[0]!.name + 5).rows[0]!.typing).toBe("name");
  });

  it("types the price in whole pesos, then sets it as money when the row is done", () => {
    const typing = makeScene(MAKE_AT[0]!.amount + 2).rows[0]!;
    expect(typing).toMatchObject({ amount: "₱24", typing: "amount", name: SAMPLE_ITEMS[0].name });

    const done = makeScene(MAKE_AT[0]!.commit).rows[0]!;
    expect(done).toMatchObject({ amount: money(SAMPLE_ITEMS[0].amountMinor), typing: null });
  });

  it("moves on to the next row as soon as the last is done", () => {
    const scene = makeScene(MAKE_AT[0]!.commit + 3);

    expect(scene.rows[1]).toMatchObject({ started: true, name: SAMPLE_ITEMS[1].name.slice(0, 3), typing: "name" });
  });

  it("counts the total up as each row is set, and never back down", () => {
    const row = SAMPLE_ITEMS[0].amountMinor;
    expect(makeScene(MAKE_AT[0]!.commit).totalMinor).toBe(0);
    const partway = makeScene(MAKE_AT[0]!.commit + 3).totalMinor;
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(row);
    expect(makeScene(MAKE_AT[0]!.commit + 12).totalMinor).toBe(row);

    let last = 0;
    for (let tick = 0; tick <= MAKE_LENGTH; tick++) {
      const total = makeScene(tick).totalMinor;
      expect(total, `tick ${tick}`).toBeGreaterThanOrEqual(last);
      last = total;
    }
  });

  it("ends on the sample quotation's own rows and total, with the cursor gone", () => {
    const scene = makeScene(MAKE_LENGTH);

    expect(scene.rows.map((row) => row.name)).toEqual(SAMPLE_ITEMS.map((item) => item.name));
    expect(scene.rows.map((row) => row.amount)).toEqual(SAMPLE_ITEMS.map((item) => money(item.amountMinor)));
    expect(scene.rows.every((row) => row.typing === null)).toBe(true);
    expect(scene.totalMinor).toBe(SAMPLE_TOTAL_MINOR);
  });
});

describe("sendScene: the quotation going out", () => {
  it("starts as a draft with nothing pressed and nothing said", () => {
    expect(sendScene(0)).toEqual({ status: "DRAFT", pressed: null, flying: false, copied: false, note: "none" });
  });

  it("presses Email it, then sends: the badge turns to Sent and an envelope leaves", () => {
    expect(sendScene(SEND_AT.emailPress)).toMatchObject({ status: "DRAFT", pressed: "email" });
    expect(sendScene(SEND_AT.sent)).toMatchObject({ status: "SENT", pressed: null, flying: true, note: "emailed" });
    expect(sendScene(SEND_AT.sent + 20).flying).toBe(false);
  });

  it("then presses Copy link, and the button says it is copied", () => {
    expect(sendScene(SEND_AT.copyPress)).toMatchObject({ status: "SENT", pressed: "copy", copied: false });
    expect(sendScene(SEND_AT.copied)).toMatchObject({ pressed: null, copied: true, note: "copied" });
  });

  it("rests, when nothing moves, on the sent quotation with its note and no envelope in the air", () => {
    expect(sendScene(SEND_STATIC)).toEqual({ status: "SENT", pressed: null, flying: false, copied: false, note: "emailed" });
    expect(SEND_STATIC).toBeLessThan(SEND_LENGTH);
  });
});

describe("payScene: the downpayment and the balance coming in", () => {
  it("starts unpaid, with the whole total owing and an empty amount box", () => {
    expect(payScene(0)).toMatchObject({ status: "SENT", payments: [], balanceMinor: SAMPLE_TOTAL_MINOR, paidStamp: false });
    expect(payScene(0).field).toEqual({ text: "", active: false });
  });

  it("types the first amount into the box, then records it as the downpayment", () => {
    const typing = payScene(PAY_AT.type1 + 2);
    expect(typing.field).toEqual({ text: "₱22", active: true });
    expect(typing.payments).toEqual([]);

    const recorded = payScene(PAY_AT.commit1);
    expect(recorded.payments).toEqual([{ label: "Downpayment", amountMinor: SAMPLE_DOWNPAYMENT_MINOR }]);
    expect(recorded.status).toBe("PARTIALLY_PAID");
    expect(recorded.field).toEqual({ text: "", active: false });
  });

  it("counts the balance down as each payment is recorded, and never back up", () => {
    let last = SAMPLE_TOTAL_MINOR;
    for (let tick = 0; tick <= PAY_LENGTH; tick++) {
      const { balanceMinor } = payScene(tick);
      expect(balanceMinor, `tick ${tick}`).toBeLessThanOrEqual(last);
      last = balanceMinor;
    }
  });

  it("rests, when nothing moves, on a partly paid billing statement: the downpayment in, the balance left", () => {
    const scene = payScene(PAY_STATIC);

    expect(scene.status).toBe("PARTIALLY_PAID");
    expect(scene.payments).toEqual([{ label: "Downpayment", amountMinor: SAMPLE_DOWNPAYMENT_MINOR }]);
    expect(scene.balanceMinor).toBe(SAMPLE_TOTAL_MINOR - SAMPLE_DOWNPAYMENT_MINOR);
    expect(scene.paidStamp).toBe(false);
  });

  it("ends with the second payment in, nothing owing, and the Paid stamp down", () => {
    const scene = payScene(PAY_LENGTH);

    expect(scene.status).toBe("PAID");
    expect(scene.payments.map((payment) => payment.amountMinor)).toEqual([SAMPLE_DOWNPAYMENT_MINOR, SAMPLE_TOTAL_MINOR - SAMPLE_DOWNPAYMENT_MINOR]);
    expect(scene.balanceMinor).toBe(0);
    expect(scene.paidStamp).toBe(true);
  });
});

describe("the timeline of the three scenes", () => {
  it("plays them one after another, with a gap for the Stamp to hop across", () => {
    expect(STARTS[0]).toBe(0);
    expect(STARTS[1]).toBe(MAKE_LENGTH + GAP);
    expect(STARTS[2]).toBe(STARTS[1] + SEND_LENGTH + GAP);
    expect(TIMELINE_LENGTH).toBeGreaterThan(STARTS[2] + PAY_LENGTH);
    expect(LENGTHS).toEqual([MAKE_LENGTH, SEND_LENGTH, PAY_LENGTH]);
  });

  it("starts with every picture at its first frame, and ends with every picture finished", () => {
    expect(locals(0)).toEqual([0, 0, 0]);
    expect(locals(TIMELINE_LENGTH)).toEqual([MAKE_LENGTH, SEND_LENGTH, PAY_LENGTH]);
  });

  it("leaves a picture waiting at its first frame until its turn, and finished after it", () => {
    const mid = locals(STARTS[1] + 10);

    expect(mid[0]).toBe(MAKE_LENGTH);
    expect(mid[1]).toBe(10);
    expect(mid[2]).toBe(0);
  });

  it("has the Stamp start hopping toward a step a little before it begins, and never go back", () => {
    expect(stepAt(0)).toBe(0);
    expect(stepAt(STARTS[1] - GAP - 1)).toBe(0);
    expect(stepAt(STARTS[1] - GAP)).toBe(1);
    expect(stepAt(STARTS[2] - GAP)).toBe(2);
    let last = 0;
    for (let tick = 0; tick <= TIMELINE_LENGTH; tick++) {
      expect(stepAt(tick)).toBeGreaterThanOrEqual(last);
      last = stepAt(tick);
    }
  });

  it("gives the Stamp a mood that follows what is happening: curious, then pleased, then celebrating", () => {
    expect(stampMood(0, 10)).toBe("curious");
    expect(stampMood(0, MAKE_LENGTH)).toBe("happy");
    expect(stampMood(1, 20)).toBe("happy");
    expect(stampMood(2, 3)).toBe("curious");
    expect(stampMood(2, PAY_AT.commit1)).toBe("happy");
    expect(stampMood(2, PAY_AT.commit2)).toBe("celebrating");
  });
});

describe("emailScene: the email a customer gets", () => {
  it("starts empty and fills in from the top: who it is from, what it says, then the button", () => {
    expect(emailScene(0)).toEqual({ header: false, body: false, button: false, pressed: false, opened: false });
    expect(emailScene(EMAIL_AT.header)).toMatchObject({ header: true, body: false, button: false });
    expect(emailScene(EMAIL_AT.body)).toMatchObject({ header: true, body: true, button: false });
    expect(emailScene(EMAIL_AT.button)).toMatchObject({ header: true, body: true, button: true, pressed: false });
  });

  it("has the button pressed, and then the quotation opened", () => {
    expect(emailScene(EMAIL_AT.press)).toMatchObject({ pressed: true, opened: false });
    expect(emailScene(EMAIL_AT.opened)).toMatchObject({ pressed: false, opened: true });
  });

  it("rests on the whole email, unpressed and unopened", () => {
    expect(emailScene(EMAIL_STATIC)).toEqual({ header: true, body: true, button: true, pressed: false, opened: false });
    expect(EMAIL_STATIC).toBeLessThan(EMAIL_LENGTH);
  });
});

describe("pdfScene: the page being made", () => {
  it("starts blank and draws its rows one at a time, then the QR code and the total", () => {
    expect(pdfScene(0)).toEqual({ lines: 0, qr: false, total: false, scanning: false, saved: false });
    expect(pdfScene(PDF_AT.lines[0]).lines).toBe(1);
    expect(pdfScene(PDF_AT.lines[2]).lines).toBe(3);
    expect(pdfScene(PDF_AT.qr).qr).toBe(true);
    expect(pdfScene(PDF_AT.total).total).toBe(true);
  });

  it("has the QR code scanned for a while, and then the page saved", () => {
    expect(pdfScene(PDF_AT.scanFrom - 1).scanning).toBe(false);
    expect(pdfScene(PDF_AT.scanFrom).scanning).toBe(true);
    expect(pdfScene(PDF_AT.scanTo).scanning).toBe(false);
    expect(pdfScene(PDF_AT.saved).saved).toBe(true);
  });

  it("rests on the finished page, not mid-scan and not yet saved", () => {
    expect(pdfScene(PDF_STATIC)).toEqual({ lines: 3, qr: true, total: true, scanning: false, saved: false });
    expect(PDF_STATIC).toBeLessThan(PDF_LENGTH);
  });
});

describe("linkScene: the customer's page", () => {
  it("starts with both buttons waiting", () => {
    expect(linkScene(0)).toEqual({ pressed: false, approved: false, told: false });
  });

  it("has Approve pressed, then approved, and then the business told", () => {
    expect(linkScene(LINK_AT.press)).toEqual({ pressed: true, approved: false, told: false });
    expect(linkScene(LINK_AT.approved)).toEqual({ pressed: false, approved: true, told: false });
    expect(linkScene(LINK_AT.told)).toEqual({ pressed: false, approved: true, told: true });
  });

  it("rests on the page as the customer first sees it", () => {
    expect(linkScene(LINK_STATIC)).toEqual({ pressed: false, approved: false, told: false });
    expect(LINK_STATIC).toBeLessThan(LINK_LENGTH);
  });
});

describe("the three ways to send, in turn", () => {
  it("builds the same timeline as the three steps do, from the same rules", () => {
    const built = makeTimeline(LENGTHS);

    expect(built.starts).toEqual([...STARTS]);
    expect(built.total).toBe(TIMELINE_LENGTH);
    expect(built.locals(0)).toEqual([0, 0, 0]);
    expect(built.stepAt(STARTS[2] - GAP)).toBe(2);
  });

  it("plays the email, then the PDF, then the link", () => {
    expect(CHANNELS.lengths).toEqual([EMAIL_LENGTH, PDF_LENGTH, LINK_LENGTH]);
    expect(CHANNELS.starts[1]).toBe(EMAIL_LENGTH + GAP);
    expect(CHANNELS.locals(CHANNELS.total)).toEqual([EMAIL_LENGTH, PDF_LENGTH, LINK_LENGTH]);
    expect(CHANNELS.stepAt(CHANNELS.starts[1]! - GAP)).toBe(1);
  });

  it("gives the Stamp a mood to match: pleased by the email, curious over the PDF, waiting on the link until it is approved", () => {
    expect(channelMood(0, 10)).toBe("happy");
    expect(channelMood(1, 10)).toBe("curious");
    expect(channelMood(1, PDF_AT.saved)).toBe("happy");
    expect(channelMood(2, 10)).toBe("waiting");
    expect(channelMood(2, LINK_AT.approved)).toBe("celebrating");
  });
});
