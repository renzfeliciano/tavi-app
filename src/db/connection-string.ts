/**
 * pg treats sslmode=prefer/require/verify-ca as verify-full and warns on every
 * connection that this will change in pg v9. Saying verify-full explicitly
 * keeps today's (strictest) behaviour and silences the warning. A string that
 * opts into libpq semantics (uselibpqcompat) is left as written.
 */
export function withExplicitSslMode(connectionString: string): string {
  if (/[?&]uselibpqcompat=true/.test(connectionString)) return connectionString;
  return connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/, "$1verify-full");
}
