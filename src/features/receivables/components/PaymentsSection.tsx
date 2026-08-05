import type { ReceivablePayment } from "../model/types";
import { formatMoney } from "../model/status";
import { PaymentsTable } from "./PaymentsTable";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";

type Props = {
  receivableId: string;
  currency: string;
  balanceDue: string;
  status: string;
  payments: ReceivablePayment[];
  paidJustNow?: boolean;
  canRegisterPayments: boolean;
  canVoidPayments: boolean;
};

export function PaymentsSection({
  receivableId,
  currency,
  balanceDue,
  status,
  payments,
  paidJustNow,
  canRegisterPayments,
  canVoidPayments,
}: Props) {
  const isSettled = status === "paid" || Number(balanceDue) <= 0;

  return (
    <section aria-labelledby="payments-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="payments-heading" className="text-sm font-semibold text-slate-900">
          Pagos
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
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

      {paidJustNow && (
        <div
          role="status"
          className="mb-4 rounded-lg bg-accent-50 border border-accent-200 px-4 py-3 text-sm text-accent-800"
        >
          Pago registrado.
        </div>
      )}

      {isSettled && (
        <div className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
          Esta cuenta está saldada. No hay saldo pendiente por cobrar.
        </div>
      )}

      {/* Lista de pagos */}
      {payments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            Todavía no se han registrado pagos.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <PaymentsTable
            receivableId={receivableId}
            rows={payments}
            canVoid={canVoidPayments}
          />
        </div>
      )}
    </section>
  );
}
