import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeTestDb, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { createMemorySender, setEmailSender } from "@/modules/notifications";
import { accounts, sessions, users } from "../schema";
import { createAuth } from "./create-auth";

const mail = createMemorySender();
setEmailSender(mail.sender);

const auth = createAuth(testDb(), {
  baseURL: "http://localhost:3200",
  secret: "test-secret-that-is-at-least-32-characters-long",
  rateLimit: false,
  checkBreachedPasswords: false,
});

const password = "correct horse battery staple";

async function signUp(email = "maria@example.com") {
  return auth.api.signUpEmail({ body: { name: "Maria Santos", email, password } });
}

beforeEach(async () => {
  await resetTables();
  mail.sent.length = 0;
});

afterAll(async () => {
  await closeTestDb();
});

describe("sign-up", () => {
  it("creates the user with a database UUIDv7 id and signs them in", async () => {
    const result = await signUp("Maria@Example.com");

    expect(result.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(result.user.email).toBe("maria@example.com");
    expect(result.user.emailVerified).toBe(false);
    expect(result.token).toBeTruthy();

    const userSessions = await testDb().select().from(sessions).where(eq(sessions.userId, result.user.id));
    expect(userSessions).toHaveLength(1);
  });

  it("stores a password hash, never the password", async () => {
    const { user } = await signUp();
    const [account] = await testDb().select().from(accounts).where(eq(accounts.userId, user.id));
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(password);
  });

  it("sends a verification email with a link", async () => {
    await signUp();
    await vi.waitFor(() => expect(mail.sent).toHaveLength(1));
    expect(mail.sent[0]).toMatchObject({ to: "maria@example.com", subject: "Verify your email for Tavi" });
    expect(mail.sent[0]?.text).toContain("http://localhost:3200/api/auth/verify-email?token=");
  });

  it("rejects passwords shorter than 12 characters", async () => {
    await expect(
      auth.api.signUpEmail({ body: { name: "Maria", email: "m@example.com", password: "short-pass" } }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });
  });

  it("rejects a second account with the same email", async () => {
    await signUp();
    await expect(signUp()).rejects.toMatchObject({ statusCode: 422 });
    expect(await testDb().select().from(users)).toHaveLength(1);
  });
});

describe("sign-in", () => {
  it("accepts the right password", async () => {
    await signUp();
    const result = await auth.api.signInEmail({ body: { email: "maria@example.com", password } });
    expect(result.token).toBeTruthy();
  });

  it("rejects a wrong password with a generic error", async () => {
    await signUp();
    await expect(
      auth.api.signInEmail({ body: { email: "maria@example.com", password: "not the password at all" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("gives the same error for an unknown email (no account enumeration)", async () => {
    await expect(
      auth.api.signInEmail({ body: { email: "nobody@example.com", password } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });
});

describe("password reset", () => {
  it("emails a single-use link, sets the new password and signs out every session", async () => {
    const { user } = await signUp();
    await auth.api.signInEmail({ body: { email: "maria@example.com", password } });
    await vi.waitFor(() => expect(mail.sent).toHaveLength(1)); // verification email
    mail.sent.length = 0;

    await auth.api.requestPasswordReset({
      body: { email: "maria@example.com", redirectTo: "http://localhost:3200/reset-password" },
    });
    await vi.waitFor(() => expect(mail.sent).toHaveLength(1));
    const link = mail.sent[0]?.text.match(/http:\/\/localhost:3200\/api\/auth\/reset-password\/([^?\s]+)/);
    const token = link?.[1];
    expect(token).toBeTruthy();

    const newPassword = "a brand new passphrase";
    await auth.api.resetPassword({ body: { token: token!, newPassword } });

    expect(await testDb().select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    await expect(
      auth.api.signInEmail({ body: { email: "maria@example.com", password } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    await expect(
      auth.api.signInEmail({ body: { email: "maria@example.com", password: newPassword } }),
    ).resolves.toMatchObject({ token: expect.any(String) });

    // The link works once.
    await expect(auth.api.resetPassword({ body: { token: token!, newPassword: "yet another passphrase" } })).rejects.toThrow();
  });

  it("answers the same way for an email with no account", async () => {
    await expect(
      auth.api.requestPasswordReset({ body: { email: "nobody@example.com", redirectTo: "http://localhost:3200/reset-password" } }),
    ).resolves.toMatchObject({ status: true });
    await new Promise((r) => setTimeout(r, 100));
    expect(mail.sent).toHaveLength(0);
  });
});

describe("audit trail", () => {
  const actions = async () => (await listAllAuditEvents()).map((e) => e.action);

  it("records sign-up and the first sign-in", async () => {
    const { user } = await signUp();
    const rows = await listAllAuditEvents();
    expect(rows.map((r) => r.action).sort()).toEqual(["auth.signed_in", "auth.signed_up"]);
    expect(rows.every((r) => r.actorId === user.id && r.actorType === "user")).toBe(true);
  });

  it("records password resets", async () => {
    await signUp();
    await vi.waitFor(() => expect(mail.sent).toHaveLength(1));
    mail.sent.length = 0;
    await auth.api.requestPasswordReset({
      body: { email: "maria@example.com", redirectTo: "http://localhost:3200/reset-password" },
    });
    await vi.waitFor(() => expect(mail.sent).toHaveLength(1));
    const token = mail.sent[0]?.text.match(/reset-password\/([^?\s]+)/)?.[1];
    await auth.api.resetPassword({ body: { token: token!, newPassword: "a brand new passphrase" } });

    expect(await actions()).toContain("auth.password_reset");
  });
});
