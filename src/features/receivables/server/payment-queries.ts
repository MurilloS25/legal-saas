import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { ReceivablePayment } from "../model/types";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];

/**
 * Si existe CUALQUIER pago histórico (activo o anulado) para la cuenta.
 * Un pago anulado igual cuenta: la inmutabilidad financiera no se libera al
 * anular, ya que el pago existió y afectó la operación real.
 */
export async function receivableHasPaymentHistory(
  supabase: Supabase,
  receivableId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("receivable_payments")
    .select("id")
    .eq("receivable_id", receivableId)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  if (error) throwDataAccessError("check receivable payment history", error);
  return data !== null;
}

export async function listPaymentsByReceivable(
  receivableId: string,
): Promise<ReceivablePayment[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivable_payments")
    .select(
      "id, amount, currency, paid_at, method, reference, status, voided_at, void_reason, created_at",
    )
    .eq("receivable_id", receivableId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throwDataAccessError("list receivable payments", error);
  return (data ?? []).map((payment) => ({
    ...payment,
    amount: String(payment.amount),
  }));
}
