/**
 * Hoja documental compartida.
 *
 * Renderiza el modelo de documento (`DocumentModel`) como una hoja blanca
 * con tipografía serif sobre un fondo gris, sin HTML inseguro: todo es
 * composición React de runs tipados. La usan el preview del workspace de
 * machotes y el compositor de escrituras.
 *
 * - Runs de texto aplican negrita/cursiva/subrayado.
 * - Variables resueltas muestran su valor integrado al texto.
 * - Variables pendientes se resaltan (color + borde, no solo color).
 * - Sin paginación real ni números de página fingidos.
 */

import type { DocumentModel, DocumentRun } from "@/lib/editor/render";

type Props = {
  model: DocumentModel;
  /**
   * Cómo mostrar variables pendientes: su etiqueta (preview de machote) o
   * la sintaxis `{{key}}` (compositor de escrituras).
   */
  pendingVariableDisplay?: "label" | "placeholder";
  /** Mensaje mostrado cuando el documento no tiene contenido. */
  emptyMessage?: string;
  /** Id de encabezado para aria-labelledby del contenedor con scroll. */
  "aria-labelledby"?: string;
};

function runText(run: DocumentRun, display: "label" | "placeholder"): string {
  switch (run.kind) {
    case "text":
      return run.text;
    case "variable":
      if (run.resolved) return run.value;
      return display === "label"
        ? (run.label?.trim() || run.key)
        : `{{${run.key}}}`;
    case "break":
      return "";
  }
}

function isModelEmpty(model: DocumentModel): boolean {
  return model.every((paragraph) => paragraph.runs.length === 0);
}

export function DocumentSheet({
  model,
  pendingVariableDisplay = "label",
  emptyMessage = "El documento aún no tiene contenido.",
  "aria-labelledby": ariaLabelledBy,
}: Props) {
  return (
    <div
      className="rounded-xl bg-slate-100 p-4 sm:p-6 lg:p-8 overflow-y-auto"
      role="group"
      aria-labelledby={ariaLabelledBy}
    >
      <div className="mx-auto w-full max-w-[42rem] min-h-[24rem] rounded-sm bg-white shadow-md ring-1 ring-slate-200 px-8 py-10 sm:px-12 sm:py-14">
        {isModelEmpty(model) ? (
          <p className="font-serif text-sm text-slate-400 italic">
            {emptyMessage}
          </p>
        ) : (
          <div className="font-serif text-[0.95rem] leading-7 text-slate-900">
            {model.map((paragraph, paragraphIndex) => (
              <p
                key={paragraphIndex}
                className="mb-4 last:mb-0 min-h-[1.75rem] whitespace-pre-wrap break-words"
              >
                {paragraph.runs.map((run, runIndex) => {
                  if (run.kind === "break") {
                    return <br key={runIndex} />;
                  }

                  if (run.kind === "variable" && !run.resolved) {
                    return (
                      <mark
                        key={runIndex}
                        data-variable-key={run.key}
                        className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-amber-900 font-sans text-[0.85em]"
                        title={`Variable pendiente: ${run.key}`}
                      >
                        {runText(run, pendingVariableDisplay)}
                      </mark>
                    );
                  }

                  const text = runText(run, pendingVariableDisplay);
                  if (run.kind === "variable") {
                    // Valor resuelto: parte natural del texto del documento.
                    return (
                      <span key={runIndex} data-variable-key={run.key}>
                        {text}
                      </span>
                    );
                  }

                  let content: React.ReactNode = text;
                  if (run.marks.bold) content = <strong>{content}</strong>;
                  if (run.marks.italic) content = <em>{content}</em>;
                  if (run.marks.underline) content = <u>{content}</u>;
                  return <span key={runIndex}>{content}</span>;
                })}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
