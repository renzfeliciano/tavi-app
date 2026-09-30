import { expect, test } from "@playwright/test";

test.describe("platform endpoints", () => {
  test("liveness answers without touching the database", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("readiness confirms the database is reachable", async ({ request }) => {
    const response = await request.get("/api/health/ready");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("the outbox cron refuses requests without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/outbox")).status()).toBe(401);
    const wrong = await request.get("/api/cron/outbox", { headers: { Authorization: "Bearer nope" } });
    expect(wrong.status()).toBe(401);
  });
});
