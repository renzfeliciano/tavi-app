import type { CatalogItemKind } from "@/modules/catalog";
import { restoreCatalogItemAction } from "../../catalog/actions";
import { restoreCustomerAction } from "../../customers/actions";
import { restoreTaxRateAction } from "../../settings/tax-rates/actions";

// The recycle bin restores archived records with the actions their own pages
// already use, so a restore does the same everywhere.
export const archivedCustomerRestore = (id: string) => restoreCustomerAction.bind(null, id);
export const archivedItemRestore = (kind: CatalogItemKind, id: string) => restoreCatalogItemAction.bind(null, kind, id);
export const archivedTaxRestore = (id: string) => restoreTaxRateAction.bind(null, id);
