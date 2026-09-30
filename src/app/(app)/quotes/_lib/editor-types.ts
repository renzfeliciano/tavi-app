import type { DocumentParty } from "@/components/document/document-view";

// Shapes passed between the quote pages, their server actions and the editor.

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

export type EditorCustomer = { id: string; currency: string | null; party: DocumentParty };
