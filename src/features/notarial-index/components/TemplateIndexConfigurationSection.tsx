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

export type IndexConfigurationOptionBlock = {
  blockId: string;
  name: string;
  type: "time";
};

type Props = {
  templateId: string;
  fields: IndexConfigurationField[];
  optionBlocks: IndexConfigurationOptionBlock[];
  configuration: TemplateIndexConfiguration | null;
  /** templates.write — sin este permiso, toda la sección es de solo
   * lectura. */
  readOnly?: boolean;
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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600";

export function TemplateIndexConfigurationSection({
  templateId,
  fields,
  optionBlocks,
  configuration,
  readOnly = false,
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
  const [partiesSearch, setPartiesSearch] = useState("");
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
      value: fieldsById.get(id)?.label ?? "",
    })),
    separator,
    fixedSuffix,
  });
  const previewIncomplete = configuration != null && !configuration.isComplete;
  const previewMessage =
    selectedIds.length === 0
      ? "Aún no se han configurado Partes."
      : previewIncomplete
        ? "La configuración está incompleta. Revisa las variables señaladas."
        : preview || "Aún no se han configurado Partes.";

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

  // La búsqueda solo oculta candidatos sin seleccionar: un campo ya elegido
  // permanece visible para poder reordenarlo o quitarlo aunque no coincida
  // con el texto buscado.
  const normalizedSearch = partiesSearch.trim().toLocaleLowerCase("es-CR");
  const visibleFields = orderedFields.filter((field) => {
    if (selectedIds.includes(field.id)) return true;
    if (normalizedSearch === "") return true;
    return (
      field.label.toLocaleLowerCase("es-CR").includes(normalizedSearch) ||
      field.fieldKey.toLocaleLowerCase("es-CR").includes(normalizedSearch)
    );
  });

  return (
    <section
      aria-label="Configuración del índice notarial"
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">
        Configuración del índice notarial
      </div>
      <form action={formAction} className="px-6 py-5">
          {readOnly && (
            <div
              role="status"
              className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
            >
              Tu rol no permite editar la configuración del índice. La ves en
              modo lectura.
            </div>
          )}
          <p className="text-sm text-slate-600">
            Opcional. Esta configuración permite precargar datos del índice
            notarial cuando crees una Escritura usando este Machote.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Los valores podrán revisarse y corregirse manualmente en cada
            Escritura.
          </p>
          <ul className="mt-3 mb-5 space-y-1 text-xs text-slate-500">
            <li>• No modifica el contenido del Machote.</li>
            <li>• Puedes dejar campos sin asignar.</li>
            <li>• Solo sirve para precargar datos del índice.</li>
            <li>• Los valores siempre podrán corregirse después.</li>
          </ul>

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

          <p className="mb-3 text-xs text-slate-500">
            Selecciona la variable que debe usarse para precargar este dato.
          </p>
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
                  name={
                    key === "authorized_time"
                      ? "authorized_time_source"
                      : `${key}_field_id`
                  }
                  defaultValue={
                    key === "authorized_time"
                      ? configuration?.authorizedTimeOptionBlockId
                        ? `block:${configuration.authorizedTimeOptionBlockId}`
                        : configuration?.simpleFields[key]
                          ? `field:${configuration.simpleFields[key]}`
                          : ""
                      : (configuration?.simpleFields[key] ?? "")
                  }
                  disabled={readOnly}
                  className={inputClass}
                >
                  <option value="">Sin asignar / ingreso manual</option>
                  {key === "authorized_time" ? (
                    <>
                      <optgroup label="Variables">
                        {fields.map((field) => (
                          <option key={field.id} value={`field:${field.id}`}>
                            {field.label}
                          </option>
                        ))}
                      </optgroup>
                      {optionBlocks.length > 0 && (
                        <optgroup label="Bloques de opciones">
                          {optionBlocks.map((block) => (
                            <option
                              key={block.blockId}
                              value={`block:${block.blockId}`}
                            >
                              {block.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))
                  )}
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
            <legend className="text-sm font-semibold text-slate-900">
              Partes para el índice
            </legend>
            <p className="mt-1 text-xs text-slate-500">
              Selecciona las variables que representan a las personas o
              entidades que deben aparecer en la columna &ldquo;Partes&rdquo;
              del índice.
            </p>
            {fields.length > 8 && (
              <input
                type="text"
                value={partiesSearch}
                onChange={(event) => setPartiesSearch(event.target.value)}
                disabled={readOnly}
                placeholder="Buscar variable…"
                aria-label="Buscar variable para Partes"
                className={`${inputClass} mt-3`}
              />
            )}
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {visibleFields.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">
                  Ninguna variable coincide con la búsqueda.
                </p>
              )}
              {visibleFields.map((field) => {
                const selectedIndex = selectedIds.indexOf(field.id);
                const selected = selectedIndex >= 0;
                return (
                  <div key={field.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                    <input
                      id={`index-party-${field.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleField(field.id, event.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 rounded border-slate-300 text-accent-700 focus:ring-accent-600"
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
                          disabled={readOnly || selectedIndex === 0}
                          onClick={() => moveField(field.id, -1)}
                          className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${field.label}`}
                          disabled={readOnly || selectedIndex === selectedIds.length - 1}
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
                disabled={readOnly}
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
                disabled={readOnly}
                maxLength={200}
                className={inputClass}
              />
            </div>
          </div>

          {selectedIds.length === 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-600">
                Este Machote no necesita generar automáticamente el campo
                &ldquo;Partes&rdquo; del índice.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Podrás completarlo manualmente en cada Escritura.
              </p>
              <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="allow_empty"
                  checked={allowEmpty}
                  onChange={(event) => setAllowEmpty(event.target.checked)}
                  disabled={readOnly}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                Confirmo que este machote no requiere Partes para el índice.
              </label>
            </div>
          )}

          {state.errors?.template_field_ids && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.errors.template_field_ids}
            </p>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">Vista previa</p>
            <p
              className={`mt-1 text-sm ${
                selectedIds.length === 0 || previewIncomplete
                  ? "text-slate-500"
                  : "text-slate-900"
              }`}
            >
              {previewMessage}
            </p>
          </div>

          {state.message && <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>}
          {state.success && <p role="status" className="mt-4 text-sm text-green-700">Configuración guardada.</p>}

          {!readOnly && (
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          )}
      </form>
    </section>
  );
}
