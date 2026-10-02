import "server-only";

// Personal-data rights inside the app (proposal §M 1.13c, D16): download a
// business's data and close an account. Orchestrates other modules through
// their public entry points; nothing depends on this module.
export { type CloseAccountResult, closeAccount } from "./application/closure";
export { type ExportResult, exportBusinessData } from "./application/export";
export { EXPORT_NOTES } from "./domain/export";
