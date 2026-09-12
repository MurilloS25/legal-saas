"use client";

import type { KeyboardEvent } from "react";
import type { TemplateIndexConfigurationState } from "../../server/template-index-config-actions";
import { CollapsibleFieldRow } from "../CollapsibleFieldRow";
import type { IndexConfigurationField } from "./types";

export type TemplateIndexPartiesMode = "pending" | "required" | "not_required";

const PARTIES_MODE_OPTIONS: Array<{
  mode: TemplateIndexPartiesMode;
  label: string;
}> = [
  { mode: "pending", label: "Pendiente de definir" },
  { mode: "required", label: "Requiere partes" },
  { mode: "not_required", label: "No requiere partes" },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600";

type Props = {
  mode: TemplateIndexPartiesMode;
  configured: boolean;
  status: "configured" | "pending" | "optional";
  selectedIds: string[];
  open: boolean;
  onToggle: () => void;
  onModeChange: (mode: TemplateIndexPartiesMode) => void;
  readOnly: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  listboxId: string;
  visibleFields: IndexConfigurationField[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onToggleField: (id: string, checked: boolean) => void;
  onMoveField: (id: string, direction: -1 | 1) => void;
  separator: string;
  onSeparatorChange: (value: string) => void;
  fixedSuffix: string;
  onFixedSuffixChange: (value: string) => void;
  errors: TemplateIndexConfigurationState["errors"];
  previewIncomplete: boolean;
  previewMessage: string;
};

export function TemplateIndexPartiesField({
  mode,
  configured,
  status,
  selectedIds,
  open,
  onToggle,
  onModeChange,
  readOnly,
  search,
  onSearchChange,
  onSearchKeyDown,
  listboxId,
  visibleFields,
  activeIndex,
  onActiveIndexChange,
  onToggleField,
  onMoveField,
  separator,
  onSeparatorChange,
  fixedSuffix,
  onFixedSuffixChange,
  errors,
  previewIncomplete,
  previewMessage,
}: Props) {
  return (
    <CollapsibleFieldRow
      id="idx-parties"
      name="Partes"
      meta={
        mode === "required"
          ? configured
            ? `${selectedIds.length} variable${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}`
            : "¿Quiénes aparecen en la columna “Partes”?"
          : mode === "not_required"
            ? "Confirmado sin Partes"
            : "Sin decidir todavía"
      }
      status={status}
      statusLabel={status === "optional" ? "Confirmado" : undefined}
      open={open}
      onToggle={onToggle}
    >
      <fieldset disabled={readOnly}>
        <legend className="text-xs font-medium text-slate-700">
          ¿Este machote tiene Partes para el índice?
        </legend>
        <div
          role="radiogroup"
          aria-label="¿Este machote tiene Partes para el índice?"
          className="mt-2 flex flex-wrap gap-2"
        >
          {PARTIES_MODE_OPTIONS.map(({ mode: option, label }) => {
            const active = mode === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={readOnly}
                onClick={() => onModeChange(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-accent-600 bg-accent-50 text-accent-800"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {mode === "pending" && (
        <p className="mt-3 text-sm text-slate-500">
          Aún no has decidido si este machote necesita Partes para el índice.
          El machote puede guardarse igual — podrás definirlo más adelante.
        </p>
      )}

      {mode === "not_required" && (
        <div className="mt-3">
          <p className="text-sm text-slate-600">
            Este Machote no necesita generar automáticamente el campo
            &ldquo;Partes&rdquo; del índice.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Podrás completarlo manualmente en cada Escritura.
          </p>
        </div>
      )}

      {mode === "required" && (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Selecciona las variables que representan a las personas o entidades
            que deben aparecer en la columna &ldquo;Partes&rdquo; del índice.
          </p>
          <input
            type="text"
            role="combobox"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            disabled={readOnly}
            placeholder="Buscar variable…"
            aria-label="Buscar variable para Partes"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              visibleFields[activeIndex]
                ? `${listboxId}-option-${visibleFields[activeIndex].id}`
                : undefined
            }
            autoComplete="off"
            className={`${inputClass} mt-3`}
          />
          <div
            id={listboxId}
            role="listbox"
            aria-label="Variables disponibles para Partes"
            className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200"
          >
            {visibleFields.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-500">
                Ninguna variable coincide con la búsqueda.
              </p>
            )}
            {visibleFields.map((field, index) => {
              const selectedIndex = selectedIds.indexOf(field.id);
              const selected = selectedIndex >= 0;
              const active = index === activeIndex;
              return (
                <div
                  key={field.id}
                  id={`${listboxId}-option-${field.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  className={`flex min-h-12 items-center gap-3 px-3 py-2 ${active ? "bg-accent-50" : ""}`}
                >
                  <input
                    id={`index-party-${field.id}`}
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onToggleField(field.id, event.target.checked)}
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
                        onClick={() => onMoveField(field.id, -1)}
                        className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Bajar ${field.label}`}
                        disabled={readOnly || selectedIndex === selectedIds.length - 1}
                        onClick={() => onMoveField(field.id, 1)}
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

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="party_separator" className="mb-1 block text-xs font-medium text-slate-700">
                Separador
              </label>
              <input
                id="party_separator"
                value={separator}
                onChange={(event) => onSeparatorChange(event.target.value)}
                disabled={readOnly}
                maxLength={30}
                className={inputClass}
              />
              {errors?.party_separator && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {errors.party_separator}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="fixed_suffix" className="mb-1 block text-xs font-medium text-slate-700">
                Texto fijo (opcional)
              </label>
              <input
                id="fixed_suffix"
                value={fixedSuffix}
                onChange={(event) => onFixedSuffixChange(event.target.value)}
                disabled={readOnly}
                maxLength={200}
                className={inputClass}
              />
              {errors?.fixed_suffix && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {errors.fixed_suffix}
                </p>
              )}
            </div>
          </div>

          {errors?.template_field_ids && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {errors.template_field_ids}
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
        </>
      )}
    </CollapsibleFieldRow>
  );
}
