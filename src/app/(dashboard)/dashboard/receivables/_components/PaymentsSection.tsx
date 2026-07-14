"use client";

import { useActionState } from "react";
import { registerPaymentAction, type PaymentState } from "../payment-actions";
import { VoidPaymentButton } from "./VoidPaymentButton";
import type { ReceivablePayment } from "../queries";
import { formatMoney } from "@/lib/receivables/status";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/receivables/payments";
import { FieldError } from "@/components/forms/FieldError";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type Props = {
  receivableId: string;
  currency: string;
  balanceDue: string;
  status: string;
  payments: ReceivablePayment[];
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const initialState: PaymentState = {};

export function PaymentsSection({
  receivableId,
  currency,
  balanceDue,
  status,
  payments,
}: Props) {
  const bound = registerPaymentAction.bind(null, receivableId);
  const [state, formAction, pending] = useActionState(bound, initialState);

  const isSettled = status === "paid" || Number(balanceDue) <= 0;

  return (
    <section aria-labelledby="payments-heading" className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 id="payments-heading" className="text-sm font-semibold text-slate-900">
          Pagos
        </h2>
        <span className="text-xs text-slate-500">
          Saldo: {formatMoney(balanceDue, currency)}
        </span>
      </div>

      {/* Registrar pago — solo si queda saldo */}
      {isSettled ? (
        <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Esta cuenta está saldada. No hay saldo pendiente por cobrar.
        </div>
      ) : (
        <form
          action={formAction}
          noValidate
          className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          {state.message && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="amount" className={labelClass}>
                Monto del pago ({currency})
                <span aria-hidden="true" className="text-red-500 ml-0.5">
                  *
                </span>
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                required
                className={inputClass}
                placeholder="50000.00"
                aria-invalid={!!state.errors?.amount}
                aria-describedby={state.errors?.amount ? "amount-error" : undefined}
              />
              <FieldError id="amount-error" message={state.errors?.amount} />
            </div>
            <div>
              <label htmlFor="method" className={labelClass}>
                Método
                <span aria-hidden="true" className="text-red-500 ml-0.5">
                  *
                </span>
              </label>
              <select
                id="method"
                name="method"
                required
                defaultValue="cash"
                className={inputClass}
                aria-invalid={!!state.errors?.method}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel(m)}
                  </option>
                ))}
              </select>
              <FieldError id="method-error" message={state.errors?.method} />
            </div>
            <div>
              <label htmlFor="paid_at" className={labelClass}>
                Fecha del pago
              </label>
              <input
                id="paid_at"
                name="paid_at"
                type="date"
                defaultValue={today()}
                className={inputClass}
                aria-invalid={!!state.errors?.paid_at}
              />
              <FieldError id="paid_at-error" message={state.errors?.paid_at} />
            </div>
            <div>
              <label htmlFor="reference" className={labelClass}>
                Referencia{" "}
                <span className="text-xs font-normal text-slate-400">
                  (opcional)
                </span>
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                maxLength={200}
                className={inputClass}
                placeholder="N.º de comprobante"
                aria-invalid={!!state.errors?.reference}
              />
              <FieldError
                id="reference-error"
                message={state.errors?.reference}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Registrando…" : "Registrar pago"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de pagos */}
      {payments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            Todavía no se han registrado pagos.
          </p>
        </div>
      ) : (
        <ul
          role="list"
          className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
        >
          {payments.map((p) => {
            const voided = p.status === "voided";
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${voided ? "text-slate-400 line-through" : "text-slate-900"}`}
                  >
                    {formatMoney(p.amount, p.currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {paymentMethodLabel(p.method)} · {formatDate(p.paid_at)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                  {voided && p.void_reason && (
                    <p className="text-xs text-red-600">
                      Anulado: {p.void_reason}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {voided ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      Anulado
                    </span>
                  ) : (
                    <VoidPaymentButton
                      receivableId={receivableId}
                      paymentId={p.id}
                      amountLabel={formatMoney(p.amount, p.currency)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
