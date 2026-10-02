import { describe, expect, it } from "vitest";
import { teamInvitationEmail } from "./team-emails";

const input = {
  to: "ana@example.com",
  businessName: "Santos <Aircon>",
  inviterName: "Maria Santos",
  roleLabel: "Admin",
  url: "https://tavi.example/invite/abc",
  expiresIn: "7 days",
};

describe("teamInvitationEmail", () => {
  it("says who invited whom, to what, as what, with the link and its lifetime", () => {
    const email = teamInvitationEmail(input);
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Maria Santos invited you to Santos <Aircon> on Tavi");
    expect(email.text).toContain("as an admin.");
    expect(email.text).toContain("https://tavi.example/invite/abc");
    expect(email.text).toContain("7 days");
  });

  it("escapes the business name in HTML", () => {
    const html = teamInvitationEmail(input).html ?? "";
    expect(html).toContain("Santos &lt;Aircon&gt;");
    expect(html).not.toContain("<Aircon>");
  });

  it("uses 'a' before a consonant", () => {
    expect(teamInvitationEmail({ ...input, roleLabel: "Member" }).text).toContain("as a member.");
  });
});
