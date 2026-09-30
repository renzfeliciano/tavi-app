// Structured logging (docs/foundation-proposal.md §K). One JSON line per event
// in production (for the hosting platform's log search), readable lines in
// development. Secrets never reach a log line: sensitive keys are masked and
// credentials are scrubbed out of any string, including error messages.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|signature/i;
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const REDACTED = "[redacted]";

function scrub(value: string): string {
  return value.replace(URL_CREDENTIALS, `$1${REDACTED}@`);
}

/** Deep copy with sensitive keys masked and credentials scrubbed. */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return scrub(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrub(value.message),
      ...(value.stack ? { stack: scrub(value.stack) } : {}),
      ...("code" in value ? { code: (value as { code: unknown }).code } : {}),
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(inner, seen);
  }
  return out;
}

export type Logger = {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** A logger that adds `context` (request ID, organization, …) to every line. */
  child(context: LogFields): Logger;
};

type LoggerOptions = {
  format?: "json" | "pretty";
  level?: LogLevel;
  write?: (line: string, level: LogLevel) => void;
  now?: () => Date;
  context?: LogFields;
};

const defaultWrite = (line: string, level: LogLevel) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export function createLogger(options: LoggerOptions = {}): Logger {
  const format = options.format ?? "json";
  const minimum = LEVEL_ORDER[options.level ?? "debug"];
  const write = options.write ?? defaultWrite;
  const now = options.now ?? (() => new Date());
  const context = options.context ?? {};

  const emit = (level: LogLevel, msg: string, fields: LogFields = {}) => {
    if (LEVEL_ORDER[level] < minimum) return;
    const data = redact({ ...context, ...fields }) as LogFields;
    if (format === "json") {
      write(JSON.stringify({ level, msg: scrub(msg), time: now().toISOString(), ...data }), level);
      return;
    }
    const extra = Object.keys(data).length ? ` ${JSON.stringify(data)}` : "";
    write(`${level.toUpperCase().padEnd(5)} ${scrub(msg)}${extra}`, level);
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (extra) => createLogger({ ...options, context: { ...context, ...extra } }),
  };
}

/** The app's logger: JSON in production, readable in development, quiet in tests. */
export const logger: Logger = createLogger({
  format: process.env.NODE_ENV === "production" ? "json" : "pretty",
  level: process.env.NODE_ENV === "test" ? "warn" : process.env.NODE_ENV === "production" ? "info" : "debug",
});
