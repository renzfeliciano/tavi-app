import { describe, expect, it } from "vitest";
import { eg } from "./example";

describe("eg", () => {
  it("writes an example the way an empty field shows it", () => {
    expect(eg("0917 123 4567")).toBe("e.g. 0917 123 4567");
  });

  it("leaves what the example says as it is", () => {
    expect(eg("12")).toBe("e.g. 12");
    expect(eg("₱1,500.00")).toBe("e.g. ₱1,500.00");
  });
});
