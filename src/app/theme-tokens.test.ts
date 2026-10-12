import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The colour themes live in globals.css (D24). The dark tokens are written twice
// (explicit choice, and "system" through prefers-color-scheme), so these tests keep
// the copies identical, make sure dark defines everything light does, and hold the
// text pairs to WCAG AA (4.5:1) in both themes.

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

/** The text between the braces that follow `header`, with nested braces matched. */
function blockAfter(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`No block "${header}" in globals.css`);
  const open = source.indexOf("{", start + header.length - 1);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed block "${header}"`);
}

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[match[1]!] = match[2]!.replace(/\/\*.*?\*\//g, "").trim();
  return out;
}

const light = tokens(blockAfter(css, ':root,\n[data-theme="light"] {'));
const dark = tokens(blockAfter(css, '[data-theme="dark"] {'));
const darkSystem = tokens(blockAfter(css, "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {"));

// --- colour maths: OKLCH -> linear sRGB -> relative luminance -> contrast ---
function luminance(value: string): number {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/.exec(value);
  if (!m) throw new Error(`Not an oklch colour: ${value}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  const r = clip(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
const contrast = (fg: string, bg: string) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
};

/** Text on its ground: every pair the app really sets (foreground token, background token). */
const TEXT_PAIRS: [string, string][] = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--ink-subtle", "--background"],
  ["--ink-subtle", "--surface-sunken"],
  ["--primary-foreground", "--primary"],
  ["--primary-foreground", "--primary-hover"],
  ["--stamp", "--background"],
  ["--stamp", "--card"],
  ["--stamp", "--stamp-subtle"],
  ["--danger-strong", "--danger-subtle"],
  ["--danger-strong", "--card"],
  ["--success-strong", "--success-subtle"],
  ["--success-strong", "--card"],
  ["--warning-strong", "--warning-subtle"],
  ["--warning-strong", "--card"],
  ["--info-strong", "--info-subtle"],
  ["--info-strong", "--card"],
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-foreground", "--sidebar-accent"],
  ["--accent-foreground", "--accent"],
  ["--secondary-foreground", "--secondary"],
];

describe("themes (globals.css)", () => {
  it("writes the dark tokens identically for the explicit and the system case", () => {
    expect(darkSystem).toEqual(dark);
  });

  it("defines every colour token in dark that light defines", () => {
    const themeless = new Set(["--radius", "--duration-fast", "--duration-normal", "--duration-slow", "--sidebar-w", "--sidebar-w-collapsed", "color-scheme"]);
    const missing = Object.keys(light).filter((name) => !themeless.has(name) && !(name in dark));
    expect(missing).toEqual([]);
    expect(Object.keys(dark).filter((name) => !(name in light))).toEqual([]);
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("keeps text readable in %s (WCAG AA 4.5:1)", (_name, theme) => {
    const failures = TEXT_PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrast(theme[fg]!, theme[bg]!) }))
      .filter((pair) => !(pair.ratio >= 4.5))
      .map((pair) => `${pair.fg} on ${pair.bg}: ${pair.ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("pins color-scheme so native controls and scrollbars follow the theme", () => {
    expect(css).toMatch(/\[data-theme="light"\] \{\s*color-scheme: light;/);
    expect(css).toMatch(/\[data-theme="dark"\] \{\s*color-scheme: dark;/);
  });
});
