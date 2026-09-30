import { describe, expect, it } from "vitest";
import { createLogger, redact } from "./logger";

describe("redact", () => {
  it("masks secret-looking keys at any depth", () => {
    const out = redact({
      user: { email: "maria@example.com", password: "hunter2hunter2" },
      headers: { authorization: "Bearer abc", cookie: "tavi.session_token=xyz" },
      token: "t",
      resetToken: "r",
      apiKey: "k",
      BETTER_AUTH_SECRET: "s",
      nested: [{ sessionToken: "n" }],
    });

    expect(out).toEqual({
      user: { email: "maria@example.com", password: "[redacted]" },
      headers: { authorization: "[redacted]", cookie: "[redacted]" },
      token: "[redacted]",
      resetToken: "[redacted]",
      apiKey: "[redacted]",
      BETTER_AUTH_SECRET: "[redacted]",
      nested: [{ sessionToken: "[redacted]" }],
    });
  });

  it("scrubs credentials out of connection strings inside any string", () => {
    const out = redact({ message: "connect failed: postgresql://tavi_owner:npg_secret@ep-x.neon.tech/tavi" });
    expect(out).toEqual({ message: "connect failed: postgresql://[redacted]@ep-x.neon.tech/tavi" });
  });

  it("keeps errors useful without their secrets", () => {
    const out = redact({ error: new Error("bad password for postgres://u:pw@host/db") }) as {
      error: { name: string; message: string; stack?: string };
    };
    expect(out.error.name).toBe("Error");
    expect(out.error.message).toBe("bad password for postgres://[redacted]@host/db");
    expect(out.error.stack).not.toContain(":pw@");
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(redact(a)).toEqual({ name: "a", self: "[circular]" });
  });
});

describe("createLogger", () => {
  it("writes one JSON line per event with level, message, time and fields", () => {
    const lines: string[] = [];
    const log = createLogger({ format: "json", write: (line) => lines.push(line), now: () => new Date("2026-09-30T00:00:00Z") });

    log.info("organization created", { organizationId: "org_1", token: "secret" });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      level: "info",
      msg: "organization created",
      time: "2026-09-30T00:00:00.000Z",
      organizationId: "org_1",
      token: "[redacted]",
    });
  });

  it("carries bound context (request id, org) on every line", () => {
    const lines: string[] = [];
    const log = createLogger({ format: "json", write: (line) => lines.push(line) }).child({ requestId: "req-1" });

    log.warn("slow query", { ms: 812 });

    expect(JSON.parse(lines[0]!)).toMatchObject({ level: "warn", requestId: "req-1", ms: 812 });
  });

  it("drops events below the configured level", () => {
    const lines: string[] = [];
    const log = createLogger({ format: "json", level: "warn", write: (line) => lines.push(line) });
    log.debug("noise");
    log.info("more noise");
    log.error("boom");
    expect(lines.map((l) => JSON.parse(l).msg)).toEqual(["boom"]);
  });
});
