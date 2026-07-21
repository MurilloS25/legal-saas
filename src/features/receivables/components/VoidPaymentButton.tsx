"use client";

import { useActionState, useState } from "react";
import {
  voidPaymentAction,
  type VoidPaymentState,
} from "../server/payment-actions";

type Props = {
  receivableId: string;
  paymentId: string;
  amountLabel: string;
};

export function VoidPaymentButton({
  receivableId,
  paymentId,
  amountLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const bound = voidPaymentAction.bind(null, receivableId, paymentId);
  const [state, formAction, pending] = useActionState<VoidPaymentState, FormData>(
    bound,
    {},
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
      >
        Anular
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="void-payment-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <form
              action={formAction}
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="px-6 pt-6 pb-4">
                <h2
                  id="void-payment-title"
                  className="text-base font-semibold text-slate-900 mb-1"
                >
                  Anular pago de {amountLabel}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  El pago se conserva marcado como anulado. Indica el motivo.
                </p>
                <label
                  htmlFor="void-reason"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Motivo de la anulación
                  <span aria-hidden="true" className="text-red-500 ml-0.5">
                    *
                  </span>
                </label>
                <textarea
                  id="void-reason"
                  name="reason"
                  required
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Error de digitación, pago revertido…"
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "void-reason-error" : undefined}
                />
                {state.error && (
                  <p
                    id="void-reason-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {state.error}
                  </p>
                )}
              </div>
              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {pending ? "Anulando…" : "Anular pago"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
