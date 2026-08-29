"use client";

/**
 * Variables del machote — vista unificada.
 *
 * Reemplaza la separación entre "campos del machote" y "variables
 * detectadas": una sola lista combina la configuración y el uso real en el
 * contenido. Estados:
 *
 * - Configurada:            tiene configuración y aparece en el contenido.
 * - Pendiente de configurar: aparece en el contenido sin configuración.
 *
 * El contenido del Machote es la única fuente de verdad de qué variables
 * existen: una variable configurada cuya última referencia se borró del
 * documento deja de aparecer aquí (y de enviarse al guardar) — no hay
 * estado "No utilizada" que la mantenga huérfana. Si el usuario la necesita
 * de nuevo, la vuelve a escribir/insertar como si fuera nueva; preferible a
 * acumular configuración vieja que puede chocar con una recreación futura.
 * Ver `TemplateWorkspace.tsx` (poda de `variables` en cada cambio de
 * contenido) — este archivo solo construye la fila a partir de lo que ya
 * llega filtrado.
 */

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import {
  VARIABLE_AUTOFILL_SOURCE_LABELS,
  VARIABLE_OUTPUT_TRANSFORMS,
  VARIABLE_OUTPUT_TRANSFORM_LABELS,
  suggestAutofillSource,
  type VariableAutofillSource,
  type VariableOutputTransform,
} from "../model/variable-autofill";

export type VariableRowStatus = "configured" | "pending";

export type VariableRow = {
  field_key: string;
  label?: string;
  required: boolean;
  status: VariableRowStatus;
  autofill_source: VariableAutofillSource;
  output_transform: VariableOutputTransform;
};

// Ejemplo corto para que "Dígitos en palabras" y "Número completo en
// palabras" no se confundan entre sí — mismo valor de entrada (125), salida
// real de `applyVariableTransform` (ver src/lib/editor/text-transforms.ts),
// no un ejemplo inventado.
const OUTPUT_TRANSFORM_EXAMPLES: Partial<Record<VariableOutputTransform, string>> = {
  digits_to_words: "Ejemplo: 125 → UNO DOS CINCO",
  number_to_words: "Ejemplo: 125 → CIENTO VEINTICINCO",
};

const STATUS_UI: Record<
  VariableRowStatus,
  { label: string; tone: "success" | "warning" }
> = {
  configured: {
    // Estado positivo real (la variable está lista) → verde semántico,
    // no el acento decorativo.
    label: "Configurada",
    tone: "success",
  },
  pending: {
    label: "Pendiente de configurar",
    tone: "warning",
  },
};

/**
 * Une la configuración local con las variables presentes en el contenido.
 * Una variable configurada cuya clave ya no está en `contentKeys` se omite
 * por completo (ver comentario de módulo) — el llamador (`TemplateWorkspace`)
 * es responsable de podar `configured` del mismo modo antes de guardar, para
 * que lo mostrado y lo persistido nunca diverjan.
 */
export function buildVariableRows(
  configured: TemplateWorkspaceVariable[],
  contentKeys: string[],
): VariableRow[] {
  const contentKeySet = new Set(contentKeys);
  const configuredKeys = new Set(configured.map((v) => v.field_key));

  const rows: VariableRow[] = configured
    .filter((variable) => contentKeySet.has(variable.field_key))
    .map((variable) => ({
      field_key: variable.field_key,
      label: variable.label,
      required: variable.required,
      status: "configured" as const,
      autofill_source: variable.autofill_source,
      output_transform: variable.output_transform,
    }));

  for (const key of contentKeys) {
    if (!configuredKeys.has(key)) {
      rows.push({
        field_key: key,
        required: false,
        status: "pending",
        autofill_source: suggestAutofillSource(key),
        output_transform: "none",
      });
    }
  }

  return rows;
}

// ------------------------------------------------------------------ row editor

type RowEditorProps = {
  row: VariableRow;
  onSave: (
    label: string,
    required: boolean,
    outputTransform: VariableOutputTransform,
  ) => void;
  onCancel: () => void;
};

