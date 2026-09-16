"use client";

/**
 * Campos reales de configuración de una variable — etiqueta, obligatoriedad
 * y transformación de salida — compartidos entre los distintos puntos donde
 * se crea o edita una variable (Insertar variable, Bloques de opciones,
 * revisión de variables pegadas/escritas, panel de Variables) para que
 * todos pidan exactamente los mismos datos en vez de divergir con el
 * tiempo. La fuente de verdad (`FIELD_KEY_PATTERN`, `VARIABLE_OUTPUT_TRANSFORMS`)
 * sigue viviendo en el modelo — este componente solo unifica el markup.
 *
 * El origen de autollenado NO aparece aquí: se sugiere automáticamente a
 * partir de la clave (`suggestAutofillSource`) y es informativo, no
 * editable — ver `TemplateVariablesPanel`.
 */

import {
  VARIABLE_OUTPUT_TRANSFORMS,
  VARIABLE_OUTPUT_TRANSFORM_EXAMPLES,
  VARIABLE_OUTPUT_TRANSFORM_LABELS,
  type VariableOutputTransform,
} from "../model/variable-autofill";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";

export type VariableConfigValue = {
  label: string;
  required: boolean;
  output_transform: VariableOutputTransform;
};

type Props = {
  idPrefix: string;
  value: VariableConfigValue;
  onChange: (next: VariableConfigValue) => void;
  disabled?: boolean;
  labelError?: string;
  autoFocusLabel?: boolean;
};

export function VariableConfigFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
  labelError,
  autoFocusLabel = false,
}: Props) {
  const labelId = `${idPrefix}-label`;
  const requiredId = `${idPrefix}-required`;
  const transformId = `${idPrefix}-transform`;
  const errorId = `${idPrefix}-label-error`;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={labelId} className="block text-xs font-medium text-slate-700 mb-1">
          Etiqueta
        </label>
        <input
          id={labelId}
          type="text"
          value={value.label}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
          className={inputClass}
          placeholder="Ej: Nombre del comprador"
          aria-describedby={labelError ? errorId : undefined}
          aria-invalid={!!labelError}
          autoFocus={autoFocusLabel}
        />
        {labelError && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-700">
            {labelError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={requiredId}
          type="checkbox"
          checked={value.required}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, required: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-accent-700 focus:ring-accent-500"
        />
        <label htmlFor={requiredId} className="text-sm text-slate-700">
          Variable obligatoria
        </label>
      </div>

      <div>
        <label htmlFor={transformId} className="block text-xs font-medium text-slate-700 mb-1">
          Transformación de salida
        </label>
        <select
          id={transformId}
          value={value.output_transform}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              output_transform: event.target.value as VariableOutputTransform,
            })
          }
          className={inputClass}
        >
          {VARIABLE_OUTPUT_TRANSFORMS.map((transform) => (
            <option key={transform} value={transform}>
              {VARIABLE_OUTPUT_TRANSFORM_LABELS[transform]}
            </option>
          ))}
        </select>
        {VARIABLE_OUTPUT_TRANSFORM_EXAMPLES[value.output_transform] && (
          <p className="mt-1 text-xs text-slate-500">
            {VARIABLE_OUTPUT_TRANSFORM_EXAMPLES[value.output_transform]}
          </p>
        )}
      </div>
    </div>
  );
}
