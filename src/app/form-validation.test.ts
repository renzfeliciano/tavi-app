import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Problems with a field show next to it, in Tavi's own words and style, never in the
// browser's own "Please fill out this field." bubble (a different look on every browser,
// and it hides the form's real error handling). Switching it off is `noValidate` on the
// form, so every `<form` in the app carries it. A new form without it fails here.

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const rel = relative(SRC, path).split(sep).join("/");
    return rel.endsWith(".tsx") && !rel.endsWith(".test.tsx") ? [rel] : [];
  });
}

/** Every `<form` opening tag (not one named in a comment), as `file:line`, that lacks `noValidate`. */
function formsWithoutNoValidate(): string[] {
  const missing: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(join(SRC, file), "utf8");
    for (const match of source.matchAll(/<form(?=\s)/g)) {
      const lineStart = source.lastIndexOf("\n", match.index) + 1;
      if (/^\s*(\*|\/\/)/.test(source.slice(lineStart, match.index + 1))) continue;
      let depth = 0;
      let end = match.index + match[0].length;
      // The opening tag ends at the first `>` outside braces (so `=>` inside props doesn't end it).
      for (; end < source.length; end++) {
        const char = source[end];
        if (char === "{") depth++;
        else if (char === "}") depth--;
        else if (char === ">" && depth === 0 && source[end - 1] !== "=") break;
      }
      if (!/\bnoValidate\b/.test(source.slice(match.index, end))) {
        missing.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
      }
    }
  }
  return missing;
}

describe("form validation", () => {
  it("turns off the browser's own bubble on every form, so errors show inline", () => {
    expect(formsWithoutNoValidate()).toEqual([]);
  });
});
