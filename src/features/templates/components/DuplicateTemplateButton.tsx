"use client";

import { useActionState, useId, useState } from "react";
import { duplicateTemplateAction } from "../server/duplicate-actions";
import type { DuplicateTemplateState } from "../model/action-state";

type Props = {
  templateId: string;
  templateName: string;
};

/**
 * "Duplicar machote" desde el listado. Mismo patrón que Duplicar
 * escritura: confirmación breve y la acción del servidor redirige al
 * editor del Machote nuevo (en borrador). Solo se muestra con
 * `templates.write`; el servidor vuelve a validar el permiso.
 */
export function DuplicateTemplateButton({ templateId, templateName }: Props) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const boundDuplicate = duplicateTemplateAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState<
    DuplicateTemplateState,
    FormData
  >(boundDuplicate, {});

  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Duplicar machote ${templateName}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-accent-50 hover:text-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-1 transition-colors"
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
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => !pending && setOpen(false)}
          />

          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !pending) setOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="px-6 pt-6 pb-4 text-center">
                <h2 id={titleId} className="text-base font-semibold text-slate-900 mb-2">
                  ¿Duplicar {templateName}?
                </h2>
                <p id={descId} className="text-sm text-slate-600 leading-relaxed">
                  Se creará un machote nuevo en borrador con el mismo
                  documento, variables, bloques de opciones y configuración
                  del Índice. El original no se modifica.
                </p>
                {state.message && (
                  <p
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
                  autoFocus
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Cancelar
                </button>
                <form action={formAction} className="flex-1">
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    {pending ? "Duplicando…" : "Duplicar"}
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
