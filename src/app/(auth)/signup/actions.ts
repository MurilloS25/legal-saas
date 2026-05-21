"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupSchema } from "@/lib/validations/auth";

export type SignupState = {
  errors?: {
    email?: string;
    password?: string;
  };
  message?: string;
  requiresConfirmation?: boolean;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = SignupSchema.safeParse(raw);

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
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    // Generic message — does not reveal whether the email is already registered.
    return {
      message:
        "No fue posible crear la cuenta. Verifica los datos ingresados e intenta de nuevo.",
    };
  }

  // If there is no session the project requires email confirmation.
  if (!data.session) {
    return {
      requiresConfirmation: true,
      message:
        "Revisa tu correo. Te enviamos un enlace para confirmar tu cuenta.",
    };
  }

  redirect("/dashboard");
}
