import { describe, expect, it } from "vitest";
import {
  DEFAULT_NUMBERING,
  DOCUMENT_KINDS,
  formatDocumentNumber,
} from "./numbering";

describe("formatDocumentNumber", () => {
  it("joins prefix and zero-padded value", () => {
    expect(formatDocumentNumber({ prefix: "QUO-", padding: 6 }, 124)).toBe(
      "QUO-000124",
    );
  });

  it("never truncates a value longer than the padding", () => {
    expect(formatDocumentNumber({ prefix: "INV-", padding: 3 }, 12_345)).toBe(
      "INV-12345",
    );
  });

  it("allows an empty prefix", () => {
    expect(formatDocumentNumber({ prefix: "", padding: 4 }, 7)).toBe("0007");
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects the invalid value %s", (value) => {
    expect(() => formatDocumentNumber({ prefix: "Q-", padding: 4 }, value)).toThrow(
      /positive integer/,
    );
  });
});

describe("DEFAULT_NUMBERING", () => {
  it("defines QUO-, INV- and REC- with six digits", () => {
    expect(DOCUMENT_KINDS).toEqual(["quote", "invoice", "receipt"]);
    expect(formatDocumentNumber(DEFAULT_NUMBERING.quote, 1)).toBe("QUO-000001");
    expect(formatDocumentNumber(DEFAULT_NUMBERING.invoice, 1)).toBe("INV-000001");
    expect(formatDocumentNumber(DEFAULT_NUMBERING.receipt, 1)).toBe("REC-000001");
  });
});
