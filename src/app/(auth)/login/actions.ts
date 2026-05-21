"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validations/auth";

export type LoginState = {
  errors?: {
    email?: string;
    password?: string;
  };
  message?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = LoginSchema.safeParse(raw);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    // Generic message — does not reveal whether the email exists.
    return {
      message:
        "Credenciales inválidas. Verifica tu correo y contraseña e intenta de nuevo.",
    };
  }

  redirect("/dashboard");
}
