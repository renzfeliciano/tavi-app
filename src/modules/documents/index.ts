export {
  type DocumentNumbering,
  getDocumentNumbering,
  type UpdateNumberingResult,
  updateDocumentNumbering,
} from "./application/numbering";
export {
  DEFAULT_NUMBERING,
  DOCUMENT_KINDS,
  type DocumentKind,
  formatDocumentNumber,
  type NumberingFormat,
} from "./domain/numbering";
export { type NumberingInput, numberingInputSchema } from "./domain/numbering-input";
export { type AllocatedNumber, allocateDocumentNumber } from "./infra/sequences";
