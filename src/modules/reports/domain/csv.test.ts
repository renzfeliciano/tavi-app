import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes rows with a byte-order mark and CRLF line ends, so spreadsheets read it as UTF-8", () => {
    expect(toCsv([["Number", "Total"], ["INV-000001", "1120.00"]])).toBe("\uFEFFNumber,Total\r\nINV-000001,1120.00\r\n");
  });

  it("quotes cells with commas, quotes or line breaks", () => {
    expect(toCsv([['Santos, "Aircon"', "line\nbreak", "cr\rhere"]])).toBe('\uFEFF"Santos, ""Aircon""","line\nbreak","cr\rhere"\r\n');
  });

  it("leaves empty cells empty", () => {
    expect(toCsv([[null, "", 0]])).toBe("\uFEFF,,0\r\n");
  });

  it("stops a spreadsheet from running a customer's text as a formula", () => {
    expect(toCsv([['=HYPERLINK("http://x")', "+63 917 123 4567", "-cmd", "@SUM(A1)", "\tTab"]])).toBe(
      `\uFEFF"'=HYPERLINK(""http://x"")",'+63 917 123 4567,'-cmd,'@SUM(A1),'\tTab\r\n`,
    );
  });

  it("leaves numbers alone, negative ones too", () => {
    expect(toCsv([["-12.50", -3, "12.50"]])).toBe("\uFEFF-12.50,-3,12.50\r\n");
  });

  it("keeps Filipino names and the peso sign", () => {
    expect(toCsv([["Peñaflor", "₱"]])).toBe("\uFEFFPeñaflor,₱\r\n");
  });
});
