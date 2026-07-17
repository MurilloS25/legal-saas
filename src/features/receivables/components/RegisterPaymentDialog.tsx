"use client";

/**
 * Diálogo modal para registrar un pago.
 *
 * El envío sigue usando la Server Action existente (`registerPaymentAction`),
 * que redirige a la propia página al terminar: un envío exitoso navega de
 * vuelta a la pestaña Pagos, lo que remonta este componente con `open`
 * en su valor inicial (`false`) — el diálogo se cierra solo, sin estado
 * adicional. Un error mantiene el diálogo abierto (no hay redirect) y
 * muestra el mensaje dentro del formulario.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useActionState } from "react";
import {
  registerPaymentAction,
  type PaymentState,
} from "../server/payment-actions";
import { formatMoney } from "../model/status";
import { PAYMENT_METHODS, paymentMethodLabel } from "../model/payments";
import { FieldError } from "@/components/forms/FieldError";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type Props = {
  receivableId: string;
  currency: string;
  balanceDue: string;
};

const initialState: PaymentState = {};

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RegisterPaymentDialog({
  receivableId,
  currency,
  balanceDue,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const bound = registerPaymentAction.bind(null, receivableId);
  const [state, formAction, pending] = useActionState(bound, initialState);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function close() {
    if (pending) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
      >
        Registrar pago
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={dialogRef}
            tabIndex={-1}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close();
                return;
              }

              if (event.key !== "Tab") return;

              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              );
              if (focusable.length === 0) return;

              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!last) return;

              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <h2
                  id={titleId}
                  className="text-base font-semibold text-slate-900"
                >
                  Registrar pago
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saldo pendiente: {formatMoney(balanceDue, currency)}
                </p>
              </div>

              <form action={formAction} noValidate className="px-6 py-4">
                {state.message && (
                  <div
                    role="alert"
                    className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                  >
                    {state.message}
                  </div>
                )}
                <div className="space-y-4">
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
                      autoFocus
                      className={inputClass}
                      placeholder="50000.00"
                      aria-invalid={!!state.errors?.amount}
                      aria-describedby={
                        state.errors?.amount ? "amount-error" : undefined
                      }
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

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {pending ? "Registrando…" : "Registrar pago"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
