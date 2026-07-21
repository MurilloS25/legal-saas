import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { DocumentOption } from "../model/types";

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
