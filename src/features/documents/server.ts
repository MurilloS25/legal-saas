import "server-only";

export {
  getDocumentById,
  listDocuments,
  listDocumentsByClient,
} from "./server/detail-queries";
export type {
  ClientDocumentRow,
  DocumentListRow,
  DocumentRow,
} from "./server/detail-queries";
export { listDocumentsPage } from "./server/workspace-queries";
export type {
  DocumentsPage,
  WorkspaceDocumentRow,
} from "./server/workspace-queries";
export {
  listDocumentActivity,
  ACTIVITY_PAGE_SIZE,
} from "./server/activity-queries";
export type {
  ActivityListItem,
  DocumentActivityPage,
} from "./server/activity-queries";
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
  DocumentExportError,
  prepareDocumentDocxExport,
  prepareNotarialCsvExport,
} from "./server/export-actions";
export type { BinaryExport } from "./server/export-actions";
