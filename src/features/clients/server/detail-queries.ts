import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { ClientRow } from "../model/types";

export async function getClientById(id: string): Promise<ClientRow | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throwDataAccessError("get client detail", error);
  return data;
}
