"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { listHref } from "./list-href";

// A tab, a page link or a search on a list changes only the query string. Next
// keeps the old list on screen until the new one arrives and never shows the
// page's loading.tsx for it, so a slow connection looks like a dead click.
// The controls (LinkPending, ListForm) report that a navigation is on its way;
// ListResults, which wraps the rows, puts the list's skeleton in their place
// once the wait is long enough to notice (DESIGN.md, "Loading").

/** How long a navigation may take before the skeleton shows; the page loader waits as long. */
const SLOW_AFTER_MS = 150;

/**
 * The least time between two navigations a list makes for its controls. A burst of clicks on Next, Previous and
 * the page sizes goes out as the first click and the last one, never the ones between (DESIGN.md, "Lists and records").
 */
const THROTTLE_MS = 300;

type Report = (id: string, pending: boolean) => void;
type Navigate = (href: string, options?: { immediate?: boolean }) => void;

const ReportContext = createContext<Report | null>(null);
const SlowContext = createContext(false);
/** True while a navigation is on its way or waiting its turn: the list's cursor and `aria-busy`. */
const BusyContext = createContext(false);
const NavigateContext = createContext<Navigate | null>(null);

/** Wraps a list's controls and rows so the controls can tell the rows to wait. Renders no element of its own. */
export function ListPending({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [slow, setSlow] = useState(false);
  const [transitioning, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);
  const busy = pending.size > 0 || transitioning;

  // The list's one throttle: every control that navigates goes through it, so a burst across Next, Previous and
  // the sizes collapses to the first and the last navigation.
  const last = useRef<{ at: number; href: string | null }>({ at: Number.NEGATIVE_INFINITY, href: null });
  const latest = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    (href: string) => {
      last.current = { at: Date.now(), href };
      startTransition(() => router.push(href as Route));
    },
    [router],
  );

  const navigate = useCallback<Navigate>(
    (href, { immediate = false } = {}) => {
      latest.current = href;
      if (immediate) {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
        setQueued(false);
        run(href);
        return;
      }
      if (timer.current !== null) return; // the one waiting will take the latest
      const wait = THROTTLE_MS - (Date.now() - last.current.at);
      if (wait <= 0) {
        run(href);
        return;
      }
      setQueued(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setQueued(false);
        const next = latest.current;
        if (next !== null && next !== last.current.href) run(next);
      }, wait);
    },
    [run],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const report = useCallback<Report>((id, on) => {
    setPending((current) => {
      if (current.has(id) === on) return current;
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  return (
    <ReportContext value={report}>
      <NavigateContext value={navigate}>
        <BusyContext value={busy || queued}>
          <SlowContext value={slow}>{children}</SlowContext>
        </BusyContext>
      </NavigateContext>
    </ReportContext>
  );
}

/**
 * How a control sends the list to a new address: through the list's own throttle, in a transition that reports
 * pending. Outside a ListPending it is a plain `router.push`. `immediate` skips the wait (a search submitted with Enter).
 */
export function useListNavigate(): Navigate {
  const navigate = useContext(NavigateContext);
  const router = useRouter();
  return useCallback<Navigate>(
    (href, options) => (navigate ? navigate(href, options) : router.push(href as Route)),
    [navigate, router],
  );
}

/**
 * A `Link` for a list's own controls (pages, page sizes). A plain click goes through the list's throttle and
 * pending state; a click with a modifier key, a middle click or a new-tab link is left to the browser.
 */
export function ListLink({ onClick, href, target, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: Route }) {
  const navigate = useListNavigate();
  return (
    <Link
      {...props}
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (target && target !== "_self") return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}

/** Tells the surrounding ListPending, if any, that a navigation is on its way for as long as `pending` is true. */
function useReportPending(pending: boolean) {
  const id = useId();
  const report = useContext(ReportContext);
  useEffect(() => {
    if (!report || !pending) return;
    report(id, true);
    return () => report(id, false);
  }, [id, pending, report]);
}

/** Goes inside a `<Link>`: reports that link's navigation. Draws nothing. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  useReportPending(pending);
  return null;
}

/**
 * A GET form that goes to its results through the router, so the page isn't
 * reloaded and its pending state can be reported. Without JavaScript it is
 * still a plain form with the same `action`.
 */
export function ListForm({ action, children, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: Route }) {
  const navigate = useListNavigate();

  return (
    <form
      {...props}
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        const params: Record<string, string> = {};
        for (const [name, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string") params[name] = value;
        }
        navigate(listHref(action, params), { immediate: true });
      }}
    >
      {children}
    </form>
  );
}

/**
 * The rows of a list and anything that belongs with them (its pager). When a
 * navigation is slow it shows `skeleton`, announced as `label`, instead. The
 * rows stay mounted underneath, hidden, so the link that was clicked keeps
 * reporting until its navigation is done.
 */
export function ListResults({ label, skeleton, children }: { label: string; skeleton: ReactNode; children: ReactNode }) {
  const slow = useContext(SlowContext);
  const busy = useContext(BusyContext);
  return (
    <>
      {slow && (
        <div role="status">
          <span className="sr-only">{label}</span>
          <div aria-hidden="true">{skeleton}</div>
        </div>
      )}
      <div hidden={slow} aria-busy={busy} className="aria-busy:cursor-progress aria-busy:[&_a]:cursor-progress">
        {children}
      </div>
    </>
  );
}
