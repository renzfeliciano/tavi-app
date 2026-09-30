/**
 * The visitor's IP for rate limiting (not for identity). Behind Vercel the
 * first `x-forwarded-for` entry is the client; without one, everyone shares
 * the "unknown" bucket, which errs on the side of limiting.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
