"use client";

/**
 * Diálogo de confirmación accesible compartido — extraído de
 * `DocumentStatusControls` para reutilizarlo en cualquier acción que
 * necesite una confirmación explícita en vez de `window.confirm()` (nativo,
 * sin estilo, sin foco gestionado). Focus trap, Escape, y un slot opcional
 * de error para mostrar el resultado de una acción fallida sin cerrar el
 * diálogo.
 */

import { useEffect, useId, useRef } from "react";

export type ConfirmDialogProps = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Estilo del botón de confirmar. "danger" para acciones que reducen
   * visibilidad/alcance (excluir, etc.); "primary" (default) para el resto. */
  tone?: "primary" | "danger";
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onClose,
  tone = "primary",
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={dialogRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled])",
            ) ?? [],
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="px-6 pt-6 pb-4">
            <h2 id={titleId} className="text-base font-semibold text-slate-900 mb-2">
              {title}
            </h2>
            <p id={descId} className="text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${
                tone === "danger"
                  ? "bg-red-700 hover:bg-red-800 focus:ring-red-500"
                  : "bg-accent-700 hover:bg-accent-800 focus:ring-accent-500"
              }`}
            >
              {pending ? "Aplicando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
