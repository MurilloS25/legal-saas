"use client";

import { useActionState, useState } from "react";
import {
  deleteTemplateFieldAction,
  type DeleteTemplateFieldState,
} from "../actions";

// ------------------------------------------------------------------ props

type Props = {
  fieldId: string;
  templateId: string;
  fieldLabel: string;
};

// ------------------------------------------------------------------ component

export function DeleteTemplateFieldButton({
  fieldId,
  templateId,
  fieldLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const boundDelete = deleteTemplateFieldAction.bind(null, fieldId, templateId);
  const [state, formAction, pending] = useActionState<
    DeleteTemplateFieldState,
    FormData
  >(boundDelete, {});

  // Tras un borrado exitoso la fila desaparece con la revalidación;
  // derivar el cierre evita un setState dentro de un effect.
  const showDialog = open && !state.success;

  const descriptionId = state.message
    ? "delete-field-dialog-desc delete-field-dialog-error"
    : "delete-field-dialog-desc";

  return (
    <>
      {/* ---- Trigger ---- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar ${fieldLabel}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      {/* ---- Confirmation dialog ---- */}
      {showDialog && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-field-dialog-title"
            aria-describedby={descriptionId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-600"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </div>

                <h2
                  id="delete-field-dialog-title"
                  className="text-base font-semibold text-slate-900 mb-2"
                >
                  ¿Eliminar el campo {fieldLabel}?
                </h2>
                <p
                  id="delete-field-dialog-desc"
                  className="text-sm text-slate-600 leading-relaxed"
                >
                  El campo se eliminará del machote. Esta acción es
                  irreversible.
                </p>
                {state.message && (
                  <p
                    id="delete-field-dialog-error"
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {state.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
                >
                  Cancelar
                </button>
                <form action={formAction} className="flex-1">
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    {pending ? "Eliminando..." : "Eliminar"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
