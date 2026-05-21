"use client";

import { useActionState } from "react";
import {
  saveDocumentSettingsAction,
  type DocumentSettingsState,
} from "../actions";
import { ALLOWED_FONT_FAMILIES } from "@/lib/validations/settings";

export type DocumentSettingsData = {
  font_family: string;
  font_size: number;
  margin_top_cm: number;
  margin_bottom_cm: number;
  margin_left_cm: number;
  margin_right_cm: number;
  line_spacing: number;
};

// Defaults aligned with Costa Rican legal document conventions.
const DEFAULTS: DocumentSettingsData = {
  font_family: "Times New Roman",
  font_size: 12,
  margin_top_cm: 4.7,
  margin_bottom_cm: 4.7,
  margin_left_cm: 3.2,
  margin_right_cm: 3.2,
  line_spacing: 1.5,
};

interface Props {
  initialData: DocumentSettingsData | null;
}

const initialState: DocumentSettingsState = {};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

export function DocumentSettingsForm({ initialData }: Props) {
  const [state, formAction, pending] = useActionState(
    saveDocumentSettingsAction,
    initialState,
  );

  const data = initialData ?? DEFAULTS;

  return (
    <section aria-labelledby="docsettings-heading">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h2
            id="docsettings-heading"
            className="text-base font-semibold text-slate-900"
          >
            Configuración de documentos
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Valores por defecto para los documentos Word generados.
          </p>
        </div>

        <div className="px-6 py-6">
          {state.success && (
            <div
              role="status"
              className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
            >
              {state.message}
            </div>
          )}

          {state.message && !state.success && !state.errors && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}

          <form action={formAction} className="space-y-6" noValidate>
            {/* Font */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="font_family"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Fuente
                </label>
                <select
                  id="font_family"
                  name="font_family"
                  defaultValue={data.font_family}
                  className={inputClass}
                  aria-describedby={
                    state.errors?.font_family
                      ? "font_family-error"
                      : undefined
                  }
                  aria-invalid={!!state.errors?.font_family}
                >
                  {ALLOWED_FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                {state.errors?.font_family && (
                  <p
                    id="font_family-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {state.errors.font_family}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="font_size"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Tamaño de fuente (pt)
                </label>
                <input
                  id="font_size"
                  name="font_size"
                  type="number"
                  min="1"
                  step="0.5"
                  defaultValue={data.font_size}
                  className={inputClass}
                  aria-describedby={
                    state.errors?.font_size ? "font_size-error" : undefined
                  }
                  aria-invalid={!!state.errors?.font_size}
                />
                {state.errors?.font_size && (
                  <p
                    id="font_size-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {state.errors.font_size}
                  </p>
                )}
              </div>
            </div>

            {/* Margins */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 mb-3">
                Márgenes (cm)
              </legend>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    { name: "margin_top_cm", label: "Superior" },
                    { name: "margin_bottom_cm", label: "Inferior" },
                    { name: "margin_left_cm", label: "Izquierdo" },
                    { name: "margin_right_cm", label: "Derecho" },
                  ] as const
                ).map(({ name, label }) => (
                  <div key={name}>
                    <label
                      htmlFor={name}
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      {label}
                    </label>
                    <input
                      id={name}
                      name={name}
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={data[name]}
                      className={inputClass}
                      aria-describedby={
                        state.errors?.[name] ? `${name}-error` : undefined
                      }
                      aria-invalid={!!state.errors?.[name]}
                    />
                    {state.errors?.[name] && (
                      <p
                        id={`${name}-error`}
                        role="alert"
                        className="mt-1 text-xs text-red-700"
                      >
                        {state.errors[name]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Line spacing */}
            <div className="sm:max-w-xs">
              <label
                htmlFor="line_spacing"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Interlineado
              </label>
              <input
                id="line_spacing"
                name="line_spacing"
                type="number"
                min="0.5"
                step="0.5"
                defaultValue={data.line_spacing}
                className={inputClass}
                aria-describedby={
                  state.errors?.line_spacing
                    ? "line_spacing-error"
                    : undefined
                }
                aria-invalid={!!state.errors?.line_spacing}
              />
              {state.errors?.line_spacing && (
                <p
                  id="line_spacing-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-700"
                >
                  {state.errors.line_spacing}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pending ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
