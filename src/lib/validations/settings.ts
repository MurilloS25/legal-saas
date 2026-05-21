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
  full_name: z.string().min(1, "El nombre completo es requerido").trim(),
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

export const DocumentSettingsSchema = z.object({
  font_family: z.enum(ALLOWED_FONT_FAMILIES, "La fuente seleccionada no está permitida"),
  font_size: z
    .number()
    .positive("El tamaño de fuente debe ser mayor a 0"),
  margin_top_cm: z
    .number()
    .min(0, "El margen superior no puede ser negativo"),
  margin_bottom_cm: z
    .number()
    .min(0, "El margen inferior no puede ser negativo"),
  margin_left_cm: z
    .number()
    .min(0, "El margen izquierdo no puede ser negativo"),
  margin_right_cm: z
    .number()
    .min(0, "El margen derecho no puede ser negativo"),
  line_spacing: z
    .number()
    .positive("El interlineado debe ser mayor a 0"),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;
export type DocumentSettingsInput = z.infer<typeof DocumentSettingsSchema>;
