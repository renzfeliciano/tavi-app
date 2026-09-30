/**
 * True when a request failed only because the browser went away mid-response
 * (the user navigated or closed the tab). That's routine, not a server bug.
 */
export function isClientAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    error.name === "AbortError" ||
    code === "ECONNRESET" ||
    error.message === "The destination stream closed early."
  );
}
