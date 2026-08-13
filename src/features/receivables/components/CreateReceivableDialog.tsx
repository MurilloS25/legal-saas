"use client";

/**
 * Diálogo modal para crear una cuenta por cobrar sin abandonar el
 * formulario de origen (paso "Cobro" de una Escritura). Reutiliza
 * `ReceivableForm` en su modo "dialog" — misma validación, mismo Server
 * Action (`createReceivableForDialogAction`, que nunca redirige) y mismos
 * campos que el flujo completo de Cuentas por cobrar.
 *
 * El trigger vive dentro del `<form>` de la Escritura, así que el diálogo
 * (con su propio `<form>`) se monta vía `createPortal` en `document.body`
 * — un `<form>` no puede anidarse dentro de otro `<form>` en HTML válido.
 * Mismo patrón que `CreateClientDialog`.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReceivableForm } from "./ReceivableForm";
import type { ClientOption, DocumentOption } from "../model/types";
import type { ReceivableState } from "../server/actions";

type Props = {
  clients: ClientOption[];
  documents: DocumentOption[];
  defaults?: { client_id?: string; document_id?: string };
  onCreated: (receivable: NonNullable<ReceivableState["receivable"]>) => void;
};

export function CreateReceivableDialog({
  clients,
  documents,
  defaults,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleCreated(receivable: NonNullable<ReceivableState["receivable"]>) {
    setOpen(false);
    onCreated(receivable);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
      >
        Crear cuenta por cobrar
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={close}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              ref={dialogRef}
              tabIndex={-1}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  close();
                  return;
                }

                if (event.key !== "Tab") return;

                const focusable = Array.from(
                  dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                  ) ?? [],
                );
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (!last) return;

                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                  <h2 id={titleId} className="text-base font-semibold text-slate-900">
                    Crear cuenta por cobrar
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Queda asociada a esta escritura y a su cliente.
                  </p>
                </div>
                <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                  <ReceivableForm
                    mode="dialog"
                    clients={clients}
                    documents={documents}
                    defaults={defaults}
                    onCreated={handleCreated}
                    onCancel={close}
                  />
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
