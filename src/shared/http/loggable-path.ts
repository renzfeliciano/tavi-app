import { PORTAL_PATH_PATTERNS } from "@/shared/security/headers";

// Paths as they may appear in our logs (§K). Customer links carry their token
// in the first segment after the portal prefix (/q/<token>, /i/<token>), and
// password resets carry theirs in the query string, so both are removed. The
// platform's own access logs still see full URLs; ours never add to that.

/** "/q/:path*" → "/q/" */
const PORTAL_PREFIXES = PORTAL_PATH_PATTERNS.map((pattern) => pattern.replace(/:path\*$/, ""));

/** The request path without its query string and with any customer-link token replaced by "[token]". */
export function loggablePath(path: string): string {
  const pathname = path.split("?")[0] ?? "";
  for (const prefix of PORTAL_PREFIXES) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) {
      const rest = pathname.slice(prefix.length);
      const slash = rest.indexOf("/");
      return `${prefix}[token]${slash === -1 ? "" : rest.slice(slash)}`;
    }
  }
  return pathname;
}
