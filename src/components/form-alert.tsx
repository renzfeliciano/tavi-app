"use client";

import { useEffect, useRef } from "react";
import { CircleAlertIcon } from "lucide-react";

/** A form-level error, announced to screen readers and focused so it's seen. */
export function FormAlert({ message }: { message: string | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex gap-2.5 rounded-md border border-danger/25 bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong outline-none"
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="text-pretty">{message}</p>
    </div>
  );
}
