"use client";

import { useState } from "react";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/modules/invoices/client";
import { createInvoiceLinkAction } from "../actions";

type SentInvoiceActionsProps = {
  id: string;
  status: InvoiceStatus;
  shareChannels: string;
};

/** What a business can do with an issued invoice. Copying a link is instant. */
export function SentInvoiceActions({ id, status, shareChannels }: SentInvoiceActionsProps) {
  const [pending, setPending] = useState(false);
  if (status === "VOID" || status === "CANCELLED") return null;

  async function copyLink() {
    setPending(true);
    const result = await createInvoiceLinkAction(id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success("Link copied.", { description: `Paste it into ${shareChannels}.` });
    } catch {
      toast.success("Here's the link.", { description: result.url, duration: 20_000 });
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" pending={pending} pendingLabel="Copying…" onClick={() => void copyLink()}>
        <LinkIcon aria-hidden="true" />
        Copy link
      </Button>
    </div>
  );
}
