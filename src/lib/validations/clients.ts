import { z } from "zod";

export const IDENTIFICATION_TYPES = ["cedula_fisica"] as const;
export type IdentificationType = (typeof IDENTIFICATION_TYPES)[number];

export const ClientSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  identification_type: z.enum(IDENTIFICATION_TYPES, {
    error: "El tipo de identificación no es válido",
  }),
  identification_number: z
    .string()
    .trim()
    .min(1, "El número de identificación es requerido"),
  marital_status: z.string().trim().min(1, "El estado civil es requerido"),
  nationality: z.string().trim().min(1, "La nacionalidad es requerida"),
  occupation: z.string().trim().min(1, "La ocupación es requerida"),
  exact_address: z.string().trim().min(1, "La dirección exacta es requerida"),
});

export type ClientInput = z.infer<typeof ClientSchema>;
