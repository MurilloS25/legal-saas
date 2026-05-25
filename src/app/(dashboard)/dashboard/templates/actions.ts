"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TemplateSchema } from "@/lib/validations/templates";

// ------------------------------------------------------------------ types

export type TemplateState = {
  errors?: {
    name?: string;
    description?: string;
    content?: string;
    status?: string;
  };
  message?: string;
  success?: boolean;
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
  redirect(`/dashboard/templates/${data.id}`);
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
  return { success: true, message: "Machote actualizado correctamente." };
}
