import "server-only";
import { parseEnv } from "./parse-env";

/** Validated server environment. Fails fast at startup if misconfigured. */
export const env = parseEnv(process.env);

export type { Env } from "./parse-env";
