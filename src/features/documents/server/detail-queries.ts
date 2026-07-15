import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  DocumentIdSchema,
  DocumentValuesSchema,
} from "../model/document-schema";

export type DocumentListRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  client_id: string | null;
  updated_at: string;
  templates: { name: string } | null;
  clients: { id: string; full_name: string } | null;
};

export type DocumentRow = {
  id: string;
  title: string;
  status: string;
  template_id: string;
  client_id: string | null;
  field_values: Record<string, string>;
  rendered_content: string;
  created_at: string;
  updated_at: string;
  clients: { id: string; full_name: string } | null;
};

/** Escritura asociada a un cliente, para la sección del detalle de cliente. */
export type ClientDocumentRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  templates: { name: string } | null;
};

/** Borradores del usuario, el modificado más recientemente primero. */
export async function listDocuments(): Promise<DocumentListRow[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, updated_at, templates(name), clients(id, full_name)",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list documents", error);
  return data ?? [];
}

/**
 * Escritura por ID, solo del usuario autenticado. Devuelve null tanto si no
 * existe como si pertenece a otro usuario — sin filtrar la diferencia.
 */
export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const { supabase, user } = await requireUser();

  if (!DocumentIdSchema.safeParse(id).success) return null;

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, field_values, rendered_content, created_at, updated_at, clients(id, full_name)",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throwDataAccessError("get document detail", error);
  if (!data) return null;

  const values = DocumentValuesSchema.safeParse(data.field_values ?? {});
  if (!values.success) {
    throwDataAccessError("parse document field values", { code: "invalid_json" });
  }

  return { ...data, field_values: values.data };
}

/**
 * Escrituras asociadas a un cliente propio, la más reciente primero. Solo
 * del usuario autenticado; el cliente ajeno no devuelve nada.
 */
export async function listDocumentsByClient(
  clientId: string,
): Promise<ClientDocumentRow[]> {
  const { supabase, user } = await requireUser();

  if (!DocumentIdSchema.safeParse(clientId).success) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, status, updated_at, templates(name)")
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list documents by client", error);
  return data ?? [];
}
