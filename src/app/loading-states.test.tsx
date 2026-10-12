import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

// Every page has its own loading.tsx: a skeleton in that page's layout, built
// from src/components/skeletons.tsx (DESIGN.md, "Loading").

// Pages that show the skeleton without the TAVI page loader on top: customer
// links carry the business's branding, the sign-in pages have their own
// Stamp beside the form, and the public home is a first impression that
// should not wait behind an animation.
const WITHOUT_LOADER = ["q/", "i/", "(home)", "(auth)/sign-in", "(auth)/sign-up", "(auth)/forgot-password", "(auth)/reset-password"];
const hasNoLoader = (folder: string) => WITHOUT_LOADER.some((prefix) => folder.startsWith(prefix));

const APP = dirname(fileURLToPath(import.meta.url));

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [relative(APP, path).split(sep).join("/")];
  });
}

const files = filesIn(APP);
const folderOf = (file: string) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "");
const named = (name: string) =>
  files
    .filter((file) => file === name || file.endsWith(`/${name}`))
    .map(folderOf)
    .map((folder) => ({ folder, route: folder || "(root)" }));

const pages = named("page.tsx");
const loadings = named("loading.tsx");
const pageFolders = pages.map((page) => page.folder);
const loadingFolders = loadings.map((loading) => loading.folder);
const isInside = (folder: string, parent: string) => parent === "" || folder.startsWith(`${parent}/`);

describe("loading states", () => {
  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThan(30);
  });

  it.each(pages)("$route has its own loading.tsx", ({ folder }) => {
    expect(loadingFolders, "add a loading.tsx skeleton in the page's shape beside its page.tsx").toContain(folder);
  });

  it.each(loadings)("$route/loading.tsx covers only its own page", ({ folder }) => {
    expect(pageFolders, "a loading.tsx belongs beside a page.tsx").toContain(folder);
    const covered = pageFolders.filter((page) => page !== folder && isInside(page, folder));
    expect(
      covered,
      "these pages would flash this skeleton first: move the page beside it into a route group, like customers/(list)",
    ).toEqual([]);
  });

  it.each(loadings)("$route/loading.tsx announces itself and hides its bars", async ({ folder }) => {
    const { default: Loading } = (await import(/* @vite-ignore */ join(APP, folder, "loading.tsx"))) as {
      default: ComponentType;
    };
    const { getByRole } = render(<Loading />);

    const status = getByRole("status");
    expect(status).toHaveTextContent(/^Loading/);
    expect(status.querySelector('[aria-hidden="true"] [data-slot="skeleton"]')).not.toBeNull();
    expect(status.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
  });

  // The page loader rides on top of the skeleton; it must never take its place (DESIGN.md, "Loading").
  it.each(loadings)("$route/loading.tsx keeps its skeleton under the page loader", async ({ folder }) => {
    const { default: Loading } = (await import(/* @vite-ignore */ join(APP, folder, "loading.tsx"))) as {
      default: ComponentType;
    };
    const { getByRole } = render(<Loading />);
    const status = getByRole("status");
    const loader = status.querySelector(".page-loader");

    if (hasNoLoader(folder)) {
      expect(loader).toBeNull();
      return;
    }
    expect(loader).not.toBeNull();
    // Hidden from assistive tech and from the pointer, so the page under it keeps working.
    expect(loader).toHaveAttribute("aria-hidden", "true");
    expect(loader).toHaveClass("pointer-events-none", "fixed", "inset-y-0", "right-0", "grid", "place-items-center");
    // The skeleton is a separate sibling: still drawn, still hidden from screen readers, not inside the loader.
    expect(loader?.querySelector('[data-slot="skeleton"]')).toBeNull();
    const skeleton = status.querySelector('[aria-hidden="true"]:not(.page-loader)');
    expect(skeleton?.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(skeleton?.contains(loader)).toBe(false);
  });
});
