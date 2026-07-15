import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { ClientOption, DocumentOption } from "../model/types";

export async function listClientOptions(): Promise<ClientOption[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true });

  if (error) throwDataAccessError("list receivable client options", error);
  return data ?? [];
}

export async function listDocumentOptions(): Promise<DocumentOption[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, client_id")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throwDataAccessError("list receivable document options", error);
  return data ?? [];
}
