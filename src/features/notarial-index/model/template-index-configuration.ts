import { z } from "zod";

const POSTGRES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    template_field_ids: z
      .array(z.string().regex(POSTGRES_UUID, "Campo inválido"))
      .max(50, "Selecciona como máximo 50 campos"),
  })
  .superRefine((value, ctx) => {
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
  fields: Array<{
    templateFieldId: string;
    order: number;
  }>;
};
