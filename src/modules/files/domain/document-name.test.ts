import { describe, expect, it } from "vitest";
import { cleanFileName } from "./document-name";

describe("cleanFileName", () => {
  it("keeps an ordinary name", () => {
    expect(cleanFileName("COR 2303.pdf", "x")).toBe("COR 2303.pdf");
  });

  it("drops folders, control characters and quotes", () => {
    expect(cleanFileName("C:\\Users\\me\\Docs\\cor.pdf", "x")).toBe("cor.pdf");
    expect(cleanFileName("../../etc/passwd", "x")).toBe("passwd");
    expect(cleanFileName('a"b\r\nc.pdf', "x")).toBe("abc.pdf");
  });

  it("falls back when nothing is left", () => {
    expect(cleanFileName("", "document")).toBe("document");
    expect(cleanFileName("...", "document")).toBe("document");
    expect(cleanFileName("///", "document")).toBe("document");
  });

  it("shortens a long name but keeps its extension", () => {
    const result = cleanFileName(`${"a".repeat(300)}.pdf`, "x");
    expect(result.length).toBe(120);
    expect(result.endsWith(".pdf")).toBe(true);
  });
});
