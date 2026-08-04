"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordSchema } from "@/lib/validations/auth";

export type UpdatePasswordState = {
  errors?: {
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
};

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const result = UpdatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const supabase = await createClient();

  // Requiere una sesión ya establecida (por /auth/confirm?type=recovery, o
  // una sesión normal). Sin ella, el enlace expiró o ya se usó.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      message: "El enlace expiró o ya se usó. Solicita uno nuevo.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });

  if (error) {
    return {
      message: "No fue posible actualizar la contraseña. Intenta de nuevo.",
    };
  }

  // Cierra cualquier otra sesión activa del usuario: si la contraseña
  // cambió por una posible cuenta comprometida, las sesiones viejas no
  // deben seguir siendo válidas. La sesión actual (recién creada) no se ve
  // afectada por scope "others".
  await supabase.auth.signOut({ scope: "others" });

  redirect("/dashboard?password_updated=1");
}
