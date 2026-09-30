import { describe, expect, it } from "vitest";
import { isClientAbort } from "./client-abort";

describe("isClientAbort", () => {
  it("recognises a response the browser stopped reading", () => {
    expect(isClientAbort(new Error("The destination stream closed early."))).toBe(true);
    expect(isClientAbort(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true);
    expect(isClientAbort(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))).toBe(true);
  });

  it("leaves real errors alone", () => {
    expect(isClientAbort(new Error("relation \"quotes\" does not exist"))).toBe(false);
    expect(isClientAbort("boom")).toBe(false);
    expect(isClientAbort(undefined)).toBe(false);
  });
});
