"use client";

/**
 * Diálogo modal para crear un Cliente sin abandonar el formulario de
 * origen (Escritura o Cuenta por cobrar). A diferencia de otros diálogos
 * con Server Action (p. ej. `RegisterPaymentDialog`), esta acción nunca
 * redirige: al terminar con éxito, este componente cierra el diálogo por
 * su cuenta y notifica al formulario de origen vía `onCreated`, que decide
 * cómo seleccionarlo — el formulario de origen nunca se remonta ni pierde
 * sus propios cambios sin guardar.
 *
 * El trigger vive dentro del formulario de Escritura/Cuenta, así que el
 * propio diálogo (con su `<form>`) se monta vía `createPortal` en
 * `document.body`: un `<form>` no puede anidarse dentro de otro `<form>`
 * en HTML válido (el navegador lo rompe silenciosamente), y aquí sí hay
 * un formulario ancestro real, a diferencia de otros diálogos existentes
 * que siempre viven fuera de cualquier `<form>`.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActionState } from "react";
import {
  createClientForDialogAction,
} from "../server/actions";
import type {
  ClientDialogState,
  CreatedClient,
} from "../model/action-state";
import { ClientFields } from "./ClientFields";

type Props = {
  onCreated: (client: CreatedClient) => void;
};

const initialState: ClientDialogState = {};

export function CreateClientDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [state, formAction, pending] = useActionState(
    createClientForDialogAction,
    initialState,
  );

  const lastHandled = useRef<ClientDialogState | null>(null);
  useEffect(() => {
    if (state.success && state.client && lastHandled.current !== state) {
      lastHandled.current = state;
      onCreated(state.client);
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function close() {
    if (pending) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-accent-700 hover:text-accent-800 focus:outline-none focus:underline"
      >
        + Crear nuevo cliente
      </button>

      {open &&
        createPortal(
          <>
          {/* Este diálogo se abre casi siempre DESDE otro ya abierto
              (Cuenta por cobrar, Partes/Cliente principal de una Escritura)
              — z-index una capa por encima del estándar del repo (z-40/z-50)
              para taparlo por completo en vez de competir visualmente con
              él, incluso si ambos comparten el mismo `document.body`. */}
          <div
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={dialogRef}
            tabIndex={-1}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            onKeyDown={(event) => {
              // React reenvía eventos sintéticos según el árbol de React, no
              // el DOM — al estar este diálogo anidado (vía props/JSX)
              // dentro de otro ya abierto (p. ej. "Crear cuenta por
              // cobrar"), sin cortar la propagación aquí un mismo Escape
              // burbujea también hasta el onKeyDown del diálogo padre y lo
              // cierra a él también, aunque ambos estén en portales
              // distintos del DOM real.
              event.stopPropagation();

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
                  Crear nuevo cliente
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Se agregará a tus clientes y quedará seleccionado aquí.
                </p>
              </div>

              <form
                action={formAction}
                noValidate
                className="px-6 py-4 max-h-[70vh] overflow-y-auto"
              >
                {state.message && !state.errors && (
                  <div
                    role="alert"
                    className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                  >
                    {state.message}
                  </div>
                )}

                <div className="space-y-4">
                  <ClientFields
                    idPrefix="dialog_"
                    errors={state.errors}
                    autoFocus
                    addressRows={2}
                    gapClass="gap-4"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {pending ? "Creando…" : "Crear cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          </>,
          document.body,
        )}
    </>
  );
}
