import "server-only";

import { throwDataAccessError } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth";
import { OptionalClientIdSchema } from "../model/document-schema";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export async function resolveOptionalClientId(
  supabase: Supabase,
  rawClientId: FormDataEntryValue | null,
  userId: string,
): Promise<{ clientId: string | null } | { error: string }> {
  const parsed = OptionalClientIdSchema.safeParse(String(rawClientId ?? ""));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "El cliente no es válido.",
    };
  }
  if (parsed.data === null) return { clientId: null };

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throwDataAccessError("resolve document client", error);
  if (!data) return { error: "El cliente seleccionado no está disponible." };
  return { clientId: parsed.data };
}
