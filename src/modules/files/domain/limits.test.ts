import { describe, expect, it } from "vitest";
import { UPLOAD_MESSAGES } from "./limits";

describe("upload messages", () => {
  it("describe the configured formats and size", () => {
    expect(UPLOAD_MESSAGES.wrongType).toBe("Upload a PNG, JPG or WebP image.");
    expect(UPLOAD_MESSAGES.tooLarge).toBe("That image is over 2 MB. Try a smaller one.");
  });
});
