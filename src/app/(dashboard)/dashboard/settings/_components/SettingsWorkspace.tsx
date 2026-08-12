"use client";

/**
 * Workspace unificado de Configuración: perfil profesional y configuración
 * de documentos en una sola página, con un único guardado. Los campos son
 * controlados (no `defaultValue`) para poder detectar cambios y ofrecer
 * "Descartar" sin depender de un refresco de página tras guardar.
 */

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "../actions";
import { ALLOWED_FONT_FAMILIES } from "@/lib/validations/settings";
import { FieldError } from "@/components/forms/FieldError";
import { SettingsActionsBar } from "./SettingsActionsBar";

export type LawyerProfileData = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

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
  full_name: string;
  professional_code: string;
  email: string;
  phone: string;
  font_family: string;
  font_size: string;
  margin_top_cm: string;
  margin_bottom_cm: string;
  margin_left_cm: string;
  margin_right_cm: string;
  line_spacing: string;
};

function buildValues(
  profile: LawyerProfileData | null,
  settings: DocumentSettingsData | null,
): FormValues {
  const doc = settings ?? DOCUMENT_SETTINGS_DEFAULTS;
  return {
    full_name: profile?.full_name ?? "",
    professional_code: profile?.professional_code ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    font_family: doc.font_family,
    font_size: String(doc.font_size),
    margin_top_cm: String(doc.margin_top_cm),
    margin_bottom_cm: String(doc.margin_bottom_cm),
    margin_left_cm: String(doc.margin_left_cm),
    margin_right_cm: String(doc.margin_right_cm),
    line_spacing: String(doc.line_spacing),
  };
}

type Props = {
  initialProfile: LawyerProfileData | null;
  initialSettings: DocumentSettingsData | null;
  /** Solo propietario/administrador pueden editar (settings.manage). Un
   * asistente/solo_lectura ve la información en modo lectura — antes se
   * mostraba un formulario totalmente interactivo que solo fallaba al
   * guardar (server-side + RLS), sin ninguna señal en la UI. */
  canManage: boolean;
};

const initialState: SettingsState = {};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const MARGIN_FIELDS = [
  { name: "margin_top_cm", label: "Superior" },
  { name: "margin_bottom_cm", label: "Inferior" },
  { name: "margin_left_cm", label: "Izquierdo" },
  { name: "margin_right_cm", label: "Derecho" },
] as const satisfies ReadonlyArray<{ name: keyof FormValues; label: string }>;

export function SettingsWorkspace({
  initialProfile,
  initialSettings,
  canManage,
}: Props) {
  const initialValues = buildValues(initialProfile, initialSettings);
  const savedRef = useRef<FormValues>(initialValues);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveSettingsAction,
    initialState,
  );

  const lastHandled = useRef<SettingsState | null>(null);
  useEffect(() => {
    if (state.success && lastHandled.current !== state) {
      lastHandled.current = state;
      savedRef.current = values;
      setDirty(false);
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

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800"
        >
          {state.message}
        </div>
      )}
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

      {/* ================= Perfil profesional ================= */}
      <section
        aria-labelledby="profile-heading"
        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 id="profile-heading" className="text-sm font-semibold text-slate-900">
            Perfil profesional
          </h2>
          <p className="text-xs text-slate-500">
            Información que se utilizará en los documentos generados.
          </p>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="full_name" className={labelClass}>
              Nombre completo{" "}
              <span aria-hidden="true" className="text-red-500">
                *
              </span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              disabled={!canManage}
              value={values.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              className={inputClass}
              placeholder="Lic. Ana García López"
              aria-describedby={errors?.full_name ? "full_name-error" : undefined}
              aria-invalid={!!errors?.full_name}
            />
            <FieldError id="full_name-error" message={errors?.full_name} />
          </div>

          <div>
            <label htmlFor="professional_code" className={labelClass}>
              Código profesional
            </label>
            <input
              id="professional_code"
              name="professional_code"
              type="text"
              disabled={!canManage}
              value={values.professional_code}
              onChange={(e) => setField("professional_code", e.target.value)}
              className={inputClass}
              placeholder="NP-1234"
            />
          </div>

          <div>
            <label htmlFor="profile-email" className={labelClass}>
              Correo de contacto
            </label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={!canManage}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputClass}
              placeholder="ana@despacho.com"
              aria-describedby={
                errors?.email ? "profile-email-error" : undefined
              }
              aria-invalid={!!errors?.email}
            />
            <FieldError id="profile-email-error" message={errors?.email} />
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              disabled={!canManage}
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={inputClass}
              placeholder="8888-8888"
            />
          </div>
        </div>
      </section>

      {/* ================= Configuración de documentos ================= */}
      <section
        aria-labelledby="docsettings-heading"
        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2
            id="docsettings-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Configuración de documentos
          </h2>
          <p className="text-xs text-slate-500">
            Valores predeterminados para los documentos Word generados.
          </p>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                aria-describedby={
                  errors?.font_family ? "font_family-error" : undefined
                }
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
                Tamaño de fuente (pt)
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
                aria-describedby={
                  errors?.font_size ? "font_size-error" : undefined
                }
                aria-invalid={!!errors?.font_size}
              />
              <FieldError id="font_size-error" message={errors?.font_size} />
            </div>
          </div>

          <fieldset>
            <legend className={labelClass}>Márgenes (cm)</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MARGIN_FIELDS.map(({ name, label }) => (
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
            </div>
          </fieldset>

          <div className="sm:max-w-xs">
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
              aria-describedby={
                errors?.line_spacing ? "line_spacing-error" : undefined
              }
              aria-invalid={!!errors?.line_spacing}
            />
            <FieldError id="line_spacing-error" message={errors?.line_spacing} />
          </div>
        </div>
      </section>

      {canManage && (
        <SettingsActionsBar dirty={dirty} pending={pending} onDiscard={handleDiscard} />
      )}
    </form>
  );
}
