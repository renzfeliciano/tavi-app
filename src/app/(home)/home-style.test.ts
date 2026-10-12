import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The public home's background and motion are plain CSS (home.css). These
// tests keep the rules in DESIGN.md true of it without a browser: only opacity
// and transform move, nothing moves for people who asked for less motion, and
// scroll-driven effects exist only where the browser has them.

const css = readFileSync(new URL("./home.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const read = (file: string) => (existsSync(new URL(`./${file}`, import.meta.url)) ? readFileSync(new URL(`./${file}`, import.meta.url), "utf8") : "");
const homeSources = ["page.tsx", "sample-quotation.tsx", "send-previews.tsx", "step-previews.tsx", "hover-stage.tsx", "section-stamp.tsx", "back-to-top.tsx", "steps-stage.tsx", "send-stage.tsx", "rest-stage.tsx", "rest-pictures.tsx", "activity-feed.tsx", "cta-scene.tsx", "cta-stage.tsx", "strength-pictures.tsx", "director.ts", "roaming.ts", "live.ts"].map(read);
/** Everything that makes the home page, to ask whether an entrance is used anywhere on it. */
const pageSource = homeSources.join("\n");

/** The text between the braces that open at `open`, braces balanced. */
function bodyAt(text: string, open: number): { body: string; end: number } {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
  }
  throw new Error("Unbalanced braces in home.css");
}

/** Every at-rule whose prelude matches, as { prelude, body, start, end }. */
function atRules(text: string, matches: RegExp) {
  const found: { prelude: string; body: string; start: number; end: number }[] = [];
  const header = /@([a-z-]+)([^{;]*)\{/g;
  for (let m = header.exec(text); m; m = header.exec(text)) {
    const prelude = `@${m[1]}${m[2]}`.trim();
    if (!matches.test(prelude)) continue;
    const open = m.index + m[0].length - 1;
    const { body, end } = bodyAt(text, open);
    found.push({ prelude, body, start: m.index, end });
    header.lastIndex = end;
  }
  return found;
}

const without = (text: string, rules: { start: number; end: number }[]) =>
  rules.reduceRight((rest, rule) => rest.slice(0, rule.start) + rest.slice(rule.end), text);

describe("home.css", () => {
  it("has keyframes, and they move things with opacity and transform only", () => {
    const keyframes = atRules(css, /^@keyframes\b/);
    expect(keyframes.length).toBeGreaterThan(0);
    for (const { prelude, body } of keyframes) {
      const frames = [...body.matchAll(/[^{}]+\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
      const properties = frames.flatMap((frame) => [...frame.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]));
      expect(properties.length, prelude).toBeGreaterThan(0);
      for (const property of properties) expect(["opacity", "transform"], `${prelude}: ${property}`).toContain(property);
    }
  });

  it("starts no animation or transition outside prefers-reduced-motion: no-preference", () => {
    const allowed = atRules(css, /prefers-reduced-motion:\s*no-preference/);
    expect(allowed.length).toBeGreaterThan(0);
    const rest = without(css, allowed);
    expect(rest).not.toMatch(/animation|transition|@keyframes/);
  });

  it("uses scroll-driven timelines only inside @supports for them", () => {
    const supported = atRules(css, /^@supports\s*\(animation-timeline/);
    expect(supported.length).toBeGreaterThan(0);
    expect(without(css, supported)).not.toMatch(/animation-timeline|animation-range/);
  });

  it("follows the pointer only for a fine pointer, and only when motion is welcome", () => {
    const spans = atRules(css, /prefers-reduced-motion:\s*no-preference/).flatMap((outer) => {
      const offset = css.indexOf("{", outer.start) + 1;
      return atRules(outer.body, /pointer:\s*fine/).map((inner) => ({ start: offset + inner.start, end: offset + inner.end }));
    });
    expect(spans.length).toBeGreaterThan(0);
    const uses = [...css.matchAll(/var\(--m[xy]\b/g)].map((match) => match.index);
    expect(uses.length).toBeGreaterThan(0);
    for (const at of uses) expect(spans.some((span) => at >= span.start && at < span.end), `var(--mx/--my) at ${at}`).toBe(true);
  });

  it("gives the sections different ways in: each entrance has its own keyframes, and the page uses each", () => {
    const keyframes = atRules(css, /^@keyframes\b/);
    const firstTransform = (name: string) => {
      const rule = keyframes.find((candidate) => candidate.prelude === `@keyframes ${name}`);
      expect(rule, `@keyframes ${name}`).toBeDefined();
      const first = [...rule!.body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((frame) => /^(from|0%)$/.test(frame[1]!.trim()));
      return /transform:\s*([^;]+)/.exec(first?.[2] ?? "")?.[1]?.trim();
    };

    const entrances = ["home-reveal", "home-reveal-left", "home-reveal-right", "home-reveal-tilt", "home-reveal-zoom", "home-reveal-pop"];
    const starts = entrances.map(firstTransform);
    expect(starts.every(Boolean)).toBe(true);
    expect(new Set(starts).size, "no two entrances start from the same place").toBe(entrances.length);

    for (const name of entrances) {
      expect(css, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
      expect(pageSource, name).toMatch(new RegExp(`(?<![\\w-])${name}(?![\\w-])`));
    }
  });

  it("names every set of keyframes once: a second one of the same name silently replaces the first everywhere", () => {
    const names = atRules(css, /^@keyframes\b/).map((rule) => rule.prelude.replace(/^@keyframes\s+/, ""));
    const twice = names.filter((name, index) => names.indexOf(name) !== index);

    expect(twice).toEqual([]);
  });

  it("makes the Back to top button play by itself once it is offered, not only when it is touched", () => {
    const motion = atRules(css, /prefers-reduced-motion:\s*no-preference/)
      .map((rule) => rule.body)
      .join("\n");
    const rules = [...motion.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1]!.trim(), body: match[2]! }));
    const alone = rules
      .filter(({ selector, body }) => /\.home-top\[data-shown="true"\]/.test(selector) && !/:hover|:focus|data-pulled/.test(selector) && /animation(-name)?\s*:/.test(body))
      .map(({ selector }) => selector);

    // The button pops in, the Stamp hops, its check is tapped as it lands, and the arrow bobs with it.
    expect(alone.some((selector) => /^\.home-top\[data-shown="true"\]$/.test(selector))).toBe(true);
    expect(alone.some((selector) => /\.mascot > g:first-of-type$/.test(selector))).toBe(true);
    expect(alone.some((selector) => /\.mascot > path$/.test(selector))).toBe(true);
    expect(alone.some((selector) => /\.home-top-arrow$/.test(selector))).toBe(true);
  });

  it("defines every home- class the home page's files use (or the keyframes it names)", () => {
    const used = new Set(homeSources.flatMap((text) => [...text.matchAll(/(?<![\w-])(home-[a-z]+(?:-[a-z]+)*)(?![\w-])/g)].map((match) => match[1]!)));
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(css, name).toMatch(new RegExp(`(\\.|@keyframes\\s+)${name}(?![\\w-])`));
  });

  it("keeps Next's special file names for the files that mean them, and calls every helper something else", () => {
    // A helper called layout.ts, template.ts or error.ts is not a helper to Next: it is that route's layout, template or error page, and the page breaks at runtime where no test of the helper would notice.
    const special = /^(layout|template|error|global-error|not-found|default|route|middleware|instrumentation|(opengraph|twitter|icon|apple-icon)-image|sitemap|robots|manifest)\./;
    const files = readdirSync(new URL("./", import.meta.url)).filter((name) => !name.includes(".test."));
    expect(files.filter((name) => special.test(name))).toEqual([]);
  });
});
