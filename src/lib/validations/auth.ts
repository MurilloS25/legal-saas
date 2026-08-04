import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

// Password requirements applied on signup/recovery and shown in the UI.
// These align with the Supabase Auth password policy in supabase/config.toml
// (local) — Cloud needs the equivalent manual dashboard configuration, see
// docs/AUTH_SECURITY.md.
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

export const ForgotPasswordSchema = z.object({
  email: z.email("Ingresa un correo electrónico válido"),
});

// Misma política que SignupSchema (passwordSchema arriba): la contraseña
// nueva debe cumplir las mismas reglas al restablecerla por recuperación.
export const UpdatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
