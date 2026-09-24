"use client";

/**
 * Diálogo "Insertar bloque de opciones" / edición de un Bloque existente.
 *
 * Configura: nombre del bloque, una lista de variantes (etiqueta +
 * contenido con `{{clave.variable}}` opcional) y cuál variante es la
 * predeterminada. Reglas (ver `option-blocks.ts`): al menos una variante,
 * etiqueta no vacía por variante, contenido vacío permitido (la cláusula no
 * aparece en esa modalidad) si al menos una variante tiene contenido, y
 * exactamente una predeterminada. Sin código ni expresiones — solo texto
 * con placeholders.
 */

import { useId, useRef, useState } from "react";
import { FieldError } from "@/components/forms/FieldError";
import {
  attrsToDraft,
  buildOptionBlockAttrs,
  generateOptionId,
  type OptionBlockDraft,
  type OptionVariantDraft,
} from "@/lib/editor/option-blocks";
import type { TemplateOptionBlockAttrs } from "@/lib/editor/types";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import { suggestAutofillSource } from "../model/variable-autofill";
import { InsertVariableDialog } from "./InsertVariableDialog";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";

function emptyVariant(): OptionVariantDraft {
  return { id: generateOptionId(), label: "", contentText: "" };
}

function emptyDraft(): OptionBlockDraft {
  const first = emptyVariant();
  return {
    blockId: generateOptionId(),
    name: "",
    variants: [first],
    defaultVariantId: first.id,
  };
}

type Props = {
  /** Presente en modo edición; ausente al insertar un bloque nuevo. */
  initialAttrs?: TemplateOptionBlockAttrs;
  /**
   * `newVariables`: variables recién creadas desde "Insertar variable"
   * dentro de una variante (botón por variante, no el diálogo de revisión
   * post-guardado) — con su configuración completa (etiqueta, obligatoria,
   * transformación), lista para registrar. Se pasan por separado en vez de
   * llamar `onCreateVariable` de inmediato al crearlas: el contenido de la
   * variante donde se insertan todavía es un borrador local en este
   * diálogo, no el documento real, así que registrarlas antes de que
   * `onSave` actualice el documento dispararía la poda de variables sin
   * referencia (`TemplateWorkspace.tsx`) sobre una clave que, en ese
   * instante, el documento real todavía no contiene.
   */
  onSave: (
    attrs: TemplateOptionBlockAttrs,
    newVariables: TemplateWorkspaceVariable[],
  ) => void;
  /** Solo disponible en modo edición. */
  onDelete?: () => void;
  onClose: () => void;
  /** Variables configuradas del machote — para "Insertar variable" dentro
   * de una variante (elegir una existente o crear una nueva) sin salir del
   * diálogo del bloque. */
  variables: TemplateWorkspaceVariable[];
};