function RowEditor({ row, onSave, onCancel }: RowEditorProps) {
  const labelId = useId();
  const requiredId = useId();
  const errorId = useId();
  const transformId = useId();
  const [label, setLabel] = useState(row.label ?? "");
  const [required, setRequired] = useState(row.required);
  const [outputTransform, setOutputTransform] = useState(row.output_transform);
  const [error, setError] = useState<string | undefined>();

  function save() {
    const trimmed = label.trim();
    if (trimmed === "") {
      setError("La etiqueta de la variable es requerida.");
      return;
    }
    onSave(trimmed, required, outputTransform);
  }

  return (
    <div className="mt-3 animate-scale-in rounded-lg border border-ink-100 bg-ink-100/30 px-3 py-3 space-y-3">
      <div>
        <label
          htmlFor={labelId}
          className="block text-xs font-medium text-ink-700 mb-1"
        >
          Etiqueta
        </label>
        <input
          id={labelId}
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
          placeholder="Ej: Nombre del comprador"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          autoFocus
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={requiredId}
          type="checkbox"
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
        />
        <label htmlFor={requiredId} className="text-sm text-ink-700">
          Variable obligatoria
        </label>
      </div>

      <div>
        <label
          htmlFor={transformId}
          className="block text-xs font-medium text-ink-700 mb-1"
        >
          Transformación de salida
        </label>
        <select
          id={transformId}
          value={outputTransform}
          onChange={(event) =>
            setOutputTransform(event.target.value as VariableOutputTransform)
          }
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
        >
          {VARIABLE_OUTPUT_TRANSFORMS.map((transform) => (
            <option key={transform} value={transform}>
              {VARIABLE_OUTPUT_TRANSFORM_LABELS[transform]}
            </option>
          ))}
        </select>
        {OUTPUT_TRANSFORM_EXAMPLES[outputTransform] && (
          <p className="mt-1 text-xs text-ink-400">
            {OUTPUT_TRANSFORM_EXAMPLES[outputTransform]}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="accent" size="sm" onClick={save}>
          Guardar variable
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ panel

type Props = {
  variables: TemplateWorkspaceVariable[];
  contentKeys: string[];
  onChange: (variables: TemplateWorkspaceVariable[]) => void;
  /**
   * Cuando se pasa, "Guardar variable" persiste de inmediato (envía el
   * formulario del workspace) en vez de solo actualizar el estado local —
   * ver `TemplateWorkspace.tsx`. Sin esta prop (modo creación, donde el
   * machote todavía no existe), el guardado sigue siendo local hasta el
   * submit final.
   */
  onSaveVariable?: (variables: TemplateWorkspaceVariable[]) => void;
  /** templates.write — sin este permiso la lista es de solo lectura: no se
   * puede configurar, editar ni quitar ninguna variable. */
  readOnly?: boolean;
};

export function TemplateVariablesPanel({
  variables,
  contentKeys,
  onChange,
  onSaveVariable,
  readOnly = false,
}: Props) {
  const headingId = useId();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const rows = buildVariableRows(variables, contentKeys);

  function upsertVariable(
    field_key: string,
    label: string,
    required: boolean,
    autofill_source: VariableAutofillSource,
    output_transform: VariableOutputTransform,
  ) {
    const exists = variables.some((v) => v.field_key === field_key);
    const next = {
      field_key,
      label,
      required,
      autofill_source,
      output_transform,
    };
    const nextList = exists
      ? variables.map((v) => (v.field_key === field_key ? next : v))
      : [...variables, next];
    if (onSaveVariable) {
      onSaveVariable(nextList);
    } else {
      onChange(nextList);
    }
    setEditingKey(null);
  }

  function removeVariable(field_key: string) {
    onChange(variables.filter((v) => v.field_key !== field_key));
    setEditingKey(null);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-ink-100 bg-white shadow-ink-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-ink-100 bg-ink-100/40">
        <h2 id={headingId} className="text-sm font-semibold text-ink-900">
          Variables del machote
        </h2>
        <p className="text-xs text-ink-400">
          Datos que se solicitarán al preparar una escritura. Las variables
          del contenido sin configurar aparecen como pendientes.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-ink-400">
          Aún no hay variables. Usa «Insertar variable» en el editor para
          agregar la primera.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((row) => {
            const statusUi = STATUS_UI[row.status];
            const isEditing = editingKey === row.field_key;

            return (
              <li key={row.field_key} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    {row.label ? (
                      <p className="text-sm font-medium text-ink-900">
                        {row.label}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-ink-400 italic">
                        Sin etiqueta
                      </p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-700">
                        {`{{${row.field_key}}}`}
                      </code>
                      {row.status !== "pending" && (
                        <span className="text-xs text-ink-400">
                          {row.required ? "Obligatoria" : "Opcional"}
                        </span>
                      )}
                      {row.autofill_source !== "none" && (
                        <span className="text-xs text-ink-400">
                          · Autollenado: {VARIABLE_AUTOFILL_SOURCE_LABELS[row.autofill_source]}
                        </span>
                      )}
                      {row.output_transform !== "none" && (
                        <span className="text-xs text-ink-400">
                          · {VARIABLE_OUTPUT_TRANSFORM_LABELS[row.output_transform]}
                        </span>
                      )}
                    </p>
                  </div>

                  <Badge tone={statusUi.tone}>{statusUi.label}</Badge>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setEditingKey(isEditing ? null : row.field_key)}
                      aria-expanded={isEditing}
                      aria-label={`${row.status === "pending" ? "Configurar" : "Editar"} variable ${row.field_key}`}
                      className="press-feedback rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 transition-colors"
                    >
                      {row.status === "pending" ? "Configurar" : "Editar"}
                    </button>
                  )}

                  {!readOnly && row.status !== "pending" && (
                    <button
                      type="button"
                      onClick={() => removeVariable(row.field_key)}
                      aria-label={`Quitar configuración de ${row.field_key}`}
                      className="press-feedback rounded-lg px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {isEditing && (
                  <RowEditor
                    row={row}
                    onSave={(label, required, outputTransform) =>
                      upsertVariable(
                        row.field_key,
                        label,
                        required,
                        row.autofill_source,
                        outputTransform,
                      )
                    }
                    onCancel={() => setEditingKey(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
