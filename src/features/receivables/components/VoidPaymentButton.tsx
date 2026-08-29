"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  voidPaymentAction,
  type VoidPaymentState,
} from "../server/payment-actions";
import { Button } from "@/components/ui/Button";

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
  const reduceMotion = useReducedMotion();
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
        className="press-feedback rounded-lg px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
      >
        Anular
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="void-payment-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.form
                key="panel"
                action={formAction}
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.95, y: 8 }
                }
                animate={
                  reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
                }
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.97, y: 4 }
                }
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="px-6 pt-6 pb-4">
                  <h2
                    id="void-payment-title"
                    className="text-base font-semibold text-ink-900 mb-1"
                  >
                    Anular pago de{" "}
                    <span className="font-mono tabular-nums">{amountLabel}</span>
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
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
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={pending}
                    loading={pending}
                    loadingText="Anulando…"
                  >
                    Anular pago
                  </Button>
                </div>
              </motion.form>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
