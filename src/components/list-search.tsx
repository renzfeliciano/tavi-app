"use client";

import type { Route } from "next";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MAX_SEARCH_LENGTH, normalizeSearch } from "@/shared/text/search";
import { listHref } from "./list-href";
import { useListNavigate } from "./list-pending";

/** How long typing must pause before the list searches (DESIGN.md, "Lists and records"). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * A search box that sends `?q=` to `action`, keeping the other params. It searches when typing pauses, or at once
 * on Enter, and never makes a request for text that is already what's searched. A new search starts at page 1.
 * Without JavaScript it is a plain GET form.
 */
export function ListSearch({
  action,
  label,
  placeholder,
  value,
  keep = {},
}: {
  action: Route;
  label: string;
  placeholder: string;
  value: string | null;
  /** Other params to keep, e.g. the current view. */
  keep?: Record<string, string | undefined>;
}) {
  const navigate = useListNavigate();
  const input = useRef<HTMLInputElement>(null);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The text the list is showing results for, or is on its way to. */
  const searched = useRef(normalizeSearch(value ?? "") ?? "");
  const id = `search-${action.replace(/\W+/g, "-")}`;

  const search = (typed: string, immediate: boolean) => {
    const text = normalizeSearch(typed) ?? "";
    if (text === searched.current) return;
    searched.current = text;
    navigate(listHref(action, { q: text, ...keep }), { immediate });
  };

  // The address changed some other way (Clear search, a tab, back): show what is now searched, unless typing.
  useEffect(() => {
    const now = normalizeSearch(value ?? "") ?? "";
    const box = input.current;
    if (!box || now === searched.current || document.activeElement === box) return;
    searched.current = now;
    box.value = now;
  }, [value]);

  useEffect(
    () => () => {
      if (wait.current !== null) clearTimeout(wait.current);
    },
    [],
  );

  return (
    <form
      role="search"
      action={action}
      className="relative w-full sm:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (wait.current !== null) clearTimeout(wait.current);
        wait.current = null;
        search(input.current?.value ?? "", true);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={input}
        id={id}
        type="search"
        name="q"
        defaultValue={value ?? ""}
        maxLength={MAX_SEARCH_LENGTH}
        placeholder={placeholder}
        className="pl-9"
        onChange={(event) => {
          const typed = event.currentTarget.value;
          if (wait.current !== null) clearTimeout(wait.current);
          wait.current = setTimeout(() => {
            wait.current = null;
            search(typed, false);
          }, SEARCH_DEBOUNCE_MS);
        }}
      />
      {Object.entries(keep).map(([name, keptValue]) =>
        keptValue ? <input key={name} type="hidden" name={name} value={keptValue} /> : null,
      )}
    </form>
  );
}
