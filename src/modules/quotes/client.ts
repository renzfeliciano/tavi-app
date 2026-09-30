// Browser-safe exports of the quotes module (the editor parses drafts as you type).
export { parseQuoteDraft, type QuoteDraft, type QuoteDraftResult, type RawQuoteDraft } from "./domain/quote-draft";
export { QUOTE_STATUSES, type QuoteStatus } from "./domain/status";
export { EDITABLE_QUOTE_STATUSES, QUOTE_EVENTS, type QuoteEvent, transitionQuote } from "./domain/transitions";
