import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

// Password requirements applied on signup and shown in the UI.
// These align with the Supabase Auth password policy that must be
// configured in the project settings before production deployment.
const passwordSchema = z
  .string()
  .min(12, "Debe tener al menos 12 caracteres")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[^a-zA-Z0-9]/, "Debe incluir al menos un símbolo (p. ej. ! @ # $)");

export const SignupSchema = z
  .object({
    email: z.email("Ingresa un correo electrónico válido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
