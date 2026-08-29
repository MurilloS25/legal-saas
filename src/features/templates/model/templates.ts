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

export function templateStatusLabel(status: string): string {
  return TEMPLATE_STATUS_LABEL[status as TemplateStatus] ?? status;
}

// Mapeo al set de tonos del `Badge` compartido (ver src/components/ui/Badge.tsx).
// "Activo" es un estado positivo real (el machote está listo para usarse) →
// verde semántico, no el acento decorativo. "Archivado" es neutro/inactivo
// (como "Borrador"), no una advertencia → gris, no ámbar (DESIGN.md reserva
// ámbar para pendiente/advertencia real).
const TEMPLATE_STATUS_BADGE_TONE: Record<
  TemplateStatus,
  "success" | "neutral"
> = {
  draft: "neutral",
  active: "success",
  archived: "neutral",
};

export function templateStatusBadgeTone(status: string): "success" | "neutral" {
  return (
    TEMPLATE_STATUS_BADGE_TONE[status as TemplateStatus] ??
    TEMPLATE_STATUS_BADGE_TONE.draft
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TemplateIdSchema = z
  .string()
  .regex(UUID_PATTERN, "El identificador no es válido");
