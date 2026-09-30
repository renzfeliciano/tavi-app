import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load .env.local the way Next does.
loadEnvConfig(process.cwd());

// Migrations use the direct (non-pooled) connection; generating SQL needs none.
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  strict: true,
  verbose: true,
  ...(url ? { dbCredentials: { url } } : {}),
});
