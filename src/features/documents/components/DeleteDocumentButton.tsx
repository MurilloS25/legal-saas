"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  deleteDocumentDraftAction,
  type DeleteDocumentState,
} from "../server/content-actions";

type Props = {
  documentId: string;
  documentTitle: string;
};

export function DeleteDocumentButton({ documentId, documentTitle }: Props) {
  const [open, setOpen] = useState(false);
  const boundDelete = deleteDocumentDraftAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<
    DeleteDocumentState,
    FormData
  >(boundDelete, {});

  // Tras un borrado exitoso la fila desaparece con la revalidación;
  // derivar el cierre evita un setState dentro de un effect.
  const showDialog = open && !state.success;

  const descriptionId = state.message
    ? "delete-document-dialog-desc delete-document-dialog-error"
    : "delete-document-dialog-desc";
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar ${documentTitle}`}
        className="press-feedback flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
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
      {showDialog && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-document-dialog-title"
            aria-describedby={descriptionId}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg">
              <div className="px-6 pt-6 pb-4 text-center">
                <h2
                  id="delete-document-dialog-title"
                  className="text-base font-semibold text-ink-900 mb-2"
                >
                  ¿Eliminar el borrador {documentTitle}?
                </h2>
                <p
                  id="delete-document-dialog-desc"
                  className="text-sm text-ink-600 leading-relaxed"
                >
                  El borrador se eliminará de forma permanente. Esta acción es
                  irreversible.
                </p>
                {state.message && (
                  <p
                    id="delete-document-dialog-error"
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {state.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="press-feedback flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  Cancelar
                </button>
                <form action={formAction} className="flex-1">
                  <button
                    type="submit"
                    disabled={pending}
                    className="press-feedback w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Eliminando..." : "Eliminar"}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </>
  );
}
