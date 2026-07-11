"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TemplateSchema } from "@/lib/validations/templates";
import { TemplateFieldSchema } from "@/lib/validations/template-fields";

// ------------------------------------------------------------------ types

export type TemplateState = {
  errors?: {
    name?: string;
    description?: string;
    content?: string;
    status?: string;
  };
  message?: string;
};

// ------------------------------------------------------------------ helpers

function parseFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    content: String(formData.get("content") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
}

function fieldErrors(result: ReturnType<typeof TemplateSchema.safeParse>): TemplateState {
  if (result.success) return {};
  const fe = result.error.flatten().fieldErrors;
  return {
    errors: {
      name: fe.name?.[0],
      description: fe.description?.[0],
      content: fe.content?.[0],
      status: fe.status?.[0],
    },
  };
}

// ------------------------------------------------------------------ create

export async function createTemplateAction(
  _prevState: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = TemplateSchema.safeParse(parseFormData(formData));
  if (!result.success) return fieldErrors(result);

  const { name, description, content, status } = result.data;

  const { data, error } = await supabase
    .from("templates")
    .insert({
      owner_id: user.id,
      name,
      description: description ?? null,
      content_json: { text: content },
      text_preview: content.slice(0, 300),
      status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "No fue posible crear el machote. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}

// ------------------------------------------------------------------ update

export async function updateTemplateAction(
  id: string,
  _prevState: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = TemplateSchema.safeParse(parseFormData(formData));
  if (!result.success) return fieldErrors(result);

  const { name, description, content, status } = result.data;

  const { error } = await supabase
    .from("templates")
    .update({
      name,
      description: description ?? null,
      content_json: { text: content },
      text_preview: content.slice(0, 300),
      status,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return { message: "No fue posible actualizar el machote. Intenta de nuevo." };
  }

  revalidatePath(`/dashboard/templates/${id}`);
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}

// ================================================================== template fields

export type TemplateFieldState = {
  errors?: {
    field_key?: string;
    label?: string;
    field_type?: string;
  };
  message?: string;
  success?: boolean;
};

export type DeleteTemplateFieldState = {
  message?: string;
  success?: boolean;
};

// Postgres unique_violation — el machote ya tiene un campo con ese field_key.
const UNIQUE_VIOLATION = "23505";

function parseFieldFormData(formData: FormData, sortOrder: number) {
  return {
    field_key: String(formData.get("field_key") ?? ""),
    label: String(formData.get("label") ?? ""),
    field_type: String(formData.get("field_type") ?? ""),
    required: formData.get("required") === "on",
    sort_order: sortOrder,
  };
}

function fieldFormErrors(
  result: ReturnType<typeof TemplateFieldSchema.safeParse>,
): TemplateFieldState {
  if (result.success) return {};
  const fe = result.error.flatten().fieldErrors;
  return {
    errors: {
      field_key: fe.field_key?.[0],
      label: fe.label?.[0],
      field_type: fe.field_type?.[0],
    },
  };
}

/** El template debe pertenecer al usuario autenticado antes de operar sus campos. */
async function userOwnsTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("templates")
    .select("id")
    .eq("id", templateId)
    .eq("owner_id", userId)
    .maybeSingle();

  return !!data;
}

// ------------------------------------------------------------------ create field

export async function createTemplateFieldAction(
  templateId: string,
  _prevState: TemplateFieldState,
  formData: FormData,
): Promise<TemplateFieldState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userOwnsTemplate(supabase, templateId, user.id))) {
    return { message: "No se encontró el machote." };
  }

  // Siguiente posición al final del listado.
  const { data: lastField } = await supabase
    .from("template_fields")
    .select("sort_order")
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (lastField?.sort_order ?? -1) + 1;

  const result = TemplateFieldSchema.safeParse(
    parseFieldFormData(formData, nextSortOrder),
  );
  if (!result.success) return fieldFormErrors(result);

  const { error } = await supabase.from("template_fields").insert({
    owner_id: user.id,
    template_id: templateId,
    ...result.data,
    source: "manual",
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        errors: {
          field_key: "Ya existe un campo con esa variable en este machote.",
        },
      };
    }
    return { message: "No fue posible agregar el campo. Intenta de nuevo." };
  }

  revalidatePath(`/dashboard/templates/${templateId}`);
  return { success: true };
}

// ------------------------------------------------------------------ update field

export async function updateTemplateFieldAction(
  fieldId: string,
  templateId: string,
  _prevState: TemplateFieldState,
  formData: FormData,
): Promise<TemplateFieldState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userOwnsTemplate(supabase, templateId, user.id))) {
    return { message: "No se encontró el machote." };
  }

  // El campo debe existir bajo este machote y usuario; conserva su sort_order.
  const { data: existing } = await supabase
    .from("template_fields")
    .select("id, sort_order")
    .eq("id", fieldId)
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!existing) {
    return { message: "No se encontró el campo." };
  }

  const result = TemplateFieldSchema.safeParse(
    parseFieldFormData(formData, existing.sort_order),
  );
  if (!result.success) return fieldFormErrors(result);

  const { field_key, label, field_type, required } = result.data;

  const { error } = await supabase
    .from("template_fields")
    .update({ field_key, label, field_type, required })
    .eq("id", fieldId)
    .eq("template_id", templateId)
    .eq("owner_id", user.id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        errors: {
          field_key: "Ya existe un campo con esa variable en este machote.",
        },
      };
    }
    return { message: "No fue posible actualizar el campo. Intenta de nuevo." };
  }

  revalidatePath(`/dashboard/templates/${templateId}`);
  return { success: true };
}

// ------------------------------------------------------------------ delete field

export async function deleteTemplateFieldAction(
  fieldId: string,
  templateId: string,
  _prevState: DeleteTemplateFieldState,
  _formData: FormData,
): Promise<DeleteTemplateFieldState> {
  void _prevState;
  void _formData;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("template_fields")
    .delete()
    .eq("id", fieldId)
    .eq("template_id", templateId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { message: "No se pudo eliminar el campo. Intenta de nuevo." };
  }

  revalidatePath(`/dashboard/templates/${templateId}`);
  return { success: true };
}
