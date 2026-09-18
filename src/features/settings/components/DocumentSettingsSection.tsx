"use client";

/**
 * Pestaña "Configuración": formato de los documentos Word generados
 * (fuente, tamaño, márgenes). Misma tabla `document_settings` y la misma
 * acción de guardado — secciones independientes + vista previa visual de
 * márgenes.
 *
 * Márgenes por perfil: Frente | Vuelto (pestañas dentro de la sección). Los
 * dos perfiles viven en el mismo formulario y se guardan juntos; el perfil
 * inactivo queda oculto pero se envía. Al descargar un Word se elige cuál
 * perfil aplicar (ver `DownloadDocxButton`).
 *
 * El párrafo del DOCX es fijo (justificado, antes/después 0, interlineado
 * exacto 24 pt — `src/lib/documents/docx/formatting.ts`); por eso no hay
 * campo de interlineado.
 */

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  saveDocumentSettingsAction,
} from "../server/settings-actions";
import type { DocumentSettingsState } from "../model/action-state";
import { ALLOWED_FONT_FAMILIES } from "@/lib/validations/settings";
import { FieldError } from "@/components/forms/FieldError";
import { SettingsActionsBar } from "./SettingsActionsBar";
import { useToast } from "@/components/feedback/Toast";

import type { DocumentSettingsData } from "../model/types";
import {
  MARGIN_PROFILES,
  MARGIN_PROFILE_LABELS,
  REFERENCE_MARGINS_CM,
  type MarginProfile,
} from "@/lib/documents/docx/margin-profile";

export type { DocumentSettingsData } from "../model/types";

// Defaults: márgenes de referencia de Word (ver `REFERENCE_MARGINS_CM`), los
// mismos para Frente y Vuelto hasta que se definan valores distintos.
const DOCUMENT_SETTINGS_DEFAULTS: DocumentSettingsData = {
  font_family: "Times New Roman",
  font_size: 12,
  margin_top_cm: REFERENCE_MARGINS_CM.top,
  margin_bottom_cm: REFERENCE_MARGINS_CM.bottom,
  margin_left_cm: REFERENCE_MARGINS_CM.left,
  margin_right_cm: REFERENCE_MARGINS_CM.right,
  back_margin_top_cm: null,
  back_margin_bottom_cm: null,
  back_margin_left_cm: null,
  back_margin_right_cm: null,
};

type Side = "top" | "bottom" | "left" | "right";
type MarginFieldName =
  | `margin_${Side}_cm`
  | `back_margin_${Side}_cm`;

type FormValues = {
  font_family: string;
  font_size: string;
} & Record<MarginFieldName, string>;

function marginFieldName(profile: MarginProfile, side: Side): MarginFieldName {
  return profile === "front" ? `margin_${side}_cm` : `back_margin_${side}_cm`;
}

function buildValues(settings: DocumentSettingsData | null): FormValues {
  const doc = settings ?? DOCUMENT_SETTINGS_DEFAULTS;
  // Filas anteriores a Frente/Vuelto: Vuelto arranca con los mismos valores.
  return {
    font_family: doc.font_family,
    font_size: String(doc.font_size),
    margin_top_cm: String(doc.margin_top_cm),
    margin_bottom_cm: String(doc.margin_bottom_cm),
    margin_left_cm: String(doc.margin_left_cm),
    margin_right_cm: String(doc.margin_right_cm),
    back_margin_top_cm: String(doc.back_margin_top_cm ?? doc.margin_top_cm),
    back_margin_bottom_cm: String(
      doc.back_margin_bottom_cm ?? doc.margin_bottom_cm,
    ),
    back_margin_left_cm: String(doc.back_margin_left_cm ?? doc.margin_left_cm),
    back_margin_right_cm: String(
      doc.back_margin_right_cm ?? doc.margin_right_cm,
    ),
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const MARGIN_SIDES = [
  { side: "top", label: "Superior" },
  { side: "bottom", label: "Inferior" },
  { side: "left", label: "Izquierdo" },
  { side: "right", label: "Derecho" },
] as const satisfies ReadonlyArray<{ side: Side; label: string }>;

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
  const [profile, setProfile] = useState<MarginProfile>("front");
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
  // Un error en el perfil que no se está viendo debe ser visible: se avisa
  // con un enlace para cambiar de pestaña (derivado, sin efectos).
  const otherProfile: MarginProfile = profile === "front" ? "back" : "front";
  const otherProfileHasErrors = MARGIN_SIDES.some(
    ({ side }) => !!errors?.[marginFieldName(otherProfile, side)],
  );

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
            Fuente y tamaño usados al generar el documento Word. El texto se
            genera justificado, con interlineado exacto de 24 pt y sin
            espacio antes ni después de cada párrafo.
          </p>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
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

        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-900">Márgenes (cm)</h2>
          <p className="text-xs text-slate-500">
            Espaciado del contenido respecto al borde de la página. Al
            descargar el Word eliges si usar los márgenes de Frente o de
            Vuelto.
          </p>
        </div>
        <div className="px-6 pt-5">
          <div
            role="tablist"
            aria-label="Perfil de márgenes"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          >
            {MARGIN_PROFILES.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                id={`margin-tab-${p}`}
                aria-selected={profile === p}
                aria-controls={`margin-panel-${p}`}
                onClick={() => setProfile(p)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors ${
                  profile === p
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {MARGIN_PROFILE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        {otherProfileHasErrors && (
          <p role="alert" className="px-6 pt-4 text-xs text-red-700">
            Hay márgenes inválidos en {MARGIN_PROFILE_LABELS[otherProfile]}.{" "}
            <button
              type="button"
              onClick={() => setProfile(otherProfile)}
              className="font-medium underline focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
            >
              Ver {MARGIN_PROFILE_LABELS[otherProfile]}
            </button>
          </p>
        )}
        {MARGIN_PROFILES.map((p) => (
          <div
            key={p}
            role="tabpanel"
            id={`margin-panel-${p}`}
            aria-labelledby={`margin-tab-${p}`}
            hidden={profile !== p}
            className="px-6 py-6 flex flex-col gap-6 sm:flex-row sm:items-start"
          >
            <fieldset className="grid shrink-0 grid-cols-2 gap-4">
              <legend className="sr-only">
                Márgenes de {MARGIN_PROFILE_LABELS[p]}
              </legend>
              {MARGIN_SIDES.map(({ side, label }) => {
                const name = marginFieldName(p, side);
                return (
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
                      step="0.01"
                      disabled={!canManage}
                      value={values[name]}
                      onChange={(e) => setField(name, e.target.value)}
                      className={inputClass}
                      aria-describedby={errors?.[name] ? `${name}-error` : undefined}
                      aria-invalid={!!errors?.[name]}
                    />
                    <FieldError id={`${name}-error`} message={errors?.[name]} />
                  </div>
                );
              })}
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
                    top: num(values[marginFieldName(p, "top")]) * scale,
                    bottom: num(values[marginFieldName(p, "bottom")]) * scale,
                    left: num(values[marginFieldName(p, "left")]) * scale,
                    right: num(values[marginFieldName(p, "right")]) * scale,
                  }}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] text-slate-400">
                Vista previa (no a escala)
              </p>
            </div>
          </div>
        ))}
      </section>

      {canManage && (
        <SettingsActionsBar dirty={dirty} pending={pending} onDiscard={handleDiscard} />
      )}
    </form>
  );
}
