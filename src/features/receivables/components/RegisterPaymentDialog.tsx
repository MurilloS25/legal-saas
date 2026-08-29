"use client";

/**
 * Panel lateral (slide-over) para registrar un pago. Antes era un diálogo
 * modal centrado; se convirtió en panel deslizante desde la derecha porque
 * registrar un pago es una acción que se repite muchas veces, sobre
 * distintas cuentas, en una misma sesión — un panel de herramienta persiste
 * mejor que una interrupción centrada. El formulario, su validación y la
 * llamada a la server action no cambiaron: solo el contenedor visual.
 *
 * Modo estándar (sin `embedded`): usa `registerPaymentAction`, que redirige
 * a la propia página al terminar — un envío exitoso navega de vuelta a la
 * pestaña Pagos, lo que remonta este componente con `open` en su valor
 * inicial (`false`); el diálogo se cierra solo, sin estado adicional.
 *
 * Modo `embedded` (usado desde el paso "Cobro" de una Escritura): usa
 * `registerPaymentForDialogAction`, que nunca redirige — este componente
 * cierra el diálogo por su cuenta y llama a `onRegistered` para que el
 * origen (la Escritura) refresque su resumen sin abandonar la página.
 *
 * En ambos casos, un error mantiene el diálogo abierto y muestra el mensaje
 * dentro del formulario.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  registerPaymentAction,
  registerPaymentForDialogAction,
  type PaymentState,
} from "../server/payment-actions";
import { formatMoney } from "../model/status";
import { PAYMENT_METHODS, paymentMethodLabel } from "../model/payments";
import { FieldError } from "@/components/forms/FieldError";
import { Button } from "@/components/ui/Button";
import { WalletIcon, XIcon } from "@/app/(dashboard)/_components/icons";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50 transition-colors";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type Props = {
  receivableId: string;
  currency: string;
  balanceDue: string;
} & (
  | { embedded?: false; documentId?: undefined; onRegistered?: undefined }
  | { embedded: true; documentId: string; onRegistered: () => void }
);

const initialState: PaymentState = {};

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RegisterPaymentDialog(props: Props) {
  const { receivableId, currency, balanceDue } = props;
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const bound = props.embedded
    ? registerPaymentForDialogAction.bind(null, receivableId, props.documentId)
    : registerPaymentAction.bind(null, receivableId);
  const [state, formAction, pending] = useActionState(bound, initialState);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const lastHandled = useRef<PaymentState | null>(null);
  useEffect(() => {
    if (props.embedded && state.success && lastHandled.current !== state) {
      lastHandled.current = state;
      props.onRegistered();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function close() {
    if (pending) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="accent"
        onClick={() => setOpen(true)}
      >
        Registrar pago
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-ink-950/45"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              key="panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              ref={dialogRef}
              tabIndex={-1}
              className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-ink-lg focus:outline-none"
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
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-6 py-5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <WalletIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-ink-900"
                  >
                    Registrar pago
                  </h2>
                  <p className="font-mono text-xs tabular-nums text-slate-500 mt-0.5">
                    Saldo pendiente: {formatMoney(balanceDue, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar panel de pago"
                  className="press-feedback flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                >
                  <XIcon className="size-4" />
                </button>
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
                        className={`${inputClass} font-mono tabular-nums`}
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
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={close}
                      disabled={pending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="accent"
                      disabled={pending}
                      loading={pending}
                      loadingText="Registrando…"
                    >
                      Registrar pago
                    </Button>
                  </div>
                </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
