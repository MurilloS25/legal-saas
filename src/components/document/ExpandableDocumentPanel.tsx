"use client";

/**
 * Overlay de pantalla casi completa (≈95vw/92vh) para expandir la vista
 * previa del documento, siguiendo el patrón "Modal centrado" ya usado en el
 * resto de la app (mismo manejo de foco que `DocumentHistoryDialog`: guarda
 * el elemento con foco al abrir y se lo devuelve al cerrar; `Escape` y clic
 * en el fondo cierran).
 *
 * `DocumentSheet` no guarda estado de edición propio más allá de un popover
 * de variante de Bloque de opciones (todo lo demás — valores, campo en
 * edición — llega por props desde el componente padre). Por eso este panel
 * puede recibir el mismo `children` (la misma llamada a `DocumentSheet` con
 * los mismos props) que ya se renderiza en línea, sin arriesgar pérdida de
 * ediciones: aunque el nodo se vuelva a montar al expandir, los valores
 * siguen viviendo en el estado del padre.
 */

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function ExpandableDocumentPanel({ open, onClose, title, children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    }
  }, [open]);

  function close() {
    onClose();
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== "Tab") return;

          const focusable = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        className="flex h-[92vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-ink-lg focus:outline-none"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 bg-ink-100/40 px-5 py-3.5">
          <h2 id={titleId} className="text-sm font-semibold text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            title="Cerrar"
            className="press-feedback rounded-full bg-ink-100 p-1.5 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
