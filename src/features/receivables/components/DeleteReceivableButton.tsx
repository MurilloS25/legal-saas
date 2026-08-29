"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  deleteReceivableAction,
  type DeleteReceivableState,
} from "../server/actions";
import { Button } from "@/components/ui/Button";

type Props = {
  receivableId: string;
  concept: string;
};

export function DeleteReceivableButton({ receivableId, concept }: Props) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const boundDelete = deleteReceivableAction.bind(null, receivableId);
  const [state, formAction, pending] = useActionState<
    DeleteReceivableState,
    FormData
  >(boundDelete, {});
  const descriptionId = state.message
    ? "delete-receivable-desc delete-receivable-error"
    : "delete-receivable-desc";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar la cuenta ${concept}`}
        className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
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
              aria-labelledby="delete-receivable-title"
              aria-describedby={descriptionId}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                key="panel"
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
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-red-600"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </div>

                  <h2
                    id="delete-receivable-title"
                    className="text-base font-semibold text-ink-900 mb-2"
                  >
                    ¿Eliminar esta cuenta por cobrar?
                  </h2>
                  <p
                    id="delete-receivable-desc"
                    className="text-sm text-slate-600 leading-relaxed"
                  >
                    Se eliminará «{concept}» y su historial. Esta acción es
                    irreversible.
                  </p>
                  {state.message && (
                    <p
                      id="delete-receivable-error"
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {state.message}
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
                  <form action={formAction} className="flex-1">
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={pending}
                      loading={pending}
                      loadingText="Eliminando..."
                    >
                      Eliminar
                    </Button>
                  </form>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
