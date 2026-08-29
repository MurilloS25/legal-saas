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
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";

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
      <motion.div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
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
        <motion.div
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg"
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
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
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={pending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={tone === "danger" ? "destructive" : "accent"}
              onClick={onConfirm}
              disabled={pending}
              loading={pending}
              loadingText="Aplicando…"
              className="flex-1"
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
