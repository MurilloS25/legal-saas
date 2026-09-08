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

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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

  // `align` es una preferencia (anclar a la izquierda o derecha del
  // trigger), no una garantía — en un viewport angosto (móvil) un trigger
  // cerca de un borde puede dejar el panel parcialmente fuera de pantalla.
  // Se mide después de montar y se corrige con un `translateX` puntual, sin
  // tocar el CSS de posicionamiento base (que sigue funcionando igual en
  // desktop, donde nunca hace falta corregir nada).
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Un viewport de 0×0 (pestaña oculta, no visible aún) daría un shift
    // sin sentido — sin esto la corrección quedaría corrupta hasta el
    // siguiente open/close.
    if (!panel || window.innerWidth <= 0) return;
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) {
      shift = window.innerWidth - margin - rect.right;
    }
    panel.style.transform = shift !== 0 ? `translateX(${shift}px)` : "";
  }, [open]);

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (!panelRef.current) return;
      if (panelRef.current.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      // Un diálogo anidado (ej. `CreateClientDialog`, que monta su propio
      // modal vía `createPortal` a `document.body`) vive fuera del árbol DOM
      // de `panelRef`, así que `contains` nunca lo reconoce como "adentro".
      // Cualquier clic dentro de un `role="dialog"` ajeno se trata como
      // interacción legítima, no como clic-afuera — si no, este popover se
      // cerraría (y desmontaría el diálogo anidado) antes de que su propio
      // submit termine de procesarse.
      if (target.closest?.('[role="dialog"]')) return;
      close();
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
