import { describe, expect, it } from "vitest";
import { closedAccountEmail } from "./account-closure";

describe("closedAccountEmail", () => {
  it("is unique per account and can never receive mail", () => {
    const a = closedAccountEmail("0199a0a0-0000-7000-8000-000000000001");
    const b = closedAccountEmail("0199a0a0-0000-7000-8000-000000000002");
    expect(a).not.toBe(b);
    expect(a).toMatch(/@closed\.invalid$/);
  });
});
