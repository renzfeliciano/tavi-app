export {
  DEFAULT_NUMBERING,
  DOCUMENT_KINDS,
  type DocumentKind,
  formatDocumentNumber,
  type NumberingFormat,
} from "./domain/numbering";
export { type AllocatedNumber, allocateDocumentNumber } from "./infra/sequences";