export function OptionBlockDialog({
  initialAttrs,
  onSave,
  onDelete,
  onClose,
  variables,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const nameId = useId();
  const isEditing = !!initialAttrs;

  const [draft, setDraft] = useState<OptionBlockDraft>(() =>
    initialAttrs ? attrsToDraft(initialAttrs) : emptyDraft(),
  );
  const [error, setError] = useState<string | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Variante en la que insertar la próxima variable elegida/creada en el
  // diálogo "Insertar variable" — el contenido de cada variante es un
  // `<input>` de texto plano, así que insertar es literalmente escribir
  // `{{clave}}` en la posición del cursor (última conocida, capturada en
  // `variantCursorRef` en cada cambio de selección).
  const [insertingVariableForVariant, setInsertingVariableForVariant] =
    useState<string | null>(null);
  // Variables nuevas creadas desde ese botón, con su configuración
  // completa, en espera de registrarse recién cuando se guarde el bloque —
  // ver el comentario de `onSave` en `Props`.
  const [pendingNewVariables, setPendingNewVariables] = useState<
    TemplateWorkspaceVariable[]
  >([]);
  const variantCursorRef = useRef<Record<string, number>>({});

  function updateVariant(id: string, patch: Partial<OptionVariantDraft>) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((v) =>
        v.id === id ? { ...v, ...patch } : v,
      ),
    }));
  }

  function trackVariantCursor(
    id: string,
    event: { currentTarget: HTMLInputElement },
  ) {
    variantCursorRef.current[id] =
      event.currentTarget.selectionStart ?? event.currentTarget.value.length;
  }

  function insertTokenIntoVariant(id: string, token: string) {
    const pos = variantCursorRef.current[id];
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((v) => {
        if (v.id !== id) return v;
        const at = pos ?? v.contentText.length;
        const nextText = v.contentText.slice(0, at) + token + v.contentText.slice(at);
        variantCursorRef.current[id] = at + token.length;
        return { ...v, contentText: nextText };
      }),
    }));
  }

  function addVariant() {
    setDraft((current) => ({
      ...current,
      variants: [...current.variants, emptyVariant()],
    }));
  }

  function removeVariant(id: string) {
    setDraft((current) => {
      const variants = current.variants.filter((v) => v.id !== id);
      const defaultVariantId =
        current.defaultVariantId === id
          ? (variants[0]?.id ?? "")
          : current.defaultVariantId;
      return { ...current, variants, defaultVariantId };
    });
  }

  function save() {
    const result = buildOptionBlockAttrs(
      draft,
      initialAttrs?.structuredOutput ?? null,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.attrs, pendingNewVariables);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
            return;
          }
          if (event.key !== "Tab") return;

          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {isEditing ? "Editar bloque de opciones" : "Insertar bloque de opciones"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Un fragmento que cambia entre variantes predefinidas. Cada
              variante puede usar variables normales con {"{{clave.variable}}"}.
            </p>
          </div>

          <div className="px-6 py-4 space-y-5">
            <div>
              <label htmlFor={nameId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre del bloque
              </label>
              <input
                id={nameId}
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                className={inputClass}
                placeholder="Ej: Chasis, VIN y Serie"
                autoFocus
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700 mb-2">
                Variantes
              </legend>
              <div className="space-y-4">
                {draft.variants.map((variant, index) => {
                  const labelId = `${variant.id}-label`;
                  const contentId = `${variant.id}-content`;
                  const defaultRadioId = `${variant.id}-default`;
                  return (
                    <div
                      key={variant.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-500">
                          Variante {index + 1}
                        </p>
                        {draft.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="text-xs font-medium text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                          >
                            Quitar variante
                          </button>
                        )}
                      </div>

                      <div>
                        <label htmlFor={labelId} className="block text-xs font-medium text-slate-700 mb-1">
                          Etiqueta de variante
                        </label>
                        <input
                          id={labelId}
                          type="text"
                          value={variant.label}
                          onChange={(event) =>
                            updateVariant(variant.id, { label: event.target.value })
                          }
                          className={inputClass}
                          placeholder="Ej: Todos distintos"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label htmlFor={contentId} className="block text-xs font-medium text-slate-700">
                            Contenido de variante
                          </label>
                          <button
                            type="button"
                            onClick={() => setInsertingVariableForVariant(variant.id)}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent-700 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Insertar variable
                          </button>
                        </div>
                        <input
                          id={contentId}
                          type="text"
                          value={variant.contentText}
                          onChange={(event) =>
                            updateVariant(variant.id, { contentText: event.target.value })
                          }
                          onSelect={(event) => trackVariantCursor(variant.id, event)}
                          onClick={(event) => trackVariantCursor(variant.id, event)}
                          onKeyUp={(event) => trackVariantCursor(variant.id, event)}
                          className={`${inputClass} font-mono text-xs`}
                          placeholder="Ej: CHASIS número {{vehiculo.chasis}} — vacío si el texto no aparece"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id={defaultRadioId}
                          type="radio"
                          name="defaultVariantId"
                          checked={draft.defaultVariantId === variant.id}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              defaultVariantId: variant.id,
                            }))
                          }
                          className="h-4 w-4 border-slate-300 text-accent-700 focus:ring-accent-500"
                        />
                        <label htmlFor={defaultRadioId} className="text-xs text-slate-700">
                          Variante predeterminada
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addVariant}
                className="mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar variante
              </button>
            </fieldset>

            <FieldError id={`${titleId}-error`} message={error} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <div>
              {isEditing && !confirmingDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                >
                  Eliminar bloque
                </button>
              )}
              {isEditing && confirmingDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">¿Eliminar este bloque?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                  >
                    Cancelar eliminación
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    Eliminar definitivamente
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
              >
                {isEditing ? "Guardar cambios" : "Insertar bloque"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {insertingVariableForVariant && (
        <InsertVariableDialog
          variables={[...variables, ...pendingNewVariables]}
          onInsertExisting={(variable) => {
            insertTokenIntoVariant(insertingVariableForVariant, `{{${variable.field_key}}}`);
            setInsertingVariableForVariant(null);
          }}
          onInsertNew={({ field_key, label, required, output_transform }) => {
            setPendingNewVariables((current) => [
              ...current,
              {
                field_key,
                label,
                required,
                autofill_source: suggestAutofillSource(field_key),
                output_transform,
              },
            ]);
            insertTokenIntoVariant(insertingVariableForVariant, `{{${field_key}}}`);
            setInsertingVariableForVariant(null);
          }}
          onClose={() => setInsertingVariableForVariant(null)}
        />
      )}
    </>
  );
}
