import { describe, expect, it } from "vitest";
import {
  DOCUMENT_EMAIL_LIMIT,
  documentEmailLimitMessage,
  GLOBAL_EMAIL_LIMIT,
  PERSON_EMAIL_LIMIT,
} from "./document-email-limit";

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

// Security review, October 2026: one person can own several businesses, and the
// free Gmail account has one shared quota, so the per-business cap alone does
// not stop bursts. A person's cap spans their businesses; a global cap spans
// everyone. They are ordered so each outer cap is wider than the one inside it.
describe("person and global email limits", () => {
  it("are wider than one business's limit, and the global one is widest", () => {
    expect(PERSON_EMAIL_LIMIT.windowSeconds).toBe(DOCUMENT_EMAIL_LIMIT.windowSeconds);
    expect(GLOBAL_EMAIL_LIMIT.windowSeconds).toBe(DOCUMENT_EMAIL_LIMIT.windowSeconds);
    expect(PERSON_EMAIL_LIMIT.max).toBeGreaterThan(DOCUMENT_EMAIL_LIMIT.max);
    expect(GLOBAL_EMAIL_LIMIT.max).toBeGreaterThan(PERSON_EMAIL_LIMIT.max);
  });

  it("tells a person who hit their own cap that it covers all their businesses", () => {
    expect(documentEmailLimitMessage("Copy the link instead", "person")).toBe(
      `You've reached the limit of ${PERSON_EMAIL_LIMIT.max} emails in 1 hour across your businesses. Copy the link instead, or try again later.`,
    );
  });

  it("tells everyone, when Tavi as a whole is busy, that it is not their fault", () => {
    expect(documentEmailLimitMessage("Copy the link instead", "global")).toBe(
      "Tavi is sending a lot of email right now. Copy the link instead, or try again in a little while.",
    );
  });
});
