import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { consumeRateLimit, pruneRateLimits } from "./rate-limit";

const rule = { windowSeconds: 60, max: 3 };
const t0 = new Date("2026-09-30T00:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("consumeRateLimit", () => {
  it("allows up to the limit, then blocks with a retry time", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit("portal:1.2.3.4", rule, testDb(), at(i)));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3]?.retryAfterSeconds).toBe(57);
  });

  it("starts a fresh window once the old one has passed", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("k", rule, testDb(), at(0));
    expect((await consumeRateLimit("k", rule, testDb(), at(59))).allowed).toBe(false);
    expect(await consumeRateLimit("k", rule, testDb(), at(60))).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
  });

  it("counts each key separately", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("a", rule, testDb(), at(0));
    expect((await consumeRateLimit("b", rule, testDb(), at(0))).allowed).toBe(true);
  });

  it("is exact under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimit("burst", { windowSeconds: 60, max: 10 }, testDb(), at(0))),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });
});

describe("pruneRateLimits", () => {
  it("removes counters whose window ended over a day ago", async () => {
    await consumeRateLimit("old", rule, testDb(), at(0));
    await consumeRateLimit("fresh", rule, testDb(), at(86_400));

    expect(await pruneRateLimits(testDb(), at(86_400 + 120))).toBe(1);
  });
});
