"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  duplicateDocumentAction,
  type DuplicateDocumentState,
} from "../server/duplicate-actions";

type Props = {
  documentId: string;
  documentTitle: string;
  /** "compact" para la lista (solo ícono); "full" para el header del compositor. */
  variant?: "compact" | "full";
};

export function DuplicateDocumentButton({
  documentId,
  documentTitle,
  variant = "compact",
}: Props) {
  const [open, setOpen] = useState(false);
  const boundDuplicate = duplicateDocumentAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<
    DuplicateDocumentState,
    FormData
  >(boundDuplicate, {});
  const prefersReducedMotion = useReducedMotion();

  const triggerClass =
    variant === "compact"
      ? "press-feedback flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-accent-50 hover:text-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1"
      : "press-feedback inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 shrink-0";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          variant === "compact" ? `Duplicar ${documentTitle}` : undefined
        }
        className={triggerClass}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={variant === "compact" ? 15 : 16}
          height={variant === "compact" ? 15 : 16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {variant === "full" && "Duplicar"}
      </button>

      <AnimatePresence>
      {open && (
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
            aria-labelledby="duplicate-document-dialog-title"
            aria-describedby="duplicate-document-dialog-desc"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg">
              <div className="px-6 pt-6 pb-4 text-center">
                <h2
                  id="duplicate-document-dialog-title"
                  className="text-base font-semibold text-ink-900 mb-2"
                >
                  ¿Duplicar {documentTitle}?
                </h2>
                <p
                  id="duplicate-document-dialog-desc"
                  className="text-sm text-ink-600 leading-relaxed"
                >
                  Se creará un borrador nuevo con el mismo contenido y
                  valores. El original no se modifica.
                </p>
                {state.message && (
                  <p
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
                    className="press-feedback w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Duplicando..." : "Duplicar"}
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
