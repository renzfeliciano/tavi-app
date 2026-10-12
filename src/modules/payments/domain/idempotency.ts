// A payment attempt's idempotency key: the browser makes one per "Record
// payment" attempt and sends it again on a retry, so a repeat (a network retry,
// a second tab) is answered with the first result instead of recording twice.
// Optional, so older callers and the API keep working.

const KEY = /^[A-Za-z0-9_-]{8,80}$/;

/** The trimmed key, null for none, or false when it isn't a usable key. */
export function parseIdempotencyKey(value: string | null | undefined): string | null | false {
  const key = value?.trim() ?? "";
  if (key === "") return null;
  return KEY.test(key) ? key : false;
}
