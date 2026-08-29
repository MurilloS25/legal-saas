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
 *   inline: un clic las convierte en un <input> que edita el valor crudo
 *   (`values[key]`); sin foco, muestran el valor ya renderizado (con su
 *   transformación aplicada, si tiene una configurada). Sin `onChangeValue`
 *   el comportamiento es el de solo lectura de siempre (preview de
 *   Machote).
 * - Un Bloque de opciones se muestra con su variante ya resuelta (texto y
 *   variables normales, igualmente editables inline); en modo editable
 *   agrega un botón compacto que abre un popover para cambiar de variante.
 * - Sin paginación real ni números de página fingidos.
 */

"use client";

import { useMemo, useState } from "react";
import type { DocumentModel, DocumentRun } from "@/lib/editor/render";
import {
  findAdjacentVariableOccurrence,
  type VariableOccurrence,
} from "@/lib/editor/variable-navigation";
import { OptionBlockPopover } from "./OptionBlockPopover";

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
  /** Valores crudos (sin transformar) por `field_key`, para el modo edición. */
  values?: Record<string, string>;
  /** Id de la aparición visual actualmente en edición inline. */
  editingNodeId?: string;
  /**
   * Si se define, las variables se vuelven editables inline: un clic las
   * pone en modo edición (ver `editingKey`).
   */
  onStartEdit?: (nodeId: string, variableKey: string) => void;
  /** Cambia el valor crudo de la variable en edición. */
  onChangeValue?: (key: string, value: string) => void;
  /** Sale del modo edición (blur, Escape, o Tab sin siguiente variable). */
  onStopEdit?: () => void;
  /** Cambia la variante elegida de un Bloque de opciones. Solo con edición. */
  onSelectVariant?: (blockId: string, variantId: string) => void;
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
    case "optionBlock":
      return run.runs.map((child) => runText(child, display)).join("");
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
  values,
  editingNodeId,
  onStartEdit,
  onChangeValue,
  onStopEdit,
  onSelectVariant,
}: Props) {
  const editable = !!onChangeValue;
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);

  const orderedOccurrences = useMemo(() => {
    if (!editable) return [];
    const occurrences: VariableOccurrence[] = [];
    function visit(run: DocumentRun) {
      if (run.kind === "variable") {
        occurrences.push({ nodeId: run.nodeId, variableKey: run.key });
      }
      else if (run.kind === "optionBlock") run.runs.forEach(visit);
    }
    for (const paragraph of model) {
      for (const run of paragraph.runs) visit(run);
    }
    return occurrences;
  }, [model, editable]);

  function moveToAdjacent(currentNodeId: string, direction: 1 | -1) {
    const next = findAdjacentVariableOccurrence(
      orderedOccurrences,
      currentNodeId,
      direction,
    );
    if (next) {
      onStartEdit?.(next.nodeId, next.variableKey);
    } else {
      onStopEdit?.();
    }
  }

  function renderRun(run: DocumentRun, key: string): React.ReactNode {
    if (run.kind === "break") {
      return <br key={key} />;
    }

    if (run.kind === "variable" && editable) {
      if (run.nodeId === editingNodeId) {
        const rawValue = values?.[run.key] ?? "";
        return (
          <input
            key={key}
            type="text"
            autoFocus
            ref={(element) => {
              element?.scrollIntoView({ block: "center", behavior: "smooth" });
            }}
            value={rawValue}
            onChange={(event) => onChangeValue!(run.key, event.target.value)}
            onBlur={() => onStopEdit?.()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onStopEdit?.();
              } else if (event.key === "Tab") {
                event.preventDefault();
                moveToAdjacent(run.nodeId, event.shiftKey ? -1 : 1);
              }
            }}
            style={{ width: `${inputWidthCh(rawValue)}ch` }}
            data-variable-key={run.key}
            aria-label={run.label?.trim() || run.key}
            className="inline-block rounded border-b-2 border-accent-500 bg-accent-50 px-1 py-0.5 font-sans text-[0.85em] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        );
      }

      const displayText = runText(run, pendingVariableDisplay);
      const editableClass = run.resolved
        ? "cursor-text rounded-sm border-b border-dotted border-ink-400 transition-colors duration-150 hover:border-accent-500 hover:bg-accent-50/60"
        : "cursor-text rounded-sm border-b-2 border-dashed border-accent-400 px-0.5 font-sans text-[0.85em] italic text-accent-700 transition-colors duration-150 hover:bg-accent-50";
      return (
        <button
          key={key}
          type="button"
          data-variable-key={run.key}
          onClick={(event) => {
            event.stopPropagation();
            onStartEdit!(run.nodeId, run.key);
          }}
          aria-label={`Editar ${run.label?.trim() || run.key}`}
          className={`${editableClass} focus:outline-none focus:ring-2 focus:ring-accent-500`}
        >
          {displayText}
        </button>
      );
    }

    if (run.kind === "variable" && !run.resolved) {
      const pendingClass =
        "rounded border px-1 py-0.5 font-sans text-[0.85em] border-amber-300 bg-amber-50 text-amber-900";
      const pendingText = runText(run, pendingVariableDisplay);

      return (
        <mark
          key={key}
          data-variable-key={run.key}
          className={pendingClass}
          title={`Variable pendiente: ${run.key}`}
        >
          {pendingText}
        </mark>
      );
    }

    if (run.kind === "variable") {
      // Valor resuelto, solo lectura: parte natural del texto del documento.
      const text = runText(run, pendingVariableDisplay);
      return (
        <span key={key} data-variable-key={run.key}>
          {text}
        </span>
      );
    }

    if (run.kind === "optionBlock") {
      const isOpen = openBlockId === run.blockId;
      const selectedLabel =
        run.variants.find((v) => v.id === run.selectedVariantId)?.label ?? run.name;

      return (
        <span
          key={key}
          className="relative inline rounded border-b-2 border-dashed border-accent-300 bg-accent-50/40"
        >
          {run.runs.map((child, index) => renderRun(child, `${key}-${index}`))}
          {editable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenBlockId(isOpen ? null : run.blockId);
              }}
              aria-haspopup="true"
              aria-expanded={isOpen}
              aria-label={`Cambiar variante de ${run.name} (actual: ${selectedLabel})`}
              title={`Bloque: ${run.name}`}
              className="ml-0.5 rounded px-0.5 font-sans text-[0.75em] text-accent-700 hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              ▾
            </button>
          )}
          {editable && isOpen && (
            <OptionBlockPopover
              blockName={run.name}
              variants={run.variants}
              selectedVariantId={run.selectedVariantId}
              onSelect={(variantId) => {
                onSelectVariant?.(run.blockId, variantId);
                setOpenBlockId(null);
              }}
              onClose={() => setOpenBlockId(null)}
            />
          )}
        </span>
      );
    }

    // Texto fijo: nunca editable. Aplica marcas de formato.
    const text = runText(run, pendingVariableDisplay);
    let content: React.ReactNode = text;
    if (run.marks.bold) content = <strong>{content}</strong>;
    if (run.marks.italic) content = <em>{content}</em>;
    if (run.marks.underline) content = <u>{content}</u>;
    return <span key={key}>{content}</span>;
  }

  return (
    <div
      className="rounded-xl bg-ink-100/70 p-4 sm:p-6 lg:p-8 overflow-y-auto"
      role="group"
      aria-labelledby={ariaLabelledBy}
    >
      <div className="relative mx-auto w-full max-w-[42rem]">
        {/* Hojas apiladas detrás de la principal — puramente decorativo
            (aria-hidden, no participa en el layout de contenido), refuerza
            la idea de "hoja de papel" sin tocar el contenedor real debajo. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-3 -bottom-1.5 top-1.5 rounded-[2px] bg-white shadow-ink-sm ring-1 ring-ink-100"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-1.5 -bottom-0.5 top-0.5 rounded-[2px] bg-white shadow-ink-sm ring-1 ring-ink-100"
        />
        <div className="relative min-h-[24rem] rounded-[2px] bg-white shadow-ink-lg ring-1 ring-ink-100 px-8 py-10 sm:px-12 sm:py-14">
          {isModelEmpty(model) ? (
            <p className="font-serif text-sm text-ink-400 italic">{emptyMessage}</p>
          ) : (
            <div className="font-serif text-[0.95rem] leading-7 text-ink-900">
              {model.map((paragraph, paragraphIndex) => (
                <p
                  key={paragraphIndex}
                  className="mb-4 last:mb-0 min-h-[1.75rem] whitespace-pre-wrap break-words"
                >
                  {paragraph.runs.map((run, runIndex) =>
                    renderRun(run, String(runIndex)),
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
