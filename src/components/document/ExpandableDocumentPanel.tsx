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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
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
        className="flex h-[92vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            title="Cerrar"
            className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
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
