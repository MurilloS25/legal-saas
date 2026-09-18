import { z } from "zod";
import { ResourceIdSchema } from "@/lib/validation/resource-id";

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

// "Activo" es un estado positivo real (el machote está listo para
// usarse) → verde semántico, no el acento decorativo. "Archivado" es
// neutro/inactivo (como "Borrador"), no una advertencia → gris, no
// ámbar (DESIGN.md reserva ámbar para pendiente/advertencia real).
const TEMPLATE_STATUS_BADGE_CLASS: Record<TemplateStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-200 text-slate-700",
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

export const TemplateIdSchema = ResourceIdSchema;
