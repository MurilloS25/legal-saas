/**
 * Hoja documental compartida.
 *
 * Renderiza el modelo de documento (`DocumentModel`) como una hoja blanca
 * con tipografía serif sobre un fondo gris, sin HTML inseguro: todo es
 * composición React de runs tipados. La usan el preview del workspace de
 * machotes y el compositor de escrituras.
 *
 * - Runs de texto aplican negrita/cursiva/subrayado (siempre solo lectura:
 *   el texto fijo del Machote nunca es editable aquí).
 * - Cuando se pasa `onChangeValue`, las variables se vuelven editables
 *   inline: un clic las convierte en un `<input>` que edita el valor crudo
 *   (`values[key]`); sin foco, muestran el valor ya renderizado (con su
 *   transformación aplicada, si tiene una configurada). Sin `onChangeValue`
 *   el comportamiento es el de solo lectura de siempre (preview de
 *   Machote).
 * - Sin paginación real ni números de página fingidos.
 */

import { useMemo } from "react";
import type { DocumentModel, DocumentRun } from "@/lib/editor/render";
import { findAdjacentVariableKey } from "@/lib/editor/variable-navigation";

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
  /** Variable a resaltar (p. ej. el campo enfocado en el panel lateral). */
  highlightKey?: string;
  /** Valores crudos (sin transformar) por `field_key`, para el modo edición. */
  values?: Record<string, string>;
  /** Clave de la variable actualmente en modo edición inline. */
  editingKey?: string;
  /**
   * Si se define, las variables se vuelven editables inline: un clic las
   * pone en modo edición (ver `editingKey`).
   */
  onStartEdit?: (key: string) => void;
  /** Cambia el valor crudo de la variable en edición. */
  onChangeValue?: (key: string, value: string) => void;
  /** Sale del modo edición (blur, Escape, o Tab sin siguiente variable). */
  onStopEdit?: () => void;
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

/** Ancho aproximado del input en `ch`, acotado para no romper el layout. */
function inputWidthCh(value: string): number {
  return Math.min(Math.max(value.length, 3) + 1, 60);
}

export function DocumentSheet({
  model,
  pendingVariableDisplay = "label",
  emptyMessage = "El documento aún no tiene contenido.",
  "aria-labelledby": ariaLabelledBy,
  highlightKey,
  values,
  editingKey,
  onStartEdit,
  onChangeValue,
  onStopEdit,
}: Props) {
  const editable = !!onChangeValue;

  const orderedKeys = useMemo(() => {
    if (!editable) return [];
    const keys: string[] = [];
    for (const paragraph of model) {
      for (const run of paragraph.runs) {
        if (run.kind === "variable") keys.push(run.key);
      }
    }
    return keys;
  }, [model, editable]);

  function moveToAdjacent(currentKey: string, direction: 1 | -1) {
    const next = findAdjacentVariableKey(orderedKeys, currentKey, direction);
    if (next) {
      onStartEdit?.(next);
    } else {
      onStopEdit?.();
    }
  }

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

                  const highlighted =
                    run.kind === "variable" && run.key === highlightKey;

                  if (run.kind === "variable" && editable) {
                    if (run.key === editingKey) {
                      const rawValue = values?.[run.key] ?? "";
                      return (
                        <input
                          key={runIndex}
                          type="text"
                          autoFocus
                          value={rawValue}
                          onChange={(event) =>
                            onChangeValue!(run.key, event.target.value)
                          }
                          onBlur={() => onStopEdit?.()}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              onStopEdit?.();
                            } else if (event.key === "Tab") {
                              event.preventDefault();
                              moveToAdjacent(run.key, event.shiftKey ? -1 : 1);
                            }
                          }}
                          style={{ width: `${inputWidthCh(rawValue)}ch` }}
                          data-variable-key={run.key}
                          aria-label={run.label?.trim() || run.key}
                          className="inline-block rounded border-b-2 border-accent-500 bg-accent-50 px-1 py-0.5 font-sans text-[0.85em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                      );
                    }

                    const displayText = runText(run, pendingVariableDisplay);
                    const editableClass = run.resolved
                      ? "cursor-text rounded-sm border-b border-dotted border-slate-400 hover:border-accent-500 hover:bg-accent-50/60"
                      : "cursor-text rounded-sm border-b-2 border-dashed border-accent-400 px-0.5 font-sans text-[0.85em] italic text-accent-700 hover:bg-accent-50";
                    const highlightClass = highlighted
                      ? "bg-accent-100 ring-2 ring-accent-300"
                      : "";

                    return (
                      <button
                        key={runIndex}
                        type="button"
                        data-variable-key={run.key}
                        onClick={() => onStartEdit!(run.key)}
                        aria-label={`Editar ${run.label?.trim() || run.key}`}
                        className={`${editableClass} ${highlightClass} focus:outline-none focus:ring-2 focus:ring-accent-500`}
                      >
                        {displayText}
                      </button>
                    );
                  }

                  if (run.kind === "variable" && !run.resolved) {
                    const pendingClass = `rounded border px-1 py-0.5 font-sans text-[0.85em] ${
                      highlighted
                        ? "border-accent-500 bg-accent-50 text-accent-900 ring-2 ring-accent-300"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`;
                    const pendingText = runText(run, pendingVariableDisplay);

                    return (
                      <mark
                        key={runIndex}
                        data-variable-key={run.key}
                        className={pendingClass}
                        title={`Variable pendiente: ${run.key}`}
                      >
                        {pendingText}
                      </mark>
                    );
                  }

                  const text = runText(run, pendingVariableDisplay);
                  if (run.kind === "variable") {
                    // Valor resuelto: parte natural del texto del documento.
                    return (
                      <span
                        key={runIndex}
                        data-variable-key={run.key}
                        className={
                          highlighted
                            ? "rounded bg-accent-100 ring-2 ring-accent-300"
                            : undefined
                        }
                      >
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
