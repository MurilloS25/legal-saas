import type { Tables } from "@/lib/supabase/database.types";

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
