import type { ReceivablePayment } from "../model/types";
import { formatMoney } from "../model/status";
import { PaymentsTable } from "./PaymentsTable";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WalletIcon, CheckCircleIcon } from "@/app/(dashboard)/_components/icons";

type Props = {
  receivableId: string;
  currency: string;
  balanceDue: string;
  status: string;
  payments: ReceivablePayment[];
  canRegisterPayments: boolean;
  canVoidPayments: boolean;
};

export function PaymentsSection({
  receivableId,
  currency,
  balanceDue,
  status,
  payments,
  canRegisterPayments,
  canVoidPayments,
}: Props) {
  const isSettled = status === "paid" || Number(balanceDue) <= 0;

  return (
    <section aria-labelledby="payments-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="payments-heading" className="text-sm font-semibold text-ink-900">
          Pagos
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-slate-500">
            Saldo: {formatMoney(balanceDue, currency)}
          </span>
          {!isSettled && canRegisterPayments && (
            <RegisterPaymentDialog
              receivableId={receivableId}
              currency={currency}
              balanceDue={balanceDue}
            />
          )}
        </div>
      </div>

      {isSettled && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircleIcon className="size-4 shrink-0" />
          Esta cuenta está saldada. No hay saldo pendiente por cobrar.
        </div>
      )}

      {/* Lista de pagos */}
      {payments.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="size-5" />}
          title="Todavía no se han registrado pagos."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <PaymentsTable
            receivableId={receivableId}
            rows={payments}
            canVoid={canVoidPayments}
          />
        </Card>
      )}
    </section>
  );
}
