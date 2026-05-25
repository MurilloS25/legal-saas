import { z } from "zod";

export const TEMPLATE_STATUS = ["draft", "active", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUS)[number];

export const TemplateSchema = z.object({
  name: z.string().trim().min(1, "El nombre del machote es requerido"),
  description: z.string().optional(),
  content: z.string().trim().min(1, "El contenido del machote es requerido"),
  status: z.enum(TEMPLATE_STATUS, {
    error: "El estado no es válido",
  }),
});

export type TemplateInput = z.infer<typeof TemplateSchema>;
