import "server-only";

export {
  getDocumentById,
  listDocuments,
  listDocumentsByClient,
  listDocumentsPage,
} from "./server/queries";
export type {
  ClientDocumentRow,
  DocumentListRow,
  DocumentRow,
  DocumentsPage,
  WorkspaceDocumentRow,
} from "./server/queries";
export {
  listDocumentActivity,
  ACTIVITY_PAGE_SIZE,
} from "./server/activity";
export type {
  ActivityListItem,
  DocumentActivityPage,
} from "./server/activity";
export { getNotarialMetadata } from "./server/notarial-queries";
export {
  getLatestNotarialExportAt,
  listNotarialActTypes,
  listNotarialIndex,
  listNotarialIndexForExport,
  NOTARIAL_EXPORT_LIMIT,
} from "./server/notarial-index-queries";
export type {
  NotarialIndexPage,
  NotarialIndexRow,
} from "./server/notarial-index-queries";
export {
  buildEscrituraDocx,
  contentDispositionAttachment,
  DOCX_MIME,
  DocxGenerationError,
} from "@/lib/documents/docx";
