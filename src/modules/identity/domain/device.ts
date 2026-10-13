// A human label for a session's device ("Chrome on Windows"), for the
// signed-in devices list. Deliberately small: browser + platform only.

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** Real user agents run to a few hundred characters; the rest of a longer one is noise (or an attack on the patterns below). */
const MAX_USER_AGENT_LENGTH = 512;

export function describeDevice(rawUserAgent: string | null | undefined): string {
  if (!rawUserAgent) return "Unknown device";
  const userAgent = rawUserAgent.slice(0, MAX_USER_AGENT_LENGTH);
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser) return "Unknown browser";
  return platform ? `${browser} on ${platform}` : browser;
}
