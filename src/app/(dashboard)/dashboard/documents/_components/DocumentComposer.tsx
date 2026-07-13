"use client";

/**
 * Compositor documental de escrituras.
 *
 * El documento es la zona principal (hoja documental); los datos se
 * completan en un panel lateral. Los valores escritos se reflejan de
 * inmediato en la hoja (modelo local), pero la persistencia es explícita:
 * Guardar borrador valida y regenera el snapshot en el servidor.
 *
 * Relación documento-campo con IDs estables:
 * - enfocar un campo resalta sus apariciones en la hoja;
 * - hacer clic en una variable pendiente de la hoja enfoca su campo.
 */

import { useMemo, useRef, useState } from "react";
import { useActionState, useEffect } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  createDocumentDraftAction,
  updateDocumentDraftAction,
  type DocumentDraftState,
} from "../actions";
import type { DocumentRow } from "../queries";
import type { FillableTemplateField } from "@/lib/templates/fillable-fields";
import type { TemplateDocument } from "@/lib/editor/types";
import { buildDocumentModel } from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import { DocumentSheet } from "@/components/document/DocumentSheet";
import { DownloadDocxButton } from "./DownloadDocxButton";
import { DocumentStatusControls } from "./DocumentStatusControls";
import {
  isDocumentStatus,
  isReadOnlyStatus,
  type DocumentStatus,
} from "@/lib/documents/lifecycle";
import { FieldError } from "@/components/forms/FieldError";

// ------------------------------------------------------------------ styles

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

function fieldInputId(fieldKey: string): string {
  // Los puntos son válidos en id, pero se normalizan para selectores CSS.
  return `composer-field-${fieldKey.replace(/\./g, "_")}`;
}

// ------------------------------------------------------------------ props

type Props = {
  /** Documento del machote con etiquetas aplicadas. */
  document: TemplateDocument;
  fields: FillableTemplateField[];
  templateName: string;
  /** Clientes propios para el selector "Cliente principal (opcional)". */
  clients: { id: string; full_name: string }[];
  /** Cliente preseleccionado (create) o asociado actual (edit). */
  initialClientId: string | null;
} & (
  | { mode: "create"; templateId: string; defaultTitle: string }
  | { mode: "edit"; draft: DocumentRow; savedJustNow?: boolean }
);

const initialState: DocumentDraftState = {};

// ------------------------------------------------------------------ component

