// Runs before `next build` on Vercel (see "vercel-build" in package.json).
// Production deploys apply pending migrations first, so the new code never
// meets an old schema. If a migration fails, the build fails and the previous
// deployment keeps serving. Preview and local builds are left alone.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, only production migrates)`);
  process.exit(0);
}
if (!process.env.DATABASE_URL_DIRECT && !process.env.DATABASE_URL) {
  console.error("[migrate] no DATABASE_URL_DIRECT or DATABASE_URL set for this production build");
  process.exit(1);
}

console.log("[migrate] applying pending migrations to production");
const result = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
