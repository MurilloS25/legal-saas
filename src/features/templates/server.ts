import "server-only";

export {
  getTemplateDashboardCounts,
  listTemplates,
  listTemplatesPage,
} from "./server/workspace-queries";
export type { TemplateListRow, TemplatesPage } from "./server/workspace-queries";
export {
  getTemplateById,
  listTemplateFields,
} from "./server/detail-queries";
export type {
  TemplateFieldRow,
  TemplateRow,
} from "./server/detail-queries";
export { listTemplateOptions } from "./server/options-queries";
export type { TemplateOption } from "./server/options-queries";
export {
  getAiTemplateGenerationAvailability,
  getTemplateAiGenerationInfo,
} from "./server/ai-generation/queries";
export type {
  AiTemplateGenerationAvailability,
  TemplateAiGenerationInfo,
} from "./server/ai-generation/queries";
export { readAiTemplateConfig } from "./server/ai-generation/config";
export { generateTemplateFromFormData } from "./server/ai-generation/request";
