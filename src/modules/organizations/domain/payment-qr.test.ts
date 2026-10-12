import { describe, expect, it } from "vitest";
import { classifyQrValue, emvCrcValid, PAYMENT_QR_LIMITS, parsePaymentQrs } from "./payment-qr";

// A real-shaped static merchant QR (EMVCo, as QR Ph uses): tag 63 is the CRC.
function withCrc(body: string): string {
  let crc = 0xffff;
  const text = `${body}6304`;
  for (const ch of text) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return `${text}${crc.toString(16).toUpperCase().padStart(4, "0")}`;
}
const EMV = withCrc("00020101021127260012com.p2pqrpay0106GCASH5204601653036085909JUAN DELA6006MANILA");

describe("emvCrcValid", () => {
  it("accepts a payload whose CRC matches and rejects a changed one", () => {
    expect(emvCrcValid(EMV)).toBe(true);
    expect(emvCrcValid(EMV.replace("JUAN", "JOAN"))).toBe(false);
    expect(emvCrcValid(EMV.slice(0, -1))).toBe(false);
  });
});

describe("classifyQrValue", () => {
  it("tells links, QR Ph payloads and other text apart", () => {
    expect(classifyQrValue("https://pay.maya.ph/x")).toBe("link");
    expect(classifyQrValue(EMV)).toBe("payload");
    expect(classifyQrValue("0917 123 4567")).toBe("text");
  });
});

describe("parsePaymentQrs", () => {
  it("keeps a labelled link and a labelled payload, trimmed, in order", () => {
    const result = parsePaymentQrs([
      { label: "  GCash ", value: ` ${EMV}\n`, enabled: true },
      { label: "Maya", value: "https://pay.maya.ph/juan", enabled: false },
    ]);
    expect(result).toEqual({
      ok: true,
      qrs: [
        { label: "GCash", value: EMV, enabled: true },
        { label: "Maya", value: "https://pay.maya.ph/juan", enabled: false },
      ],
    });
  });

  it("ignores rows left completely blank", () => {
    expect(parsePaymentQrs([{ label: "", value: "  " }])).toEqual({ ok: true, qrs: [] });
  });

  it("asks for a name and a value, naming the row", () => {
    const result = parsePaymentQrs([{ label: "", value: "https://x.example/p" }, { label: "Bank", value: "" }]);
    expect(result).toMatchObject({
      ok: false,
      errors: { "0.label": expect.stringMatching(/name/i), "1.value": expect.stringMatching(/link|code/i) },
    });
  });

  it("allows at most three", () => {
    const row = (n: number) => ({ label: `QR ${n}`, value: `https://x.example/${n}` });
    expect(parsePaymentQrs([1, 2, 3].map(row)).ok).toBe(true);
    expect(parsePaymentQrs([1, 2, 3, 4].map(row))).toMatchObject({ ok: false, errors: { form: expect.stringContaining("3") } });
    expect(PAYMENT_QR_LIMITS.count).toBe(3);
  });

  it("only takes https links, never scripts, other schemes or links with a login", () => {
    for (const bad of ["http://x.example/p", "javascript:alert(1)", "data:text/html,hi", "https://user:pw@x.example/p", "ftp://x.example/p"]) {
      expect(parsePaymentQrs([{ label: "X", value: bad }]), bad).toMatchObject({ ok: false, errors: { "0.value": expect.any(String) } });
    }
  });

  it("rejects a QR Ph payload that was copied wrongly (bad CRC)", () => {
    expect(parsePaymentQrs([{ label: "GCash", value: EMV.replace("JUAN", "JOAN") }])).toMatchObject({
      ok: false,
      errors: { "0.value": expect.stringMatching(/unreadable|copied|incomplete/i) },
    });
  });

  it("limits the label and the value", () => {
    expect(parsePaymentQrs([{ label: "x".repeat(PAYMENT_QR_LIMITS.label + 1), value: "https://x.example" }])).toMatchObject({
      ok: false,
      errors: { "0.label": expect.any(String) },
    });
    expect(parsePaymentQrs([{ label: "Long", value: `https://x.example/${"a".repeat(PAYMENT_QR_LIMITS.value)}` }])).toMatchObject({
      ok: false,
      errors: { "0.value": expect.any(String) },
    });
  });
});
