import { describe, expect, it } from "vitest";
import { DOCUMENT_EMAIL_LIMIT, documentEmailLimitMessage } from "./document-email-limit";

describe("document email limit", () => {
  it("is 50 emails per business per hour (founder, 2026-10-02)", () => {
    expect(DOCUMENT_EMAIL_LIMIT).toEqual({ windowSeconds: 3600, max: 50 });
  });

  it("explains the limit from its own numbers and offers the link instead", () => {
    expect(documentEmailLimitMessage()).toBe(
      "You've reached the limit of 50 emails in 1 hour. Copy the link instead, or try again later.",
    );
    expect(documentEmailLimitMessage("Record it without emailing the acknowledgement")).toBe(
      "You've reached the limit of 50 emails in 1 hour. Record it without emailing the acknowledgement, or try again later.",
    );
  });
});
