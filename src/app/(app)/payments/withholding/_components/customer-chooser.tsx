"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { AsyncCombobox } from "@/components/async-combobox";
import { searchCustomersAction } from "../../../_documents/actions";
import type { CustomerChoice } from "../../../_documents/editor-types";

/** Step one of recording a certificate: who sent it. Picking a customer opens the form for them. */
export function CustomerChooser() {
  const router = useRouter();
  const [choice, setChoice] = useState<CustomerChoice | null>(null);
  return (
    <div className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <AsyncCombobox<CustomerChoice>
        label="Customer"
        placeholder="Search your customers"
        value={choice}
        onValueChange={(next) => {
          setChoice(next);
          if (next) router.push(`/payments/withholding/new?customer=${next.id}` as Route);
        }}
        search={searchCustomersAction}
        itemKey={(c) => c.id}
        itemLabel={(c) => c.displayName}
        renderItem={(c) => (
          <span className="grid">
            <span className="font-medium">{c.displayName}</span>
            {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
          </span>
        )}
      />
    </div>
  );
}
