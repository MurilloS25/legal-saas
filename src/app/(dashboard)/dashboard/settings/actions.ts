"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import {
  ProfileSchema,
  DocumentSettingsSchema,
} from "@/lib/validations/settings";

// ------------------------------------------------------------------ types

export type ProfileState = {
  errors?: {
    full_name?: string;
    professional_code?: string;
    email?: string;
    phone?: string;
  };
  message?: string;
  success?: boolean;
};

export type DocumentSettingsState = {
  errors?: {
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

// ------------------------------------------------------------------ save profile (Despacho → Perfil profesional)
// Escribe `lawyer_profiles`, compartido por workspace. Separado del guardado
// de configuración de documentos: cada sección de la pestaña Despacho/
// Configuración tiene su propio botón "Guardar", como en el prototipo
// aprobado, en vez de un único envío combinado.

export async function saveProfileAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { supabase, user, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "settings.manage")) {
    return {
      message: "Solo el propietario o un administrador puede editar esta información.",
    };
  }

  const raw = {
    full_name: String(formData.get("full_name") ?? ""),
    professional_code: String(formData.get("professional_code") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  const result = ProfileSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        full_name: fieldErrors.full_name?.[0],
        professional_code: fieldErrors.professional_code?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
      },
    };
  }

  const { error } = await supabase.from("lawyer_profiles").upsert(
    {
      owner_id: user.id,
      workspace_id: workspaceId,
      full_name: result.data.full_name,
      professional_code: result.data.professional_code || null,
      email: result.data.email || null,
      phone: result.data.phone || null,
    },
    { onConflict: "workspace_id" },
  );

  if (error) {
    return { message: "No fue posible guardar el despacho. Intenta de nuevo." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: true, message: "Despacho actualizado." };
}

// ------------------------------------------------------------------ save document settings (Configuración)

export async function saveDocumentSettingsAction(
  _prevState: DocumentSettingsState,
  formData: FormData,
): Promise<DocumentSettingsState> {
  const { supabase, user, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "settings.manage")) {
    return {
      message: "Solo el propietario o un administrador puede editar la configuración.",
    };
  }

  const raw = {
    font_family: String(formData.get("font_family") ?? ""),
    font_size: parseFloat(String(formData.get("font_size") ?? "")),
    margin_top_cm: parseFloat(String(formData.get("margin_top_cm") ?? "")),
    margin_bottom_cm: parseFloat(String(formData.get("margin_bottom_cm") ?? "")),
    margin_left_cm: parseFloat(String(formData.get("margin_left_cm") ?? "")),
    margin_right_cm: parseFloat(String(formData.get("margin_right_cm") ?? "")),
    line_spacing: parseFloat(String(formData.get("line_spacing") ?? "")),
  };

  const result = DocumentSettingsSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        font_family: fieldErrors.font_family?.[0],
        font_size: fieldErrors.font_size?.[0],
        margin_top_cm: fieldErrors.margin_top_cm?.[0],
        margin_bottom_cm: fieldErrors.margin_bottom_cm?.[0],
        margin_left_cm: fieldErrors.margin_left_cm?.[0],
        margin_right_cm: fieldErrors.margin_right_cm?.[0],
        line_spacing: fieldErrors.line_spacing?.[0],
      },
    };
  }

  const { error } = await supabase.from("document_settings").upsert(
    {
      owner_id: user.id,
      workspace_id: workspaceId,
      font_family: result.data.font_family,
      font_size: result.data.font_size,
      margin_top_cm: result.data.margin_top_cm,
      margin_bottom_cm: result.data.margin_bottom_cm,
      margin_left_cm: result.data.margin_left_cm,
      margin_right_cm: result.data.margin_right_cm,
      line_spacing: result.data.line_spacing,
    },
    { onConflict: "workspace_id" },
  );

  if (error) {
    return { message: "No fue posible guardar la configuración de documentos. Intenta de nuevo." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: true, message: "Configuración de documento guardada." };
}