export function DocumentComposer(props: Props) {
  const { document, fields, templateName, clients } = props;
  const isEdit = props.mode === "edit";
  const draft = isEdit ? props.draft : null;

  // Estado del ciclo de vida. Finalizado (final) es de solo lectura.
  const status: DocumentStatus =
    draft && isDocumentStatus(draft.status) ? draft.status : "draft";
  const readOnly = isEdit && isReadOnlyStatus(status);

  const action = isEdit
    ? updateDocumentDraftAction.bind(null, props.draft.id)
    : createDocumentDraftAction.bind(null, props.templateId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [title, setTitle] = useState(
    isEdit ? props.draft.title : props.defaultTitle,
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.field_key] = draft?.field_values[field.field_key] ?? "";
    }
    return initial;
  });
  const [clientId, setClientId] = useState(props.initialClientId ?? "");
  const [dirty, setDirty] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | undefined>();
  const [mobileView, setMobileView] = useState<"data" | "document">("data");
  const [fieldFilter, setFieldFilter] = useState<"all" | "pending">("all");

  // Un guardado exitoso limpia el estado de cambios sin guardar.
  const lastSuccess = useRef<DocumentDraftState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      setDirty(false);
    }
  }, [state]);

  // Modelo local del documento con los valores actuales (antes de guardar).
  const model = useMemo(
    () => buildDocumentModel(document, values),
    [document, values],
  );

  // Variables pendientes del estado PERSISTIDO (no del local): el Word usa
  // siempre el último borrador guardado, así que la confirmación de descarga
  // se calcula sobre draft.field_values, no sobre lo que se está escribiendo.
  const persistedPendingCount = draft
    ? findUnresolvedDocumentVariables(document, draft.field_values).length
    : 0;

  const completedCount = fields.filter(
    (field) => (values[field.field_key] ?? "").trim() !== "",
  ).length;

  // Con el filtro "Pendientes", un campo permanece visible mientras está
  // enfocado aunque deje de estar vacío (no desaparece mientras se escribe).
  const visibleFields =
    fieldFilter === "pending"
      ? fields.filter(
          (field) =>
            (values[field.field_key] ?? "").trim() === "" ||
            field.field_key === focusedKey,
        )
      : fields;

  const hiddenFields = fields.filter(
    (field) => !visibleFields.includes(field),
  );

  const saveStatusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : state.success || isEdit
        ? "Guardado"
        : "Sin guardar";

  const showSavedBanner =
    !dirty &&
    !pending &&
    (state.success ||
      (isEdit && props.savedJustNow && !state.message && !state.errors));

  // En móvil hay que mostrar el panel de datos ANTES de poder enfocar el
  // input: flushSync garantiza que el re-render ya ocurrió.
  function focusField(key: string) {
    flushSync(() => setMobileView("data"));
    const input = globalThis.document.getElementById(fieldInputId(key));
    if (input instanceof HTMLElement) {
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  const mobileTabClass = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
    }`;

  const filterButtonClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <form action={formAction} noValidate>
      {/* Los campos ocultos por el filtro siguen enviándose en el submit
          para no perder sus valores. */}
      {hiddenFields.map((field) => (
        <input
          key={field.field_key}
          type="hidden"
          name={field.field_key}
          value={values[field.field_key] ?? ""}
        />
      ))}

      {/* ---- feedback global ---- */}
      {showSavedBanner && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800"
        >
          Borrador guardado.
        </div>
      )}
      {state.message && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      {/* ---- selector móvil Datos | Documento ---- */}
      <div className="mb-6 flex gap-2 xl:hidden" role="group" aria-label="Vista">
        <button
          type="button"
          onClick={() => setMobileView("data")}
          aria-pressed={mobileView === "data"}
          className={mobileTabClass(mobileView === "data")}
        >
          Datos
        </button>
        <button
          type="button"
          onClick={() => setMobileView("document")}
          aria-pressed={mobileView === "document"}
          className={mobileTabClass(mobileView === "document")}
        >
          Documento
        </button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {/* ================= documento ================= */}
        <section
          aria-labelledby="composer-document-heading"
          className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${
            mobileView === "data" ? "hidden xl:block" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <h2
                id="composer-document-heading"
                className="text-sm font-semibold text-slate-900"
              >
                Documento
              </h2>
              <p className="text-xs text-slate-500">Machote: {templateName}</p>
            </div>
            {dirty && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Cambios sin guardar
              </span>
            )}
          </div>
          <div className="p-4">
            <DocumentSheet
              model={model}
              pendingVariableDisplay="placeholder"
              emptyMessage="El machote no tiene contenido."
              aria-labelledby="composer-document-heading"
              highlightKey={focusedKey}
              onVariableClick={focusField}
            />
          </div>
        </section>

        {/* ================= panel de datos ================= */}
        <section
          aria-labelledby="composer-data-heading"
          className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden xl:sticky xl:top-6 ${
            mobileView === "document" ? "hidden xl:block" : ""
          }`}
        >
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <h2
              id="composer-data-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Datos de la escritura
            </h2>
            <p className="text-xs text-slate-500">
              Lo que escribas se refleja de inmediato en el documento.
            </p>
          </div>

          <div className="px-6 py-5 space-y-5 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto">
            {/* ---- título ---- */}
            <div>
              <label htmlFor="composer-title" className={labelClass}>
                Título de la escritura{requiredMark}
              </label>
              <input
                id="composer-title"
                name="title"
                type="text"
                required
                value={title}
                disabled={readOnly}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
                className={inputClass}
                aria-describedby={
                  state.titleError ? "composer-title-error" : undefined
                }
                aria-invalid={!!state.titleError}
              />
              <FieldError
                id="composer-title-error"
                message={state.titleError}
              />
            </div>

            {/* ---- cliente principal (opcional) ---- */}
            <div>
              <label htmlFor="composer-client" className={labelClass}>
                Cliente principal{" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <select
                id="composer-client"
                name="client_id"
                value={clientId}
                disabled={readOnly}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setDirty(true);
                }}
                className={inputClass}
              >
                <option value="">Sin cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* ---- progreso ---- */}
            {fields.length > 0 && (
              <div>
                <p role="status" className="text-xs font-medium text-slate-600">
                  {completedCount} de {fields.length} campos completados
                </p>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{
                      width: `${fields.length === 0 ? 0 : Math.round((completedCount / fields.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ---- filtro ---- */}
            {fields.length > 1 && (
              <div
                role="group"
                aria-label="Filtrar campos"
                className="flex gap-2"
              >
                <button
                  type="button"
                  onClick={() => setFieldFilter("all")}
                  aria-pressed={fieldFilter === "all"}
                  className={filterButtonClass(fieldFilter === "all")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFieldFilter("pending")}
                  aria-pressed={fieldFilter === "pending"}
                  className={filterButtonClass(fieldFilter === "pending")}
                >
                  Pendientes
                </button>
              </div>
            )}

            {/* ---- campos ---- */}
            {fields.length === 0 ? (
              <p className="text-sm text-slate-500">
                Este machote no tiene variables: el documento es texto fijo y
                solo necesita un título.
              </p>
            ) : visibleFields.length === 0 ? (
              <p className="text-sm text-teal-700">
                Todos los campos están completos.
              </p>
            ) : (
              visibleFields.map((field) => {
                const id = fieldInputId(field.field_key);
                const errorId = `${id}-error`;
                const error = state.errors?.[field.field_key];
                return (
                  <div key={field.field_key}>
                    <label htmlFor={id} className={labelClass}>
                      {field.label}
                      {field.required ? (
                        requiredMark
                      ) : (
                        <span className="text-slate-400 font-normal">
                          {" "}
                          (opcional)
                        </span>
                      )}
                    </label>
                    <input
                      id={id}
                      name={field.field_key}
                      type="text"
                      required={field.required}
                      value={values[field.field_key] ?? ""}
                      disabled={readOnly}
                      onChange={(event) => {
                        setValues((current) => ({
                          ...current,
                          [field.field_key]: event.target.value,
                        }));
                        setDirty(true);
                      }}
                      onFocus={() => setFocusedKey(field.field_key)}
                      onBlur={() => setFocusedKey(undefined)}
                      className={inputClass}
                      aria-describedby={error ? errorId : undefined}
                      aria-invalid={!!error}
                    />
                    <FieldError id={errorId} message={error} />
                  </div>
                );
              })
            )}
          </div>

          {/* ---- guardado ---- */}
          <div className="border-t border-slate-100 px-6 py-4 space-y-3">
            {readOnly ? (
              <p role="status" className="text-xs text-slate-500">
                Esta escritura está finalizada (solo lectura). Reábrela para
                editarla de nuevo.
              </p>
            ) : (
              <>
                <p
                  role="status"
                  className={`text-xs ${
                    dirty && !pending
                      ? "text-amber-700 font-medium"
                      : "text-slate-500"
                  }`}
                >
                  {saveStatusText}
                </p>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? "Guardando…" : "Guardar borrador"}
                </button>
              </>
            )}

            {/* Controles del ciclo de vida (solo escrituras guardadas). */}
            {isEdit && (
              <DocumentStatusControls
                documentId={draft!.id}
                status={status}
                dirty={dirty}
              />
            )}

            {/* Descarga Word: disponible en los tres estados; usa siempre la
                última versión persistida, por eso se bloquea si hay cambios. */}
            {isEdit && (
              <DownloadDocxButton
                documentId={draft!.id}
                disabled={dirty}
                pendingVariableCount={persistedPendingCount}
              />
            )}

            <Link
              href="/dashboard/documents"
              className="block w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Volver a Escrituras
            </Link>
          </div>
        </section>
      </div>
    </form>
  );
}
