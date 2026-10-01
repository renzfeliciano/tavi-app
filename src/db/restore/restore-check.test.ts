import { describe, expect, it } from "vitest";
import { compareSnapshots, type Snapshot } from "./restore-check";

const snapshot = (tables: Snapshot["tables"]): Snapshot => ({ takenAt: "2026-10-02T01:00:00.000Z", tables });

describe("compareSnapshots", () => {
  it("passes when every table has the same rows", () => {
    const tables = { quotes: { rows: 3, fingerprint: "a" }, payments: { rows: 1, fingerprint: "b" } };
    expect(compareSnapshots(snapshot(tables), snapshot({ ...tables }))).toEqual([]);
  });

  it("names each table that is missing, lost rows or has different rows", () => {
    const before = snapshot({
      quotes: { rows: 3, fingerprint: "a" },
      invoices: { rows: 2, fingerprint: "b" },
      payments: { rows: 1, fingerprint: "c" },
    });
    const restored = snapshot({ quotes: { rows: 2, fingerprint: "x" }, invoices: { rows: 2, fingerprint: "z" } });
    expect(compareSnapshots(before, restored)).toEqual([
      "invoices: same row count (2) but different rows",
      "payments: missing from the restored database",
      "quotes: 3 rows before, 2 restored",
    ]);
  });

  it("ignores tables that only grow from background work (rate-limit counters)", () => {
    const before = snapshot({ request_limits: { rows: 5, fingerprint: "a" }, rate_limits: { rows: 1, fingerprint: "b" } });
    expect(compareSnapshots(before, snapshot({}))).toEqual([]);
  });
});
