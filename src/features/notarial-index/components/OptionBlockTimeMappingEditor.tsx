"use client";

/**
 * Mapeo Hora/Minutos de un Bloque de opciones elegido como fuente de "Hora
 * de autorización" del Índice Notarial.
 *
 * El diálogo "Insertar/Editar bloque de opciones" del Machote ya no pregunta
 * por esto (ver `OptionBlockDialog.tsx`) — el usuario configura ahí solo lo
 * que le importa (nombre, variantes, contenido). Este mapeo se configura
 * desde aquí, en el Índice, que es quien realmente lo necesita: por cada
 * variante del bloque, cuál variable representa la hora y cuál los minutos
 * (o "00" fijo si no aplica). Ver `resolveOptionBlockTime` — el mapeo
 * persistido sigue viviendo en `optionBlock.attrs.structuredOutput`, dentro
 * del mismo `content_json` del Machote: `onSave` no dispara ninguna llamada
 * de red propia, solo actualiza el documento en memoria del editor
 * (`TemplateEditorHandle.updateOptionBlockStructuredOutput`) — persiste con
 * el guardado normal del Machote, evitando dos fuentes de verdad separadas
 * para el mismo `content_json`.
 *
 * Se remonta por completo cuando cambia el bloque elegido (el padre le pasa
 * `key={block.blockId}`) — así el estado local siempre arranca desde el
 * mapeo vigente de ESE bloque, sin sincronización manual.
 */

import { useId, useState } from "react";
import type {
  TemplateOptionBlockAttrs,
  TemplateTimeStructuredVariant,
} from "@/lib/editor/types";
import type { OptionBlockSummary } from "@/lib/editor/option-blocks";
import { Button } from "@/components/ui/Button";

const selectClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

type FieldLabel = { fieldKey: string; label: string };

type VariantDraft = {
  hourFieldKey: string;
  /** "" (sin elegir) se distingue de null (00 fijo, elección explícita). */
  minuteFieldKey: string | "__zero__" | "";
};

type Props = {
  block: OptionBlockSummary;
  fields: FieldLabel[];
  readOnly?: boolean;
  onSave: (
    blockId: string,
    structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
  ) => void;
};

function labelFor(fields: FieldLabel[], key: string): string {
  return fields.find((field) => field.fieldKey === key)?.label ?? key;
}

function initialDraft(block: OptionBlockSummary): Record<string, VariantDraft> {
  const draft: Record<string, VariantDraft> = {};
  for (const variant of block.variants) {
    const configured =
      block.structuredOutput?.type === "time"
        ? block.structuredOutput.variants.find(
            (item) => item.variantId === variant.id,
          )
        : undefined;
    draft[variant.id] = {
      hourFieldKey: configured?.hourFieldKey ?? "",
      minuteFieldKey:
        configured === undefined
          ? ""
          : (configured.minuteFieldKey ?? "__zero__"),
    };
  }
  return draft;
}

export function OptionBlockTimeMappingEditor({
  block,
  fields,
  readOnly = false,
  onSave,
}: Props) {
  const legendId = useId();
  const [draft, setDraft] = useState(() => initialDraft(block));
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function updateVariant(variantId: string, patch: Partial<VariantDraft>) {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      [variantId]: { ...current[variantId], ...patch },
    }));
  }

  function save() {
    const variants: TemplateTimeStructuredVariant[] = [];
    for (const variant of block.variants) {
      const entry = draft[variant.id];
      if (!entry || entry.hourFieldKey === "") {
        setError("Selecciona la variable de Hora en cada variante.");
        return;
      }
      variants.push({
        variantId: variant.id,
        hourFieldKey: entry.hourFieldKey,
        minuteFieldKey:
          entry.minuteFieldKey === "__zero__" || entry.minuteFieldKey === ""
            ? null
            : entry.minuteFieldKey,
      });
    }
    setError(undefined);
    onSave(block.blockId, variants.length > 0 ? { type: "time", variants } : null);
    setSaved(true);
  }

  return (
    <fieldset
      aria-labelledby={legendId}
      className="mt-3 rounded-xl border border-ink-200 bg-ink-100/30 p-3 space-y-3"
    >
      <legend id={legendId} className="px-1 text-xs font-medium text-ink-700">
        Hora de otorgamiento — {block.name}
      </legend>
      <p className="text-xs text-ink-500">
        Para cada variante, indica cuál variable representa la hora y cuál
        los minutos.
      </p>

      {block.variants.map((variant) => {
        const entry = draft[variant.id] ?? { hourFieldKey: "", minuteFieldKey: "" };
        const options = variant.variableKeys.map((key) => ({
          key,
          label: labelFor(fields, key),
        }));
        return (
          <div
            key={variant.id}
            className="rounded-lg border border-ink-200 bg-white p-3"
          >
            <p className="mb-2 text-xs font-medium text-ink-600">
              {variant.label}
            </p>
            {options.length === 0 ? (
              <p className="text-xs text-ink-500">
                Esta variante no tiene variables — agrega una en el paso
                Documento para poder mapearla aquí.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${variant.id}-time-hour`}
                    className="mb-1 block text-xs text-ink-700"
                  >
                    Hora
                  </label>
                  <select
                    id={`${variant.id}-time-hour`}
                    value={entry.hourFieldKey}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateVariant(variant.id, { hourFieldKey: event.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">Seleccionar variable</option>
                    {options.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${variant.id}-time-minute`}
                    className="mb-1 block text-xs text-ink-700"
                  >
                    Minutos
                  </label>
                  <select
                    id={`${variant.id}-time-minute`}
                    value={entry.minuteFieldKey}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateVariant(variant.id, {
                        minuteFieldKey: event.target
                          .value as VariantDraft["minuteFieldKey"],
                      })
                    }
                    className={selectClass}
                  >
                    <option value="__zero__">00 (hora en punto)</option>
                    {options.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={save}>
            Aplicar mapeo de hora
          </Button>
          {saved && (
            <p role="status" className="text-xs text-accent-700">
              Aplicado al machote — guarda los cambios (aquí o en el paso
              Documento) antes de guardar esta selección más abajo.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
