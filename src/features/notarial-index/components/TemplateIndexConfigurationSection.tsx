"use client";

import { useActionState, useMemo, useState } from "react";
import { generateIndexParties } from "../model/parties";
import {
  saveTemplateIndexConfigurationAction,
  type TemplateIndexConfigurationState,
} from "../server/template-index-config-actions";
import type { TemplateIndexConfiguration } from "../model/template-index-configuration";

export type IndexConfigurationField = {
  id: string;
  fieldKey: string;
  label: string;
  value: string | null;
};

type Props = {
  documentId: string;
  templateId: string;
  fields: IndexConfigurationField[];
  configuration: TemplateIndexConfiguration | null;
};

const initialState: TemplateIndexConfigurationState = {};

export function TemplateIndexConfigurationSection({
  documentId,
  templateId,
  fields,
  configuration,
}: Props) {
  const availableIds = useMemo(() => new Set(fields.map((field) => field.id)), [fields]);
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
  const action = saveTemplateIndexConfigurationAction.bind(
    null,
    templateId,
    documentId,
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const [expanded, setExpanded] = useState(
    !configuration || !configuration.isComplete,
  );
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.success || state.message || state.errors) setExpanded(true);
  }

  const fieldsById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const preview = generateIndexParties({
    fields: selectedIds.map((id, order) => ({
      templateFieldId: id,
      order,
      value: fieldsById.get(id)?.value ?? "",
    })),
    separator,
    fixedSuffix,
  });

  function toggleField(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((candidate) => candidate !== id),
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

  const selectedFields = selectedIds.flatMap((id) => {
    const field = fieldsById.get(id);
    return field ? [field] : [];
  });
  const unselectedFields = fields.filter((field) => !selectedIds.includes(field.id));

  return (
    <section
      aria-label="Configuración de Partes del índice"
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary className="cursor-pointer px-6 py-5 text-sm font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-inset">
          {configuration
            ? "Editar configuración de Partes"
            : "Configurar Partes del índice"}
        </summary>
        <form action={formAction} className="border-t border-slate-200 px-6 py-6">
          <p className="mb-5 text-sm text-slate-600">
            Selecciona los campos que representan las partes del índice.
          </p>

          {configuration && !configuration.isComplete && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Un campo configurado ya no existe. Revisa y guarda nuevamente.
            </p>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-slate-800">
              Campos del machote
            </legend>
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {[...selectedFields, ...unselectedFields].map((field) => {
                const selectedIndex = selectedIds.indexOf(field.id);
                const selected = selectedIndex >= 0;
                return (
                  <div
                    key={field.id}
                    className="flex min-h-14 items-center gap-3 px-3 py-2"
                  >
                    <input
                      id={`index-field-${field.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        toggleField(field.id, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <label
                      htmlFor={`index-field-${field.id}`}
                      className="min-w-0 flex-1 text-sm text-slate-800"
                    >
                      <span className="block font-medium">{field.label}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {field.fieldKey}
                      </span>
                    </label>
                    {selected && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          title={`Subir ${field.label}`}
                          aria-label={`Subir ${field.label}`}
                          disabled={selectedIndex === 0}
                          onClick={() => moveField(field.id, -1)}
                          className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title={`Bajar ${field.label}`}
                          aria-label={`Bajar ${field.label}`}
                          disabled={selectedIndex === selectedIds.length - 1}
                          onClick={() => moveField(field.id, 1)}
                          className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="party_separator"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Separador
              </label>
              <input
                id="party_separator"
                name="party_separator"
                value={separator}
                onChange={(event) => setSeparator(event.target.value)}
                maxLength={30}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600"
                aria-invalid={!!state.errors?.party_separator}
                aria-describedby={
                  state.errors?.party_separator
                    ? "party_separator_error"
                    : undefined
                }
              />
              {state.errors?.party_separator && (
                <p
                  id="party_separator_error"
                  className="mt-1 text-sm text-red-700"
                >
                  {state.errors.party_separator}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="fixed_suffix"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Texto fijo <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="fixed_suffix"
                name="fixed_suffix"
                value={fixedSuffix}
                onChange={(event) => setFixedSuffix(event.target.value)}
                maxLength={200}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600"
                aria-invalid={!!state.errors?.fixed_suffix}
                aria-describedby={
                  state.errors?.fixed_suffix ? "fixed_suffix_error" : undefined
                }
              />
              {state.errors?.fixed_suffix && (
                <p
                  id="fixed_suffix_error"
                  className="mt-1 text-sm text-red-700"
                >
                  {state.errors.fixed_suffix}
                </p>
              )}
            </div>
          </div>

          {selectedIds.length === 0 && (
            <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="allow_empty"
                checked={allowEmpty}
                onChange={(event) => setAllowEmpty(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              Confirmo que este machote no requiere Partes para el índice.
            </label>
          )}

          {state.errors?.template_field_ids && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.errors.template_field_ids}
            </p>
          )}

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">
              Vista previa
            </p>
            <p className="mt-1 min-h-5 text-sm text-slate-900">
              {preview || "Sin valor generado"}
            </p>
          </div>

          {state.message && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {state.message}
            </p>
          )}
          {state.success && (
            <p role="status" className="mt-4 text-sm text-green-700">
              Configuración guardada.
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
