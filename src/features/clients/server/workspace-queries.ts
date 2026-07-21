import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { ClientRow } from "../model/types";

export async function listClients(): Promise<ClientRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at",
    )
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true });

  if (error) throwDataAccessError("list clients", error);
  return data ?? [];
}
