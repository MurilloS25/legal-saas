import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentIdSchema } from "@/lib/validations/documents";

export type DocumentListRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  updated_at: string;
  templates: { name: string } | null;
};

export type DocumentRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  field_values: Record<string, string>;
  rendered_content: string;
  created_at: string;
  updated_at: string;
};

/** Borradores del usuario, el modificado más recientemente primero. */
export async function listDocuments(): Promise<DocumentListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, status, template_id, updated_at, templates(name)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as unknown as DocumentListRow[];
}

/**
 * Escritura por ID, solo del usuario autenticado. Devuelve null tanto si no
 * existe como si pertenece a otro usuario — sin filtrar la diferencia.
 */
export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!DocumentIdSchema.safeParse(id).success) return null;

  const { data } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, field_values, rendered_content, created_at, updated_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as DocumentRow | null) ?? null;
}
