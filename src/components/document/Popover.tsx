"use client";

/**
 * Popover anclado, autocontenido (dueño de su propio trigger y estado
 * abierto/cerrado), para selectores compactos como "Cliente principal" o
 * una Parte autollenada.
 *
 * No existe ninguna librería headless de diálogos en este repo — sigue el
 * mismo patrón hand-rolled que ya usan `InsertVariableDialog` (ciclo de
 * foco con Tab) y `DocumentHistoryDialog` (foco al panel al abrir, foco de
 * regreso al trigger al cerrar). A diferencia de esos dos, que son overlays
 * de página completa, este es un panel anclado junto al trigger (mismo
 * patrón posicional que `OptionBlockPopover`, pero como componente
 * reutilizable con trigger propio en vez de estar anclado a un nodo del
 * documento).
 */

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  /** aria-label del panel, ej. "Seleccionar o cambiar cliente principal". */
  panelLabel: string;
  align?: "start" | "end";
  /** Recibe `close` para que el contenido pueda cerrar el popover tras una acción. */
  children: (close: () => void) => React.ReactNode;
};

export function Popover({
  triggerLabel,
  triggerClassName,
  panelLabel,
  align = "start",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const panelId = useId();

  // Todo el acceso a refs vive en este efecto, nunca en `close` (que se pasa
  // a `children` y se invoca durante el render de ese contenido) — así el
  // valor de las refs solo se lee en respuesta a eventos/efectos, nunca en
  // fase de render.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      panelRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [open]);

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={panelLabel}
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
          className={`absolute z-40 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg focus:outline-none ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
