// Browser-safe entry point: pure numbering and calculation helpers for live previews.
export { formatDocumentNumber, type NumberingFormat } from "./domain/numbering";
export { NUMBERING_LIMITS, type NumberingInput, numberingInputSchema } from "./domain/numbering-input";
export {
  calculateDocument,
  type DocumentAmounts,
  type DocumentInput,
  type LineAmounts,
  type LineDiscount,
  type LineInput,
  type LineTax,
  type TaxGroup,
  type TaxMode,
} from "./domain/calculation";
export {
  formatQuantity,
  MAX_QUANTITY_WHOLE_DIGITS,
  parseQuantityInput,
  QUANTITY_DECIMALS,
  QUANTITY_SCALE,
} from "./domain/quantity";
export {
  blankLine,
  DISCOUNT_KINDS,
  DOCUMENT_LIMITS,
  LINE_SOURCE_KINDS,
  type LineSourceKind,
  type LinesResult,
  type ParsedLine,
  parseDocumentLines,
  type RawLine,
  rawLineSchema,
} from "./domain/line-input";
export {
  type DocumentDraft,
  type DocumentDraftOptions,
  type DocumentDraftResult,
  parseDocumentDraft,
  type RawDocumentDraft,
} from "./domain/document-draft";
