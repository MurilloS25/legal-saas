"use client";

/**
 * Pestaña "Configuración": formato de los documentos Word generados
 * (fuente, tamaño, márgenes, interlineado). Misma tabla `document_settings`
 * y la misma acción de guardado que existían en el formulario combinado
 * anterior — solo cambia la presentación (secciones independientes + vista
 * previa visual de márgenes, patrón aprobado en el prototipo).
 *
 * Nota: `line_spacing` se guarda y valida aquí, pero el DOCX generado usa un
 * interlineado fijo (ver `src/lib/documents/docx/formatting.ts`) — este
 * campo no afecta hoy el documento final. Comportamiento preexistente, no
 * introducido por este cambio de UI.
 */

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  saveDocumentSettingsAction,
  type DocumentSettingsState,
} from "../actions";
import { ALLOWED_FONT_FAMILIES } from "@/lib/validations/settings";
import { FieldError } from "@/components/forms/FieldError";
import { SettingsActionsBar } from "./SettingsActionsBar";
import { useToast } from "@/components/feedback/Toast";

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
const DOCUMENT_SETTINGS_DEFAULTS: DocumentSettingsData = {
  font_family: "Times New Roman",
  font_size: 12,
  margin_top_cm: 4.7,
  margin_bottom_cm: 4.7,
  margin_left_cm: 3.2,
  margin_right_cm: 3.2,
  line_spacing: 1.5,
};

type FormValues = {
  font_family: string;
  font_size: string;
  margin_top_cm: string;
  margin_bottom_cm: string;
  margin_left_cm: string;
  margin_right_cm: string;
  line_spacing: string;
};

function buildValues(settings: DocumentSettingsData | null): FormValues {
  const doc = settings ?? DOCUMENT_SETTINGS_DEFAULTS;
  return {
    font_family: doc.font_family,
    font_size: String(doc.font_size),
    margin_top_cm: String(doc.margin_top_cm),
    margin_bottom_cm: String(doc.margin_bottom_cm),
    margin_left_cm: String(doc.margin_left_cm),
    margin_right_cm: String(doc.margin_right_cm),
    line_spacing: String(doc.line_spacing),
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const MARGIN_FIELDS = [
  { name: "margin_top_cm", label: "Superior" },
  { name: "margin_bottom_cm", label: "Inferior" },
  { name: "margin_left_cm", label: "Izquierdo" },
  { name: "margin_right_cm", label: "Derecho" },
] as const satisfies ReadonlyArray<{ name: keyof FormValues; label: string }>;

const initialState: DocumentSettingsState = {};

export function DocumentSettingsSection({
  initialSettings,
  canManage,
}: {
  initialSettings: DocumentSettingsData | null;
  canManage: boolean;
}) {
  const initialValues = buildValues(initialSettings);
  const savedRef = useRef<FormValues>(initialValues);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveDocumentSettingsAction,
    initialState,
  );

  const { showToast } = useToast();
  const lastHandled = useRef<DocumentSettingsState | null>(null);
  useEffect(() => {
    if (state.success && lastHandled.current !== state) {
      lastHandled.current = state;
      savedRef.current = values;
      setDirty(false);
      showToast(state.message ?? "Configuración guardada.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function setField<K extends keyof FormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function handleDiscard() {
    setValues(savedRef.current);
    setDirty(false);
  }

  const errors = state.errors;

  // Proporciones relativas para la vista previa — solo para visualizar los
  // márgenes, no a escala real de página.
  const pageW = 160;
  const pageH = 207;
  const scale = 5.2; // px por cm, aproximado
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.message && !state.success && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      {!canManage && (
        <div
          role="status"
          className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
        >
          Solo el propietario o un administrador pueden editar esta
          información. La ves en modo lectura.
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-900">Formato de texto</h2>
          <p className="text-xs text-slate-500">
            Fuente y espaciado usados al generar el documento Word.
          </p>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="font_family" className={labelClass}>
              Fuente
            </label>
            <select
              id="font_family"
              name="font_family"
              disabled={!canManage}
              value={values.font_family}
              onChange={(e) => setField("font_family", e.target.value)}
              className={inputClass}
              aria-describedby={errors?.font_family ? "font_family-error" : undefined}
              aria-invalid={!!errors?.font_family}
            >
              {ALLOWED_FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <FieldError id="font_family-error" message={errors?.font_family} />
          </div>

          <div>
            <label htmlFor="font_size" className={labelClass}>
              Tamaño (pt)
            </label>
            <input
              id="font_size"
              name="font_size"
              type="number"
              min="1"
              step="0.5"
              disabled={!canManage}
              value={values.font_size}
              onChange={(e) => setField("font_size", e.target.value)}
              className={inputClass}
              aria-describedby={errors?.font_size ? "font_size-error" : undefined}
              aria-invalid={!!errors?.font_size}
            />
            <FieldError id="font_size-error" message={errors?.font_size} />
          </div>

          <div>
            <label htmlFor="line_spacing" className={labelClass}>
              Interlineado
            </label>
            <input
              id="line_spacing"
              name="line_spacing"
              type="number"
              min="0.5"
              step="0.5"
              disabled={!canManage}
              value={values.line_spacing}
              onChange={(e) => setField("line_spacing", e.target.value)}
              className={inputClass}
              aria-describedby={errors?.line_spacing ? "line_spacing-error" : undefined}
              aria-invalid={!!errors?.line_spacing}
            />
            <FieldError id="line_spacing-error" message={errors?.line_spacing} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-900">Márgenes (cm)</h2>
          <p className="text-xs text-slate-500">
            Espaciado del contenido respecto al borde de la página.
          </p>
        </div>
        <div className="px-6 py-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <fieldset className="grid shrink-0 grid-cols-2 gap-4">
            <legend className="sr-only">Márgenes</legend>
            {MARGIN_FIELDS.map(({ name, label }) => (
              <div key={name}>
                <label htmlFor={name} className="block text-xs font-medium text-slate-600 mb-1">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type="number"
                  min="0"
                  step="0.1"
                  disabled={!canManage}
                  value={values[name]}
                  onChange={(e) => setField(name, e.target.value)}
                  className={inputClass}
                  aria-describedby={errors?.[name] ? `${name}-error` : undefined}
                  aria-invalid={!!errors?.[name]}
                />
                <FieldError id={`${name}-error`} message={errors?.[name]} />
              </div>
            ))}
          </fieldset>

          <div className="mx-auto shrink-0 sm:mx-0">
            <div
              className="relative border border-slate-300 bg-white shadow-sm"
              style={{ width: pageW, height: pageH }}
              aria-hidden="true"
            >
              <div
                className="absolute border border-dashed border-accent-500/50 bg-accent-50/60"
                style={{
                  top: num(values.margin_top_cm) * scale,
                  bottom: num(values.margin_bottom_cm) * scale,
                  left: num(values.margin_left_cm) * scale,
                  right: num(values.margin_right_cm) * scale,
                }}
              />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              Vista previa (no a escala)
            </p>
          </div>
        </div>
      </section>

      {canManage && (
        <SettingsActionsBar dirty={dirty} pending={pending} onDiscard={handleDiscard} />
      )}
    </form>
  );
}
