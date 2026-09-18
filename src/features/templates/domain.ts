export { buildFillableFields } from "./model/fillable-fields";
export type {
  ConfiguredTemplateField,
  FillableTemplateField,
} from "./model/fillable-fields";
export { extractTemplateVariables } from "./model/variables";
export {
  findUnresolvedVariables,
  renderTemplateContent,
} from "./model/render";
export {
  TemplateIdSchema,
  TEMPLATE_STATUS,
  templateStatusLabel,
} from "./model/templates";
export type { TemplateStatus } from "./model/templates";
export {
  VARIABLE_AUTOFILL_SOURCES,
  resolveAutofillSource,
  stripDiacritics,
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "./model/variable-autofill";
export type {
  VariableAutofillSource,
  VariableOutputTransform,
} from "./model/variable-autofill";
export {
  parseTemplatesQuery,
  templatesQueryToParams,
  TEMPLATES_PAGE_SIZE,
} from "./model/workspace-query";
export type { RawTemplatesQuery, TemplatesQuery } from "./model/workspace-query";
