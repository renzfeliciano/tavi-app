// Backup restore drill (proposal §I "Data loss", tavi-ops "Restore drill").
// Takes a fingerprint of every table, so a database restored from Neon's
// history can be proven to hold exactly the rows it held at that moment.
//
//   RESTORE_CHECK_URL=<production, direct> npm run db:restore-check -- save drill.json
//   RESTORE_CHECK_URL=<restored branch>    npm run db:restore-check -- check drill.json
// Procedure: docs/runbooks/restore-drill.md.
//
// Self-contained (only `pg` and Node), so it runs with Node's type stripping
// and no app environment. It only reads; it never prints row contents.
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

export type Snapshot = { takenAt: string; tables: Record<string, { rows: number; fingerprint: string }> };

/** Tables written by background work or sign-ins at any moment; they can't be compared to a point in time. */
const VOLATILE = new Set(["request_limits", "rate_limits", "sessions", "verifications"]);

type Queryable = { query: <R extends pg.QueryResultRow>(text: string) => Promise<{ rows: R[] }> };

/** Row count and a content hash (md5 of every row, in a stable order) for each table in `public`. */
export async function takeSnapshot(client: Queryable): Promise<Snapshot> {
  const takenAt = new Date().toISOString();
  const { rows: tables } = await client.query<{ name: string }>(
    "select tablename as name from pg_tables where schemaname = 'public' order by tablename",
  );
  const snapshot: Snapshot = { takenAt, tables: {} };
  for (const { name } of tables) {
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const { rows } = await client.query<{ rows: number; fingerprint: string }>(
      `select count(*)::int as rows, md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as fingerprint from public.${quoted} t`,
    );
    snapshot.tables[name] = rows[0] ?? { rows: 0, fingerprint: "" };
  }
  return snapshot;
}

/** Differences between the database before and after a restore, one line per table; empty means identical. */
export function compareSnapshots(before: Snapshot, restored: Snapshot): string[] {
  const problems: string[] = [];
  for (const name of Object.keys(before.tables).sort()) {
    if (VOLATILE.has(name)) continue;
    const a = before.tables[name]!;
    const b = restored.tables[name];
    if (!b) problems.push(`${name}: missing from the restored database`);
    else if (a.rows !== b.rows) problems.push(`${name}: ${a.rows} rows before, ${b.rows} restored`);
    else if (a.fingerprint !== b.fingerprint) problems.push(`${name}: same row count (${a.rows}) but different rows`);
  }
  return problems;
}

async function main(command: string | undefined, file: string | undefined) {
  const url = process.env.RESTORE_CHECK_URL;
  if (!url || !file || (command !== "save" && command !== "check")) {
    console.error("Usage: RESTORE_CHECK_URL=… npm run db:restore-check -- save|check <file.json>");
    process.exit(2);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const snapshot = await takeSnapshot(client);
    const tableCount = Object.keys(snapshot.tables).length;
    if (command === "save") {
      writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
      console.log(`Saved ${tableCount} tables at ${snapshot.takenAt}. Restore to a moment after this, before any new change.`);
      return;
    }
    const before = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
    const problems = compareSnapshots(before, snapshot);
    if (problems.length === 0) {
      console.log(`Restore verified: ${tableCount} tables match the snapshot from ${before.takenAt}.`);
    } else {
      console.error(`Restore does NOT match the snapshot from ${before.takenAt}:\n- ${problems.join("\n- ")}`);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("restore-check.ts")) {
  await main(process.argv[2], process.argv[3]);
}
