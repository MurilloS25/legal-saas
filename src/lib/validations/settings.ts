import { z } from "zod";

// Font families allowed in the first iteration.
// Must stay in sync with the document generation adapter when it is implemented.
export const ALLOWED_FONT_FAMILIES = [
  "Times New Roman",
  "Arial",
  "Calibri",
] as const;

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number];

// ------------------------------------------------------------------ profiles

export const ProfileSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  professional_code: z.string().trim(),
  // Email is optional: empty string is accepted, non-empty must be valid.
  email: z
    .string()
    .trim()
    .refine(
      (val) =>
        val === "" ||
        /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val),
      "Ingresa un correo electrónico válido",
    ),
  phone: z.string().trim(),
});

// ------------------------------------------------------------------ document settings

const marginCm = (label: string) =>
  z.number().min(0, `El margen ${label} no puede ser negativo`);

// Márgenes por perfil: Frente (`margin_*_cm`) y Vuelto (`back_margin_*_cm`).
// `line_spacing` ya no es una preferencia: el DOCX usa siempre interlineado
// exacto de 24 pt (ver `src/lib/documents/docx/formatting.ts`).
export const DocumentSettingsSchema = z.object({
  font_family: z.enum(ALLOWED_FONT_FAMILIES, "La fuente seleccionada no está permitida"),
  font_size: z
    .number()
    .positive("El tamaño de fuente debe ser mayor a 0"),
  margin_top_cm: marginCm("superior"),
  margin_bottom_cm: marginCm("inferior"),
  margin_left_cm: marginCm("izquierdo"),
  margin_right_cm: marginCm("derecho"),
  back_margin_top_cm: marginCm("superior"),
  back_margin_bottom_cm: marginCm("inferior"),
  back_margin_left_cm: marginCm("izquierdo"),
  back_margin_right_cm: marginCm("derecho"),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;
export type DocumentSettingsInput = z.infer<typeof DocumentSettingsSchema>;
