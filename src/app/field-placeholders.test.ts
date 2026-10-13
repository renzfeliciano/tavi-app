import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// An empty text field shows an example of what goes in it ("e.g. 0917 123 4567"),
// so nobody has to guess the shape of an answer. This walks every field in the
// app: a new one without a placeholder fails here until it has one or is listed
// as an exception with its reason.
//
// Not covered, because the browser or the field itself already shows its shape:
// dates and times (the browser's own picker), checkboxes, radios, files and
// hidden fields, and passwords (dots in a placeholder read as already filled).

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED_FOLDERS = ["components/ui/", "app/dev/"];
const SHAPE_SHOWN_BY_BROWSER = ["date", "time", "datetime-local", "month", "hidden", "checkbox", "radio", "file", "password", "submit", "range"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const rel = relative(SRC, path).split(sep).join("/");
    const skipped = SKIPPED_FOLDERS.some((folder) => rel.startsWith(folder) || rel.includes(`/${folder}`));
    return rel.endsWith(".tsx") && !rel.endsWith(".test.tsx") && !skipped ? [rel] : [];
  });
}

type Field = { where: string; tag: string; placeholder: string | null; type: string | null };

/** Every `<Input`, `<Textarea`, `<PasswordInput`, `<input` and `<textarea` opening tag, with its placeholder and type. */
function fieldsIn(file: string): Field[] {
  const source = readFileSync(join(SRC, file), "utf8");
  const found: Field[] = [];
  for (const match of source.matchAll(/<(Input|Textarea|PasswordInput|input|textarea)\b/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    // The opening tag ends at the first `>` outside braces (so `=>` and generics inside props don't end it).
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    const tag = source.slice(match.index, end);
    const line = source.slice(0, match.index).split("\n").length;
    found.push({
      where: `${file}:${line}`,
      tag: match[1] as string,
      placeholder: /\bplaceholder=/.test(tag) ? "set" : null,
      type: /\btype="([^"]*)"/.exec(tag)?.[1] ?? null,
    });
  }
  return found;
}

// The password field wraps the plain input and passes its props through.
const WRAPPERS = ["components/password-input.tsx"];
const fields = sourceFiles(SRC)
  .filter((file) => !WRAPPERS.includes(file))
  .flatMap(fieldsIn);
const needsOne = (field: Field) =>
  field.tag !== "PasswordInput" && !(field.type !== null && SHAPE_SHOWN_BY_BROWSER.includes(field.type));

describe("placeholders", () => {
  it("finds the app's fields", () => {
    expect(fields.length).toBeGreaterThan(60);
    expect(fields.filter(needsOne).length).toBeGreaterThan(40);
  });

  it.each(fields.filter(needsOne).map((field) => ({ where: field.where, tag: field.tag, placeholder: field.placeholder })))(
    "$tag at $where shows an example while empty",
    ({ placeholder }) => {
      expect(placeholder, "add placeholder=\"e.g. …\" (from the market's examples when it depends on the country)").not.toBeNull();
    },
  );
});
