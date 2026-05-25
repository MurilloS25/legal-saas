import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ClientRow = {
  id: string;
  full_name: string;
  identification_type: string;
  identification_number: string;
  marital_status: string;
  nationality: string;
  occupation: string;
  exact_address: string;
  created_at: string;
  updated_at: string;
};

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
