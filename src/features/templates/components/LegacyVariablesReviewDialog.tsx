"use client";

/**
 * Confirmación antes de convertir las variables pegadas detectadas.
 *
 * Este diálogo aparece para TODO `{{...}}` pegado con el alfabeto válido —
 * mayúsculas, minúsculas o mixto por igual, cuando `detectLegacyVariables`
 * encontró candidatas. No hay conversión silenciosa para ningún caso. El
 * usuario decide qué convertir y configura cada variable exactamente igual
 * que en el panel de Variables (etiqueta, clave, obligatoriedad,
 * transformación de salida) antes de aplicar; cancelar no modifica el
 * contenido pegado.
 */

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/forms/FieldError";
import { TEMPLATE_DOC_LIMITS } from "@/lib/editor/types";
import { FIELD_KEY_PATTERN } from "../model/template-fields";
import type { LegacyVariableMatch } from "@/lib/editor/legacy-variables";
import {
  VARIABLE_OUTPUT_TRANSFORMS,
  VARIABLE_OUTPUT_TRANSFORM_LABELS,
  type VariableOutputTransform,
} from "../model/variable-autofill";

const inputClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";

export type LegacyVariableSelection = {
  included: boolean;
  key: string;
  label: string;
  required: boolean;
  output_transform: VariableOutputTransform;
};

type Props = {
  matches: LegacyVariableMatch[];
  /** Claves ya configuradas — se muestran como aviso, no se sobrescriben. */
  configuredKeys: Set<string>;
  onConvert: (selections: Map<string, LegacyVariableSelection>) => void;
  onCancel: () => void;
  /** Título y texto introductorio — reemplaza el copy pensado para pegado
   * cuando este diálogo se reutiliza para otra fuente de variables nuevas
   * (p. ej. un Bloque de opciones recién guardado, donde los nodos YA
   * existen en el documento — "no se agregan automáticamente" sería
   * incorrecto ahí). */
  title?: string;
  description?: React.ReactNode;
  /** `false` cuando la clave ya existe como nodo real en el documento (un
   * Bloque de opciones, por ejemplo) — editarla aquí solo cambiaría la
   * configuración, no el nodo, dejando una clave huérfana. Paste sigue
   * pudiendo editarla porque ahí el nodo todavía no existe. */
  keyEditable?: boolean;
};

export function LegacyVariablesReviewDialog({
  matches,
  configuredKeys,
  onConvert,
  onCancel,
  title = "Revisar variables detectadas",
  description,
  keyEditable = true,
}: Props) {
  const titleId = useId();
  const [selections, setSelections] = useState<
    Map<string, LegacyVariableSelection>
  >(
    () =>
      new Map(
        matches.map((match) => [
          match.raw,
          {
            included: true,
            key: match.key,
            label: match.label,
            required: false,
            output_transform: "none" as VariableOutputTransform,
          },
        ]),
      ),
  );
  const [error, setError] = useState<string | undefined>();

  function update(raw: string, patch: Partial<LegacyVariableSelection>) {
    setSelections((current) => {
      const next = new Map(current);
      const entry = current.get(raw);
      if (!entry) return current;
      next.set(raw, { ...entry, ...patch });
      return next;
    });
  }

  function handleConvert() {
    for (const [, selection] of selections) {
      if (!selection.included) continue;
      const key = selection.key.trim();
      const label = selection.label.trim();
      if (
        key === "" ||
        key.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength ||
        !FIELD_KEY_PATTERN.test(key)
      ) {
        setError(
          "Revisa las claves: usa minúsculas, números, guion bajo y puntos simples.",
        );
        return;
      }
      if (label === "") {
        setError("Cada variable incluida necesita una etiqueta.");
        return;
      }
    }
    onConvert(selections);
  }

  const includedCount = [...selections.values()].filter(
    (s) => s.included,
  ).length;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-ink-100 bg-white shadow-ink-lg animate-scale-in">
          <div className="px-6 pt-5 pb-4 border-b border-ink-100">
            <h2 id={titleId} className="text-base font-semibold text-ink-900">
              {title}
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              {description ?? (
                <>
                  Se detectaron {matches.length} posibles{" "}
                  {matches.length === 1 ? "variable" : "variables"} en el
                  contenido pegado con formato{" "}
                  <code className="font-mono">{"{{ }}"}</code>. Configura cada
                  una antes de convertirla — no se agregan al documento
                  automáticamente.
                </>
              )}
            </p>
          </div>

          <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-3">
            {matches.map((match) => {
              const selection = selections.get(match.raw);
              if (!selection) return null;
              const alreadyConfigured = configuredKeys.has(selection.key);

              return (
                <div
                  key={match.raw}
                  className="rounded-lg border border-ink-100 px-3 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selection.included}
                      onChange={(event) =>
                        update(match.raw, { included: event.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-ink-200 text-accent-700 focus:ring-accent-500"
                      aria-label={`Incluir variable ${match.raw}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs text-ink-400">
                        Detectado: <code className="font-mono">{`{{${match.raw}}}`}</code>
                        {alreadyConfigured && (
                          <span className="ml-2 text-amber-700">
                            (ya existe una variable configurada con esta clave)
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-ink-700 mb-1">
                            Etiqueta
                          </label>
                          <input
                            type="text"
                            value={selection.label}
                            disabled={!selection.included}
                            onChange={(event) =>
                              update(match.raw, { label: event.target.value })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-700 mb-1">
                            Clave
                          </label>
                          <input
                            type="text"
                            value={selection.key}
                            disabled={!selection.included || !keyEditable}
                            onChange={(event) =>
                              update(match.raw, { key: event.target.value })
                            }
                            className={inputClass + " font-mono text-xs"}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id={`${match.raw}-required`}
                          type="checkbox"
                          checked={selection.required}
                          disabled={!selection.included}
                          onChange={(event) =>
                            update(match.raw, { required: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-ink-200 text-accent-700 focus:ring-accent-500"
                          aria-label={`Variable obligatoria ${match.raw}`}
                        />
                        <label
                          htmlFor={`${match.raw}-required`}
                          className="text-sm text-ink-700"
                        >
                          Variable obligatoria
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink-700 mb-1">
                          Transformación de salida
                        </label>
                        <select
                          value={selection.output_transform}
                          disabled={!selection.included}
                          onChange={(event) =>
                            update(match.raw, {
                              output_transform: event.target
                                .value as VariableOutputTransform,
                            })
                          }
                          aria-label={`Transformación de salida ${match.raw}`}
                          className={inputClass}
                        >
                          {VARIABLE_OUTPUT_TRANSFORMS.map((transform) => (
                            <option key={transform} value={transform}>
                              {VARIABLE_OUTPUT_TRANSFORM_LABELS[transform]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <FieldError id={`${titleId}-error`} message={error} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-6 py-4">
            <p className="text-xs text-ink-400">
              {includedCount} de {matches.length} seleccionadas
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleConvert}
                disabled={includedCount === 0}
              >
                Convertir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
