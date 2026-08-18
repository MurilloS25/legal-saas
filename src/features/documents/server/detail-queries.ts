import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  DocumentIdSchema,
  DocumentOptionSelectionsSchema,
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
  option_selections: Record<string, string>;
  rendered_content: string;
  created_at: string;
  updated_at: string;
  /** Decisión de pertenencia al Índice Notarial — independiente de `status`. */
  include_in_notarial_index: boolean;
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
  const { supabase, workspaceId } = await requireWorkspace();

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, updated_at, templates(name), clients(id, full_name)",
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list documents", error);
  return data ?? [];
}

/**
 * Escritura por ID, solo del usuario autenticado. Devuelve null tanto si no
 * existe como si pertenece a otro usuario — sin filtrar la diferencia.
 */
export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const { supabase, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(id).success) return null;

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, template_id, client_id, field_values, option_selections, rendered_content, created_at, updated_at, include_in_notarial_index, clients(id, full_name)",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("get document detail", error);
  if (!data) return null;

  const values = DocumentValuesSchema.safeParse(data.field_values ?? {});
  if (!values.success) {
    throwDataAccessError("parse document field values", { code: "invalid_json" });
  }
  const selections = DocumentOptionSelectionsSchema.safeParse(
    data.option_selections ?? {},
  );
  if (!selections.success) {
    throwDataAccessError("parse document option selections", {
      code: "invalid_json",
    });
  }

  return {
    ...data,
    field_values: values.data,
    option_selections: selections.data,
  };
}

/**
 * Escrituras asociadas a un cliente propio, la más reciente primero. Solo
 * del usuario autenticado; el cliente ajeno no devuelve nada.
 */
export async function listDocumentsByClient(
  clientId: string,
): Promise<ClientDocumentRow[]> {
  const { supabase, workspaceId } = await requireWorkspace();

  if (!DocumentIdSchema.safeParse(clientId).success) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, status, updated_at, templates(name)")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list documents by client", error);
  return data ?? [];
}
