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

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

const TEMPLATE_STATUS_BADGE_CLASS: Record<TemplateStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-teal-50 text-teal-700",
  archived: "bg-amber-50 text-amber-700",
};

export function templateStatusLabel(status: string): string {
  return TEMPLATE_STATUS_LABEL[status as TemplateStatus] ?? status;
}

export function templateStatusBadgeClass(status: string): string {
  return (
    TEMPLATE_STATUS_BADGE_CLASS[status as TemplateStatus] ??
    TEMPLATE_STATUS_BADGE_CLASS.draft
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TemplateIdSchema = z
  .string()
  .regex(UUID_PATTERN, "El identificador no es válido");
