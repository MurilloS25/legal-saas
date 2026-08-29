"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  deleteClientAction,
  type DeleteClientState,
} from "../server/actions";
import { Button } from "@/components/ui/Button";

// ------------------------------------------------------------------ props

type Props = {
  clientId: string;
  clientName: string;
  /** "icon" — icono trash pequeño para la fila del listado (default).
   *  "button" — botón de texto para la zona de riesgo del detalle. */
  variant?: "icon" | "button";
};

// ------------------------------------------------------------------ component

export function DeleteClientButton({
  clientId,
  clientName,
  variant = "icon",
}: Props) {
  const [open, setOpen] = useState(false);
  const boundDelete = deleteClientAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<DeleteClientState, FormData>(
    boundDelete,
    {},
  );
  const descriptionId = state.message
    ? "delete-dialog-desc delete-dialog-error"
    : "delete-dialog-desc";
  const reducedMotion = useReducedMotion();

  return (
    <>
      {/* ---- Trigger ---- */}
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={`Eliminar ${clientName}`}
          className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
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
      ) : (
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Eliminar cliente
        </Button>
      )}

      {/* ---- Confirmation dialog ---- */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />

            {/* Dialog */}
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              aria-describedby={descriptionId}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 4 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                {/* Icon */}
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
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
                    id="delete-dialog-title"
                    className="mb-2 text-base font-semibold text-ink-900"
                  >
                    ¿Eliminar a {clientName}?
                  </h2>
                  <p
                    id="delete-dialog-desc"
                    className="text-sm leading-relaxed text-slate-600"
                  >
                    Eliminar este cliente es irreversible. Los documentos
                    generados no se ven afectados.
                  </p>
                  {state.message && (
                    <p
                      id="delete-dialog-error"
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {state.message}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <form action={formAction} className="flex-1">
                    <Button
                      type="submit"
                      variant="destructive"
                      loading={pending}
                      loadingText="Eliminando…"
                      className="w-full"
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
