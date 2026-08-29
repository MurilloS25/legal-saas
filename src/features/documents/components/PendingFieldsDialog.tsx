"use client";

/**
 * Resumen de variables pendientes de la Escritura, en el orden en que
 * aparecen en el documento (mismo orden que ya calcula
 * `findUnresolvedDocumentVariables`/`activeKeys` — no se construye un nuevo
 * tracking). Con 3 o menos pendientes se listan los nombres directamente;
 * con más, solo el total + dos acciones ("Ir al primer pendiente" salta de
 * inmediato, "Ver campos pendientes" abre esta lista completa en un modal).
 *
 * Saltar a un campo reutiliza el mismo mecanismo de foco/scroll que ya usa
 * "Siguiente pendiente" en el compositor (`onGoToField` termina fijando
 * `editingTarget`, que `DocumentSheet` ya sabe llevar a la vista) — no se
 * construye un segundo mecanismo de scroll.
 */

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type PendingField = { key: string; label: string };

type Props = {
  pendingFields: PendingField[];
  onGoToField: (key: string) => void;
};

const COMPACT_THRESHOLD = 3;

export function PendingFieldsDialog({ pendingFields, onGoToField }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (pendingFields.length === 0) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        Todos los campos están completos.
      </p>
    );
  }

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (pendingFields.length <= COMPACT_THRESHOLD) {
    return (
      <p className="text-sm text-ink-600">
        Pendientes:{" "}
        {pendingFields.map((field, index) => (
          <span key={field.key}>
            {index > 0 && ", "}
            <button
              type="button"
              onClick={() => onGoToField(field.key)}
              className="font-medium text-accent-700 underline-offset-2 hover:underline focus:outline-none focus:underline"
            >
              {field.label}
            </button>
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink-600">
        {pendingFields.length} campos pendientes
      </p>
      <button
        type="button"
        onClick={() => onGoToField(pendingFields[0]!.key)}
        className="text-sm font-medium text-accent-700 hover:text-accent-800 focus:outline-none focus-visible:underline"
      >
        Ir al primer pendiente →
      </button>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-ink-600 hover:text-ink-900 focus:outline-none focus-visible:underline"
      >
        Ver campos pendientes
      </button>

      <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={dialogRef}
            tabIndex={-1}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close();
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              );
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg">
              <div className="px-6 pt-5 pb-4 border-b border-ink-100">
                <h2 id={titleId} className="text-base font-semibold text-ink-900">
                  Campos pendientes
                </h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  En el orden en que aparecen en el documento.
                </p>
              </div>
              <ul className="max-h-80 overflow-y-auto px-2 py-2">
                {pendingFields.map((field) => (
                  <li key={field.key}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onGoToField(field.key);
                      }}
                      className="block w-full rounded-lg px-4 py-2.5 text-left text-sm text-ink-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                    >
                      {field.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end border-t border-ink-100 px-6 py-3">
                <button
                  type="button"
                  onClick={close}
                  className="press-feedback rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
