import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { redirect } from "next/navigation";

export type ClientRow = Pick<
  Tables<"clients">,
  | "id"
  | "full_name"
  | "identification_type"
  | "identification_number"
  | "marital_status"
  | "nationality"
  | "occupation"
  | "exact_address"
  | "created_at"
  | "updated_at"
>;

export async function listClients(): Promise<ClientRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at",
    )
    .eq("owner_id", user.id)
    .order("full_name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("clients")
    .select(
      "id, full_name, identification_type, identification_number, marital_status, nationality, occupation, exact_address, created_at, updated_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ?? null;
}
