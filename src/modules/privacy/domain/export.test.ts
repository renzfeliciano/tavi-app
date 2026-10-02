import { describe, expect, it } from "vitest";
import { attachLines, exportFileName, serializeExport } from "./export";

describe("exportFileName", () => {
  it("is plain ASCII with the date", () => {
    expect(exportFileName("2026-10-02")).toBe("tavi-export-2026-10-02.json");
  });
});

describe("attachLines", () => {
  const documents = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
  const lines = [
    { quoteId: "q2", position: 0 },
    { quoteId: "q1", position: 0 },
    { quoteId: "q2", position: 1 },
    { quoteId: "elsewhere", position: 0 },
  ];

  it("puts each document's lines on it, keeping their order", () => {
    expect(attachLines(documents, lines, (l) => l.quoteId)).toEqual([
      { id: "q1", lines: [{ quoteId: "q1", position: 0 }] },
      {
        id: "q2",
        lines: [
          { quoteId: "q2", position: 0 },
          { quoteId: "q2", position: 1 },
        ],
      },
      { id: "q3", lines: [] },
    ]);
  });

  it("doesn't change what it's given", () => {
    const before = structuredClone(documents);
    attachLines(documents, lines, (l) => l.quoteId);
    expect(documents).toEqual(before);
  });
});

describe("serializeExport", () => {
  it("writes dates as ISO text and bigints as text", () => {
    const json = serializeExport({ at: new Date("2026-10-02T01:02:03Z"), big: 12345678901234567890n });
    expect(JSON.parse(json)).toEqual({ at: "2026-10-02T01:02:03.000Z", big: "12345678901234567890" });
  });
});
