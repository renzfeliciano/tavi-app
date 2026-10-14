import { describe, expect, it } from "vitest";
import {
  certificateLabel,
  certificateTrashPayload,
  parseCertificateTrashPayload,
  parsePaymentTrashPayload,
  paymentTrashPayload,
} from "./trash-payload";

const uuid = "01a13ad5-b38e-7bda-a77a-f144a6c07cfc";
const payment = {
  invoiceId: uuid,
  amountMinor: 90_000,
  withheldMinor: 6_000,
  currency: "PHP",
  paidOn: "2026-09-15",
  method: "bank_transfer" as const,
  reference: null,
  institution: null,
  payerName: null,
  paidTime: null,
  chequeDate: null,
  notes: null,
  receiptNumber: "PAR-000001",
  provider: "manual",
  providerPaymentId: null,
  recordedBy: uuid,
  voidedAt: "2026-09-20T01:00:00.000Z",
  voidReason: "Entered twice",
  voidedBy: uuid,
  createdAt: "2026-09-15T01:00:00.000Z",
  updatedAt: "2026-09-20T01:00:00.000Z",
};

describe("the kept payment", () => {
  it("round-trips and keeps nothing it wasn't given a place for", () => {
    const kept = paymentTrashPayload({ ...payment, idempotencyKey: "secret-key" } as typeof payment);
    expect(kept).not.toHaveProperty("idempotencyKey");
    expect(parsePaymentTrashPayload(JSON.parse(JSON.stringify(kept)))).toEqual({ ok: true, payload: kept });
  });

  it("reads nothing it can't vouch for", () => {
    expect(parsePaymentTrashPayload({ v: 1 })).toEqual({ ok: false });
    expect(parsePaymentTrashPayload({ ...payment, v: 2 })).toEqual({ ok: false });
  });
});

describe("the kept 2307", () => {
  const certificate = {
    customerId: uuid,
    payorTin: "987-654-321-000",
    payorName: "Dela Cruz Trading",
    payorAddress: null,
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    receivedOn: "2026-10-01",
    currency: "PHP",
    notes: null,
    createdBy: uuid,
    voidedAt: "2026-10-02T01:00:00.000Z",
    voidReason: "Recorded twice",
    voidedBy: uuid,
    createdAt: "2026-10-01T01:00:00.000Z",
    updatedAt: "2026-10-02T01:00:00.000Z",
    lines: [
      { position: 1, atcCode: "WI160", description: "Services", rateBps: 200, month1Minor: 0, month2Minor: 300_000, month3Minor: 0, totalMinor: 300_000, taxWithheldMinor: 6_000 },
    ],
  };

  it("round-trips, and needs between one and five rows", () => {
    const kept = certificateTrashPayload(certificate);
    expect(parseCertificateTrashPayload(JSON.parse(JSON.stringify(kept)))).toEqual({ ok: true, payload: kept });
    expect(parseCertificateTrashPayload({ ...kept, lines: [] })).toEqual({ ok: false });
  });

  it("is named by who withheld and the quarter", () => {
    expect(certificateLabel("Dela Cruz Trading", "2026-07-01")).toBe("Dela Cruz Trading, Q3 2026");
    expect(certificateLabel("Acme", "2027-01-01")).toBe("Acme, Q1 2027");
  });
});
