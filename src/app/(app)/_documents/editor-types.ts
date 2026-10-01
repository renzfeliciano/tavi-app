import type { DocumentParty } from "@/components/document/document-view";
import type { RawDelivery } from "@/modules/documents/client";

// Shapes passed between the quote and invoice pages, their server actions and the editor.

export type CustomerChoice = { id: string; displayName: string; detail: string | null };

export type LineSourceChoice = {
  key: string;
  kind: "product" | "service";
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unitLabel: string;
  unitPriceMinor: number;
  currency: string;
  taxRateId: string | null;
};

export type TaxRateChoice = { id: string; name: string; rateBps: number; label: string; archived: boolean };

export type EditorCustomer = { id: string; currency: string | null; email: string | null; party: DocumentParty };

export type DocumentKind = "quote" | "invoice";

/** The send dialog's choice; the server re-checks it with `parseDelivery`. */
export type Delivery = RawDelivery;

export type SaveDraftResponse =
  | { ok: true; id: string; savedAt: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type SendDocumentResponse =
  | { ok: true; id: string; number: string; url: string; emailedTo: string | null }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type SaveIssuedResponse =
  | { ok: true; revision: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

/** A draft's server actions, passed to the editor by its page. */
export type DocumentEditorActions = {
  saveDraft: (id: string | null, draft: unknown) => Promise<SaveDraftResponse>;
  deleteDraft: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  send: (id: string | null, draft: unknown, delivery: Delivery) => Promise<SendDocumentResponse>;
  /** Saves changes to a sent document (invoices before payment, D7). */
  saveIssued?: (id: string, draft: unknown) => Promise<SaveIssuedResponse>;
};
