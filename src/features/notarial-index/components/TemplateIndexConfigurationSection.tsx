"use client";

import { useActionState, useMemo, useState } from "react";
import { generateIndexParties } from "../model/parties";
import type {
  InvalidIndexMapping,
  SimpleIndexMappingKey,
  TemplateIndexConfiguration,
} from "../model/template-index-configuration";
import {
  saveTemplateIndexConfigurationAction,
  type TemplateIndexConfigurationState,
} from "../server/template-index-config-actions";

export type IndexConfigurationField = {
  id: string;
  fieldKey: string;
  label: string;
};

type Props = {
  templateId: string;
  fields: IndexConfigurationField[];
  configuration: TemplateIndexConfiguration | null;
};

const SIMPLE_FIELDS: Array<{
  key: SimpleIndexMappingKey;
  label: string;
}> = [
  { key: "instrument_number", label: "Número de instrumento" },
  { key: "authorized_date", label: "Fecha de autorización" },
  { key: "authorized_time", label: "Hora de autorización" },
  { key: "protocol_book", label: "Tomo" },
  { key: "initial_folio", label: "Folio inicial" },
  { key: "final_folio", label: "Folio final" },
];

const INVALID_LABELS: Record<InvalidIndexMapping, string> = {
  instrument_number: "Número de instrumento",
  authorized_date: "Fecha de autorización",
  authorized_time: "Hora de autorización",
  protocol_book: "Tomo",
  initial_folio: "Folio inicial",
  final_folio: "Folio final",
  parties: "Partes",
};

const initialState: TemplateIndexConfigurationState = {};
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600";

export function TemplateIndexConfigurationSection({
  templateId,
  fields,
  configuration,
}: Props) {
  const availableIds = useMemo(
    () => new Set(fields.map((field) => field.id)),
    [fields],
  );
  const [selectedIds, setSelectedIds] = useState(() =>
    (configuration?.fields ?? [])
      .map((field) => field.templateFieldId)
      .filter((id) => availableIds.has(id)),
  );
  const [separator, setSeparator] = useState(
    configuration?.partySeparator ?? " Y ",
  );
  const [fixedSuffix, setFixedSuffix] = useState(
    configuration?.fixedSuffix ?? "",
  );
  const [allowEmpty, setAllowEmpty] = useState(
    configuration?.allowEmpty ?? false,
  );
  const action = saveTemplateIndexConfigurationAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const fieldsById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const preview = generateIndexParties({
    fields: selectedIds.map((id, order) => ({
      templateFieldId: id,
      order,
      value: `[${fieldsById.get(id)?.label ?? "Campo"}]`,
    })),
    separator,
    fixedSuffix,
  });

  function toggleField(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((candidate) => candidate !== id),
    );
  }

  function moveField(id: string, direction: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const orderedFields = [
    ...selectedIds.flatMap((id) => {
      const field = fieldsById.get(id);
      return field ? [field] : [];
    }),
    ...fields.filter((field) => !selectedIds.includes(field.id)),
  ];

  return (
    <section
      aria-label="Configuración del índice notarial"
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">
        Configuración del índice notarial
      </div>
      <form action={formAction} className="px-6 py-5">
          <p className="mb-5 text-sm text-slate-600">
            Asocia una vez las variables del machote con los datos del índice.
            Los valores podrán corregirse en cada escritura.
          </p>

          {configuration && !configuration.isComplete && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-medium">La configuración necesita revisión.</p>
              <p className="mt-1">
                Se eliminaron campos asociados a: {configuration.invalidMappings
                  .map((key) => INVALID_LABELS[key])
                  .join(", ") || "Partes"}.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SIMPLE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label
                  htmlFor={`${key}_field_id`}
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  {label}
                </label>
                <select
                  id={`${key}_field_id`}
                  name={`${key}_field_id`}
                  defaultValue={configuration?.simpleFields[key] ?? ""}
                  className={inputClass}
                >
                  <option value="">Sin asignar / ingreso manual</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {state.errors?.simple_fields && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.errors.simple_fields}
            </p>
          )}

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-900">Partes</legend>
            <p className="mt-1 text-xs text-slate-500">
              Selecciona uno o varios campos y ajusta su orden.
            </p>
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {orderedFields.map((field) => {
                const selectedIndex = selectedIds.indexOf(field.id);
                const selected = selectedIndex >= 0;
                return (
                  <div key={field.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                    <input
                      id={`index-party-${field.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleField(field.id, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <label
                      htmlFor={`index-party-${field.id}`}
                      className="min-w-0 flex-1 text-sm text-slate-800"
                    >
                      <span className="font-medium">{field.label}</span>
                      <span className="ml-2 text-xs text-slate-500">{field.fieldKey}</span>
                    </label>
                    {selected && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Subir ${field.label}`}
                          disabled={selectedIndex === 0}
                          onClick={() => moveField(field.id, -1)}
                          className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${field.label}`}
                          disabled={selectedIndex === selectedIds.length - 1}
                          onClick={() => moveField(field.id, 1)}
                          className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="selected_field" value={id} />
          ))}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="party_separator" className="mb-1 block text-xs font-medium text-slate-700">
                Separador
              </label>
              <input
                id="party_separator"
                name="party_separator"
                value={separator}
                onChange={(event) => setSeparator(event.target.value)}
                maxLength={30}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="fixed_suffix" className="mb-1 block text-xs font-medium text-slate-700">
                Texto fijo (opcional)
              </label>
              <input
                id="fixed_suffix"
                name="fixed_suffix"
                value={fixedSuffix}
                onChange={(event) => setFixedSuffix(event.target.value)}
                maxLength={200}
                className={inputClass}
              />
            </div>
          </div>

          {selectedIds.length === 0 && (
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="allow_empty"
                checked={allowEmpty}
                onChange={(event) => setAllowEmpty(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              Confirmo que este machote no requiere Partes para el índice.
            </label>
          )}

          {state.errors?.template_field_ids && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.errors.template_field_ids}
            </p>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">Vista previa</p>
            <p className="mt-1 text-sm text-slate-900">{preview || "Sin Partes configuradas"}</p>
          </div>

          {state.message && <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>}
          {state.success && <p role="status" className="mt-4 text-sm text-green-700">Configuración guardada.</p>}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
      </form>
    </section>
  );
}
