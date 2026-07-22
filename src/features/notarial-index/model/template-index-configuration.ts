import { z } from "zod";

const POSTGRES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIMPLE_INDEX_MAPPING_KEYS = [
  "instrument_number",
  "authorized_date",
  "authorized_time",
  "protocol_book",
  "initial_folio",
  "final_folio",
] as const;

export type SimpleIndexMappingKey =
  (typeof SIMPLE_INDEX_MAPPING_KEYS)[number];
export const INDEX_MAPPING_KEYS = [
  ...SIMPLE_INDEX_MAPPING_KEYS,
  "parties",
] as const;
export type InvalidIndexMapping = (typeof INDEX_MAPPING_KEYS)[number];

const optionalFieldId = z
  .string()
  .regex(POSTGRES_UUID, "Campo inválido")
  .nullable();

export const TemplateIndexConfigurationSchema = z
  .object({
    party_separator: z
      .string()
      .max(30, "El separador es demasiado largo")
      .refine((value) => value.trim() !== "", "Ingresa un separador"),
    fixed_suffix: z
      .string()
      .trim()
      .max(200, "El texto fijo es demasiado largo")
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    allow_empty: z.boolean(),
    simple_fields: z.object({
      instrument_number: optionalFieldId,
      authorized_date: optionalFieldId,
      authorized_time: optionalFieldId,
      protocol_book: optionalFieldId,
      initial_folio: optionalFieldId,
      final_folio: optionalFieldId,
    }),
    authorized_time_option_block_id: z
      .string()
      .trim()
      .min(1, "Bloque inválido")
      .max(120, "Bloque inválido")
      .nullable()
      .default(null),
    template_field_ids: z
      .array(z.string().regex(POSTGRES_UUID, "Campo inválido"))
      .max(50, "Selecciona como máximo 50 campos"),
  })
  .superRefine((value, ctx) => {
    if (
      value.simple_fields.authorized_time !== null &&
      value.authorized_time_option_block_id !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["simple_fields"],
        message: "La hora solo puede tener una fuente",
      });
    }
    if (!value.allow_empty && value.template_field_ids.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["template_field_ids"],
        message: "Selecciona al menos un campo o confirma la configuración vacía",
      });
    }
    if (new Set(value.template_field_ids).size !== value.template_field_ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["template_field_ids"],
        message: "Un campo no puede aparecer más de una vez",
      });
    }
    const assignedSimpleFields = Object.values(value.simple_fields).filter(
      (fieldId): fieldId is string => fieldId !== null,
    );
    if (new Set(assignedSimpleFields).size !== assignedSimpleFields.length) {
      ctx.addIssue({
        code: "custom",
        path: ["simple_fields"],
        message: "Un campo simple no puede asignarse a más de un destino",
      });
    }
  });

export type TemplateIndexConfigurationInput = z.infer<
  typeof TemplateIndexConfigurationSchema
>;

export type TemplateIndexConfiguration = {
  id: string;
  templateId: string;
  partySeparator: string;
  fixedSuffix: string | null;
  allowEmpty: boolean;
  isComplete: boolean;
  simpleFields: Record<SimpleIndexMappingKey, string | null>;
  authorizedTimeOptionBlockId: string | null;
  invalidMappings: InvalidIndexMapping[];
  fields: Array<{
    templateFieldId: string;
    order: number;
  }>;
};
