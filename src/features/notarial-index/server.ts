import "server-only";

export {
  getLatestNotarialConfirmationActorName,
  getNotarialMetadata,
  getNotarialMetadataReviewRequired,
  getNotarialMetadataSuggestions,
} from "./server/detail-queries";
export {
  confirmNotarialMetadataAction,
  startNotarialCorrectionAction,
  type NotarialConfirmationActionState,
} from "./server/confirmation-actions";
export {
  getTemplateIndexConfiguration,
  queryTemplateIndexConfiguration,
} from "./server/template-index-config-queries";
export type { TemplateIndexConfiguration } from "./model/template-index-configuration";
export {
  prepareAndRecordNotarialDocxExport,
  prepareNotarialDocxExport,
} from "./server/export-actions";
export {
  getLatestNotarialExportAt,
  listNotarialIndexForExport,
  NOTARIAL_EXPORT_LIMIT,
} from "./server/export-queries";
export {
  listNotarialActTypes,
  listNotarialIndex,
} from "./server/workspace-queries";
export type {
  NotarialIndexPage,
} from "./server/workspace-queries";
export type { NotarialIndexRow } from "./model/notarial-index-row";
