"use client";

/**
 * Workspace unificado de machotes.
 *
 * Crear y editar usan exactamente esta interfaz: información básica,
 * editor enriquecido, variables unificadas y preview documental. En modo
 * create todo permanece local hasta guardar (machote + variables se crean
 * en un solo submit); en modo edit se muestra el estado de cambios sin
 * guardar. No hay autoguardado.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useId } from "react";
import {
  createTemplateWorkspaceAction,
  updateTemplateWorkspaceAction,
  type TemplateWorkspaceState,
} from "../actions";
import type { TemplateWorkspaceVariable } from "@/lib/validations/template-workspace";
import type { TemplateDocument } from "@/lib/editor/types";
import { validateTemplateDocument } from "@/lib/editor/validate";
import { extractTemplateVariablesFromDocument } from "@/lib/editor/variables";
import { buildDocumentModel } from "@/lib/editor/render";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateVariablesPanel } from "./TemplateVariablesPanel";
import { DocumentSheet } from "@/components/document/DocumentSheet";
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "archived", label: "Archivado" },
] as const;

// ------------------------------------------------------------------ props

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type Props = {
  initialDocument: TemplateDocument;
  initialVariables: TemplateWorkspaceVariable[];
} & (
  | { mode: "create" }
  | { mode: "edit"; template: WorkspaceTemplate; createdJustNow?: boolean }
);

const initialState: TemplateWorkspaceState = {};

// ------------------------------------------------------------------ component

export function TemplateWorkspace(props: Props) {
  const isEdit = props.mode === "edit";
  const template = isEdit ? props.template : null;

  const nameId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const previewHeadingId = useId();

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [status, setStatus] = useState(template?.status ?? "draft");
  const [documentJson, setDocumentJson] = useState<unknown>(
    props.initialDocument,
  );
  const [variables, setVariables] = useState<TemplateWorkspaceVariable[]>(
    props.initialVariables,
  );
  const [dirty, setDirty] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  const action = isEdit
    ? updateTemplateWorkspaceAction.bind(null, template!.id)
    : createTemplateWorkspaceAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Un guardado exitoso limpia el estado de cambios sin guardar.
  const lastSuccess = useRef<TemplateWorkspaceState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      setDirty(false);
    }
  }, [state]);

  // El preview consume el documento validado; mientras el usuario escribe,
  // el JSON del editor siempre proviene del esquema restringido, así que la
  // validación solo falla ante estados imposibles (y evita renderizar algo
  // fuera del esquema).
  const previewDocument = useMemo(() => {
    const validation = validateTemplateDocument(documentJson);
    return validation.ok ? validation.document : null;
  }, [documentJson]);

  const contentKeys = useMemo(
    () =>
      previewDocument
        ? extractTemplateVariablesFromDocument(previewDocument)
        : [],
    [previewDocument],
  );

  const previewModel = useMemo(
    () => (previewDocument ? buildDocumentModel(previewDocument) : []),
    [previewDocument],
  );

  function markDirty() {
    if (!dirty) setDirty(true);
  }

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
    (state.success || (isEdit && props.createdJustNow && !state.message));

  const mobileTabClass = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <form action={formAction} noValidate>
      {/* Datos serializados que acompañan al submit. */}
      <input
        type="hidden"
        name="document"
        value={JSON.stringify(documentJson)}
      />
      <input type="hidden" name="variables" value={JSON.stringify(variables)} />

      {/* ---- feedback global ---- */}
      {showSavedBanner && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800"
        >
          {isEdit && props.createdJustNow && !state.success
            ? "Machote creado."
            : "Machote guardado."}
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
      {(state.errors?.document || state.errors?.variables) && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.errors.document ?? state.errors.variables}
        </div>
      )}

      {/* ---- selector móvil Editar | Vista previa ---- */}
      <div className="mb-6 flex gap-2 xl:hidden" role="group" aria-label="Vista">
        <button
          type="button"
          onClick={() => setMobileView("edit")}
          aria-pressed={mobileView === "edit"}
          className={mobileTabClass(mobileView === "edit")}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          aria-pressed={mobileView === "preview"}
          className={mobileTabClass(mobileView === "preview")}
        >
          Vista previa
        </button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ================= columna de edición ================= */}
        <div
          className={`space-y-6 ${mobileView === "preview" ? "hidden xl:block" : ""}`}
        >
          {/* ---- información básica ---- */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-semibold text-slate-900">
                Información básica
              </h2>
              <p className="text-xs text-slate-500">
                Los campos marcados con{" "}
                <span aria-hidden="true" className="text-red-500 font-semibold">
                  *
                </span>{" "}
                son obligatorios.
              </p>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
                <div>
                  <label htmlFor={nameId} className={labelClass}>
                    Nombre del machote{requiredMark}
                  </label>
                  <input
                    id={nameId}
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      markDirty();
                    }}
                    className={inputClass}
                    placeholder="Ej: Contrato de Arrendamiento Residencial"
                    aria-describedby={
                      state.errors?.name ? `${nameId}-error` : undefined
                    }
                    aria-invalid={!!state.errors?.name}
                  />
                  <FieldError id={`${nameId}-error`} message={state.errors?.name} />
                </div>

                <div className="sm:w-44">
                  <label htmlFor={statusId} className={labelClass}>
                    Estado{requiredMark}
                  </label>
                  <select
                    id={statusId}
                    name="status"
                    required
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      markDirty();
                    }}
                    className={inputClass}
                    aria-describedby={
                      state.errors?.status ? `${statusId}-error` : undefined
                    }
                    aria-invalid={!!state.errors?.status}
                  >
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id={`${statusId}-error`}
                    message={state.errors?.status}
                  />
                </div>
              </div>

              <div>
                <label htmlFor={descriptionId} className={labelClass}>
                  Descripción{" "}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  id={descriptionId}
                  name="description"
                  type="text"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    markDirty();
                  }}
                  className={inputClass}
                  placeholder="Descripción breve del propósito del machote"
                  aria-describedby={
                    state.errors?.description
                      ? `${descriptionId}-error`
                      : undefined
                  }
                  aria-invalid={!!state.errors?.description}
                />
                <FieldError
                  id={`${descriptionId}-error`}
                  message={state.errors?.description}
                />
              </div>
            </div>
          </section>

          {/* ---- contenido ---- */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-semibold text-slate-900">
                Contenido del machote
              </h2>
              <p className="text-xs text-slate-500">
                Redacta el documento e inserta variables donde va la
                información de cada escritura.
              </p>
            </div>
            <div className="px-6 py-5">
              <TemplateEditor
                initialDocument={props.initialDocument}
                variables={variables}
                onDocumentChange={(json) => {
                  setDocumentJson(json);
                  markDirty();
                }}
                onCreateVariable={(variable) => {
                  setVariables((current) => [...current, variable]);
                  markDirty();
                }}
              />
            </div>
          </section>

          {/* ---- variables unificadas ---- */}
          <TemplateVariablesPanel
            variables={variables}
            contentKeys={contentKeys}
            onChange={(next) => {
              setVariables(next);
              markDirty();
            }}
          />
        </div>

        {/* ================= vista previa ================= */}
        <div
          className={`xl:sticky xl:top-6 ${
            mobileView === "edit" ? "hidden xl:block" : ""
          }`}
        >
          <section
            aria-labelledby={previewHeadingId}
            className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2
                id={previewHeadingId}
                className="text-sm font-semibold text-slate-900"
              >
                Vista previa
              </h2>
              <p className="text-xs text-slate-500">
                Así se verá el documento; las variables aparecen resaltadas.
              </p>
            </div>
            <div className="p-4 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto">
              <DocumentSheet
                model={previewModel}
                pendingVariableDisplay="label"
                emptyMessage="Escribe el contenido para ver la vista previa."
                aria-labelledby={previewHeadingId}
              />
            </div>
          </section>
        </div>
      </div>

      {/* ---- barra de guardado ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 pt-6">
        <p
          role="status"
          className={`text-sm ${
            dirty && !pending ? "text-amber-700 font-medium" : "text-slate-500"
          }`}
        >
          {saveStatusText}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear machote"}
        </button>
      </div>
    </form>
  );
}
