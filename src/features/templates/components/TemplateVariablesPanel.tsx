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
 * - No utilizada:            tiene configuración pero no está en el contenido.
 *
 * Todos los cambios son locales; se persisten con el guardado del
 * workspace. Quitar una variable del texto nunca elimina su configuración:
 * eliminarla es siempre una decisión explícita del usuario.
 */

import { useId, useState } from "react";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import {
  VARIABLE_AUTOFILL_SOURCES,
  VARIABLE_AUTOFILL_SOURCE_LABELS,
  VARIABLE_OUTPUT_TRANSFORMS,
  VARIABLE_OUTPUT_TRANSFORM_LABELS,
  suggestAutofillSource,
  type VariableAutofillSource,
  type VariableOutputTransform,
} from "../model/variable-autofill";

export type VariableRowStatus = "configured" | "pending" | "unused";

export type VariableRow = {
  field_key: string;
  label?: string;
  required: boolean;
  status: VariableRowStatus;
  autofill_source: VariableAutofillSource;
  output_transform: VariableOutputTransform;
};

const STATUS_UI: Record<
  VariableRowStatus,
  { label: string; className: string }
> = {
  configured: {
    // Estado positivo real (la variable está lista) → verde semántico,
    // no el acento decorativo.
    label: "Configurada",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  pending: {
    label: "Pendiente de configurar",
    className: "bg-amber-50 text-amber-800 border border-amber-300",
  },
  unused: {
    label: "No utilizada",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
  },
};

/** Une la configuración local con las variables presentes en el contenido. */
export function buildVariableRows(
  configured: TemplateWorkspaceVariable[],
  contentKeys: string[],
): VariableRow[] {
  const contentKeySet = new Set(contentKeys);
  const configuredKeys = new Set(configured.map((v) => v.field_key));

  const rows: VariableRow[] = configured.map((variable) => ({
    field_key: variable.field_key,
    label: variable.label,
    required: variable.required,
    status: contentKeySet.has(variable.field_key) ? "configured" : "unused",
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
    autofillSource: VariableAutofillSource,
    outputTransform: VariableOutputTransform,
  ) => void;
  onCancel: () => void;
};

function RowEditor({ row, onSave, onCancel }: RowEditorProps) {
  const labelId = useId();
  const requiredId = useId();
  const errorId = useId();
  const autofillId = useId();
  const transformId = useId();
  const [label, setLabel] = useState(row.label ?? "");
  const [required, setRequired] = useState(row.required);
  const [autofillSource, setAutofillSource] = useState(row.autofill_source);
  const [outputTransform, setOutputTransform] = useState(row.output_transform);
  const [error, setError] = useState<string | undefined>();

  function save() {
    const trimmed = label.trim();
    if (trimmed === "") {
      setError("La etiqueta de la variable es requerida.");
      return;
    }
    onSave(trimmed, required, autofillSource, outputTransform);
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3 space-y-3">
      <div>
        <label
          htmlFor={labelId}
          className="block text-xs font-medium text-slate-700 mb-1"
        >
          Etiqueta
        </label>
        <input
          id={labelId}
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
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
          className="h-4 w-4 rounded border-slate-300 text-accent-700 focus:ring-accent-500"
        />
        <label htmlFor={requiredId} className="text-sm text-slate-700">
          Variable obligatoria
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={autofillId}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Origen para autollenado
          </label>
          <select
            id={autofillId}
            value={autofillSource}
            onChange={(event) =>
              setAutofillSource(event.target.value as VariableAutofillSource)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
          >
            {VARIABLE_AUTOFILL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {VARIABLE_AUTOFILL_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={transformId}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Transformación de salida
          </label>
          <select
            id={transformId}
            value={outputTransform}
            onChange={(event) =>
              setOutputTransform(event.target.value as VariableOutputTransform)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
          >
            {VARIABLE_OUTPUT_TRANSFORMS.map((transform) => (
              <option key={transform} value={transform}>
                {VARIABLE_OUTPUT_TRANSFORM_LABELS[transform]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-accent-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
        >
          Guardar variable
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ panel

type Props = {
  variables: TemplateWorkspaceVariable[];
  contentKeys: string[];
  onChange: (variables: TemplateWorkspaceVariable[]) => void;
};

export function TemplateVariablesPanel({
  variables,
  contentKeys,
  onChange,
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
    onChange(
      exists
        ? variables.map((v) => (v.field_key === field_key ? next : v))
        : [...variables, next],
    );
    setEditingKey(null);
  }

  function removeVariable(field_key: string) {
    onChange(variables.filter((v) => v.field_key !== field_key));
    setEditingKey(null);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 id={headingId} className="text-sm font-semibold text-slate-900">
          Variables del machote
        </h2>
        <p className="text-xs text-slate-500">
          Datos que se solicitarán al preparar una escritura. Las variables
          del contenido sin configurar aparecen como pendientes.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-slate-500">
          Aún no hay variables. Usa «Insertar variable» en el editor para
          agregar la primera.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const statusUi = STATUS_UI[row.status];
            const isEditing = editingKey === row.field_key;

            return (
              <li key={row.field_key} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    {row.label ? (
                      <p className="text-sm font-medium text-slate-900">
                        {row.label}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-500 italic">
                        Sin etiqueta
                      </p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                        {`{{${row.field_key}}}`}
                      </code>
                      {row.status !== "pending" && (
                        <span className="text-xs text-slate-500">
                          {row.required ? "Obligatoria" : "Opcional"}
                        </span>
                      )}
                      {row.autofill_source !== "none" && (
                        <span className="text-xs text-slate-500">
                          · Autollenado: {VARIABLE_AUTOFILL_SOURCE_LABELS[row.autofill_source]}
                        </span>
                      )}
                      {row.output_transform !== "none" && (
                        <span className="text-xs text-slate-500">
                          · {VARIABLE_OUTPUT_TRANSFORM_LABELS[row.output_transform]}
                        </span>
                      )}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusUi.className}`}
                  >
                    {statusUi.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingKey(isEditing ? null : row.field_key)}
                    aria-expanded={isEditing}
                    aria-label={`${row.status === "pending" ? "Configurar" : "Editar"} variable ${row.field_key}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                  >
                    {row.status === "pending" ? "Configurar" : "Editar"}
                  </button>

                  {row.status !== "pending" && (
                    <button
                      type="button"
                      onClick={() => removeVariable(row.field_key)}
                      aria-label={`Quitar configuración de ${row.field_key}`}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {isEditing && (
                  <RowEditor
                    row={row}
                    onSave={(label, required, autofillSource, outputTransform) =>
                      upsertVariable(
                        row.field_key,
                        label,
                        required,
                        autofillSource,
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
