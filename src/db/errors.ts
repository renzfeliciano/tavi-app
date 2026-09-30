// Postgres errors surface from Drizzle wrapped, with the driver error in `cause`.

type PgError = { code?: string; constraint?: string };

function pgError(error: unknown): PgError | undefined {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if (typeof (e as PgError).code === "string") return e as PgError;
  }
  return undefined;
}

/** True for a unique violation (23505), optionally on one named constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgError(error);
  return pg?.code === "23505" && (constraint === undefined || pg.constraint === constraint);
}
