import { z } from "zod";

export const TEMPLATE_FIELD_TYPES = ["text", "textarea", "number", "date"] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

/**
 * field_key en dot notation: segmentos de minúsculas, números y underscore
 * separados por un solo punto. Ej: `buyer_1.full_name`, `sale.price`, `price`.
 * Excluye espacios, mayúsculas, puntos al inicio/final y puntos dobles.
 */
const FIELD_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export const TemplateFieldSchema = z.object({
  field_key: z
    .string()
    .trim()
    .min(1, "La variable del campo es requerida")
    .regex(
      FIELD_KEY_PATTERN,
      "Usa minúsculas, números, guion bajo y puntos simples. Ej: buyer_1.full_name",
    ),
  label: z.string().trim().min(1, "La etiqueta del campo es requerida"),
  field_type: z.enum(TEMPLATE_FIELD_TYPES, {
    error: "El tipo de campo no es válido",
  }),
  required: z.boolean({ error: "Indica si el campo es obligatorio" }),
  sort_order: z
    .number({ error: "El orden debe ser un número" })
    .int("El orden debe ser un número entero")
    .min(0, "El orden no puede ser negativo"),
});

export type TemplateFieldInput = z.infer<typeof TemplateFieldSchema>;
