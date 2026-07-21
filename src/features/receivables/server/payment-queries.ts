import "server-only";

import { requireUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { ReceivablePayment } from "../model/types";

export async function listPaymentsByReceivable(
  receivableId: string,
): Promise<ReceivablePayment[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("receivable_payments")
    .select(
      "id, amount, currency, paid_at, method, reference, status, voided_at, void_reason, created_at",
    )
    .eq("receivable_id", receivableId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throwDataAccessError("list receivable payments", error);
  return (data ?? []).map((payment) => ({
    ...payment,
    amount: String(payment.amount),
  }));
}
