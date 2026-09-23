"use client";

/**
 * Modal informativo: cómo preparar un machote con ayuda de una herramienta
 * de IA externa (ChatGPT, Claude, Gemini, etc.).
 *
 * Puramente frontend — no hay integración con ningún proveedor de IA.
 * LexCR no llama ninguna API externa, no envía el documento ni el prompt a
 * ningún servicio, y no almacena nada de esto: el único efecto de este
 * componente es copiar un texto estático al portapapeles del usuario.
 *
 * Sigue el mismo patrón de diálogo (backdrop + focus trap + Escape) que
 * `InsertVariableDialog`, sin introducir ninguna librería nueva.
 */

import { useEffect, useId, useRef, useState } from "react";
import { MACHOTE_AI_HELP_PROMPT } from "../model/ai-help-prompt";

type Props = {
  onClose: () => void;
};

export function AiHelpDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  // Sin esto, el foco se queda en el botón que abrió el modal (fuera del
  // subárbol del diálogo) y Escape/Tab nunca llegan al onKeyDown de abajo.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(MACHOTE_AI_HELP_PROMPT);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
            return;
          }

          if (event.key !== "Tab") return;

          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Crea tu machote con ayuda de IA
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">
              Si prefieres usar tu propia herramienta, puedes preparar una
              primera versión compatible con LexCR en ChatGPT, Claude,
              Gemini u otra. Para que LexCR lo haga por ti, usa «Crear con
              IA» en la lista de Machotes.
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800">
                1
              </span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  Copia este prompt
                </p>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Copiar prompt
                </button>
                <p role="status" className="text-xs text-accent-700 min-h-4">
                  {copyStatus === "copied" && "Prompt copiado"}
                  {copyStatus === "error" &&
                    "No se pudo copiar. Selecciona y copia el texto manualmente."}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800">
                2
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  Ábrelo en tu IA favorita
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pega el contenido de una escritura existente, o adjunta el
                  documento directamente si la herramienta lo permite.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800">
                3
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  Trae el resultado a LexCR
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pega el machote generado en el editor y revisa las
                  variables detectadas antes de guardar.
                </p>
              </div>
            </div>

            <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              Evita compartir información personal, confidencial o sensible
              con servicios externos si no estás autorizado para hacerlo.
              LexCR no envía documentos ni datos a servicios de inteligencia
              artificial desde esta opción.
            </p>
          </div>

          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
