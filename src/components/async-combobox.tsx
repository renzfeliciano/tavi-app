"use client";

import { type ReactNode, useId, useMemo, useRef, useState, useTransition } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AsyncComboboxProps<T> = {
  label: string;
  /** Hide the visible label (it stays for screen readers). */
  hideLabel?: boolean;
  placeholder: string;
  /** The chosen item, or null. Keep it controlled. */
  value: T | null;
  onValueChange: (value: T | null) => void;
  /** Runs as the person types (and once when opened empty). */
  search: (query: string) => Promise<T[]>;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  /** Shown under the results, e.g. an "Add new customer" button. */
  footer?: ReactNode;
  /** Pickers that add something (and then reset) instead of holding a value. */
  resetAfterSelect?: boolean;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * A searchable picker over server results (Base UI Combobox: keyboard and
 * screen-reader behaviour built in). Results come from `search`; stale
 * responses are dropped.
 */
export function AsyncCombobox<T>({
  label,
  hideLabel,
  placeholder,
  value,
  onValueChange,
  search,
  itemKey,
  itemLabel,
  renderItem,
  footer,
  resetAfterSelect,
  invalid,
  describedBy,
  disabled,
  className,
}: AsyncComboboxProps<T>) {
  const id = useId();
  const [results, setResults] = useState<T[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);

  const items = useMemo(() => {
    if (!value || results.some((item) => itemKey(item) === itemKey(value))) return results;
    return [...results, value];
  }, [results, value, itemKey]);

  function runSearch(text: string) {
    const request = ++latest.current;
    startTransition(async () => {
      try {
        const found = await search(text.trim());
        if (request !== latest.current) return;
        startTransition(() => {
          setResults(found);
          setError(false);
        });
      } catch {
        if (request === latest.current) setError(true);
      }
    });
  }

  const status = pending
    ? "Searching…"
    : error
      ? "Couldn't search just now. Try again."
      : results.length === 0 && query.trim() !== ""
        ? `No matches for “${query.trim()}”.`
        : null;

  return (
    <Combobox.Root<T>
      items={items}
      value={resetAfterSelect ? null : value}
      itemToStringLabel={itemLabel}
      isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
      filter={null}
      disabled={disabled}
      onOpenChange={(open) => {
        if (open && results.length === 0) runSearch(query);
      }}
      onValueChange={(next) => {
        onValueChange(next);
        setQuery("");
      }}
      onInputValueChange={(next, { reason }) => {
        setQuery(next);
        // Search only when the person types or clears, not when a pick fills the input.
        if (reason !== "input-change" && reason !== "input-clear") return;
        runSearch(next);
      }}
    >
      <div className={cn("grid gap-2", className)}>
        <label htmlFor={id} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
          {label}
        </label>
        <Combobox.InputGroup
          data-slot="combobox-field"
          className={cn(
            "relative flex h-9 items-center rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-(--duration-fast) focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/35 hover:border-border-strong pointer-coarse:h-11",
            invalid && "border-destructive ring-3 ring-destructive/20",
          )}
        >
          <Combobox.Input
            id={id}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="h-full w-full min-w-0 rounded-md bg-transparent pr-16 pl-3 text-base outline-none placeholder:text-muted-foreground pointer-coarse:pr-22 md:text-sm"
          />
          <div className="absolute right-1 flex items-center gap-0.5 text-muted-foreground">
            {pending && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
            {!resetAfterSelect && value && (
              <Combobox.Clear
                aria-label={`Clear ${label.toLowerCase()}`}
                className="grid size-7 place-items-center rounded-sm hover:text-foreground pointer-coarse:size-10"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </Combobox.Clear>
            )}
            <Combobox.Trigger
              aria-label={`Show ${label.toLowerCase()} options`}
              className="grid size-7 place-items-center rounded-sm hover:text-foreground pointer-coarse:size-10"
            >
              <ChevronDownIcon aria-hidden="true" className="size-4" />
            </Combobox.Trigger>
          </div>
        </Combobox.InputGroup>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
          <Combobox.Popup
            aria-busy={pending || undefined}
            className="w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <div className="max-h-[min(var(--available-height),20rem)] overflow-y-auto overscroll-contain p-1">
              <Combobox.Status>
                {status && <div className="px-2 py-2 text-sm text-muted-foreground">{status}</div>}
              </Combobox.Status>
              <Combobox.List>
                {(item: T) => (
                  <Combobox.Item
                    key={itemKey(item)}
                    value={item}
                    className="flex cursor-default items-start gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground pointer-coarse:py-3"
                  >
                    {renderItem ? renderItem(item) : itemLabel(item)}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </div>
            {footer && <div className="border-t border-border p-1">{footer}</div>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
