"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ProfileSchema,
  DocumentSettingsSchema,
} from "@/lib/validations/settings";

// ------------------------------------------------------------------ types

export type SettingsState = {
  errors?: {
    full_name?: string;
    professional_code?: string;
    email?: string;
    phone?: string;
    font_family?: string;
    font_size?: string;
    margin_top_cm?: string;
    margin_bottom_cm?: string;
    margin_left_cm?: string;
    margin_right_cm?: string;
    line_spacing?: string;
  };
  message?: string;
  success?: boolean;
};

// ------------------------------------------------------------------ save settings
// Acción única que guarda el perfil del abogado y la configuración de
// documentos en un solo envío. Ambos esquemas se validan antes de escribir
// nada; si uno falla, no se guarda ninguno. Al escribir, ambos upserts
// corren en paralelo (van a tablas distintas, sin transacción posible desde
// aquí): si uno de los dos falla, el mensaje lo indica explícitamente en vez
// de reportar éxito completo.

export async function saveSettingsAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profileRaw = {
    full_name: String(formData.get("full_name") ?? ""),
    professional_code: String(formData.get("professional_code") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  const settingsRaw = {
    font_family: String(formData.get("font_family") ?? ""),
    font_size: parseFloat(String(formData.get("font_size") ?? "")),
    margin_top_cm: parseFloat(String(formData.get("margin_top_cm") ?? "")),
    margin_bottom_cm: parseFloat(
      String(formData.get("margin_bottom_cm") ?? ""),
    ),
    margin_left_cm: parseFloat(String(formData.get("margin_left_cm") ?? "")),
    margin_right_cm: parseFloat(
      String(formData.get("margin_right_cm") ?? ""),
    ),
    line_spacing: parseFloat(String(formData.get("line_spacing") ?? "")),
  };

  const profileResult = ProfileSchema.safeParse(profileRaw);
  const settingsResult = DocumentSettingsSchema.safeParse(settingsRaw);

  if (!profileResult.success || !settingsResult.success) {
    const profileErrors = profileResult.success
      ? {}
      : profileResult.error.flatten().fieldErrors;
    const settingsErrors = settingsResult.success
      ? {}
      : settingsResult.error.flatten().fieldErrors;

    return {
      errors: {
        full_name: profileErrors.full_name?.[0],
        professional_code: profileErrors.professional_code?.[0],
        email: profileErrors.email?.[0],
        phone: profileErrors.phone?.[0],
        font_family: settingsErrors.font_family?.[0],
        font_size: settingsErrors.font_size?.[0],
        margin_top_cm: settingsErrors.margin_top_cm?.[0],
        margin_bottom_cm: settingsErrors.margin_bottom_cm?.[0],
        margin_left_cm: settingsErrors.margin_left_cm?.[0],
        margin_right_cm: settingsErrors.margin_right_cm?.[0],
        line_spacing: settingsErrors.line_spacing?.[0],
      },
    };
  }

  const [profileUpsert, settingsUpsert] = await Promise.all([
    supabase.from("lawyer_profiles").upsert(
      {
        owner_id: user.id,
        full_name: profileResult.data.full_name,
        professional_code: profileResult.data.professional_code || null,
        email: profileResult.data.email || null,
        phone: profileResult.data.phone || null,
      },
      { onConflict: "owner_id" },
    ),
    supabase.from("document_settings").upsert(
      {
        owner_id: user.id,
        font_family: settingsResult.data.font_family,
        font_size: settingsResult.data.font_size,
        margin_top_cm: settingsResult.data.margin_top_cm,
        margin_bottom_cm: settingsResult.data.margin_bottom_cm,
        margin_left_cm: settingsResult.data.margin_left_cm,
        margin_right_cm: settingsResult.data.margin_right_cm,
        line_spacing: settingsResult.data.line_spacing,
      },
      { onConflict: "owner_id" },
    ),
  ]);

  const profileFailed = !!profileUpsert.error;
  const settingsFailed = !!settingsUpsert.error;

  if (profileFailed && settingsFailed) {
    return { message: "No fue posible guardar los cambios. Intenta de nuevo." };
  }
  if (profileFailed) {
    return {
      message:
        "La configuración de documentos se guardó, pero no fue posible guardar el perfil. Intenta de nuevo.",
    };
  }
  if (settingsFailed) {
    return {
      message:
        "El perfil se guardó, pero no fue posible guardar la configuración de documentos. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: true, message: "Cambios guardados correctamente." };
}
