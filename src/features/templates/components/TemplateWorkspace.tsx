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

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  createTemplateWorkspaceAction,
  updateTemplateWorkspaceAction,
  type TemplateWorkspaceState,
} from "../server/template-actions";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import type { TemplateDocument } from "@/lib/editor/types";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateMetadataForm } from "./TemplateMetadataForm";
import {
  TemplateMobileViewToggle,
  type TemplateMobileView,
} from "./TemplateMobileViewToggle";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { TemplateSaveControls } from "./TemplateSaveControls";
import { TemplateVariablesPanel } from "./TemplateVariablesPanel";
import { useTemplatePreview } from "../hooks/use-template-preview";

// ------------------------------------------------------------------ props

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
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
  const [mobileView, setMobileView] = useState<TemplateMobileView>("edit");
  const expectedUpdatedAtRef = useRef<HTMLInputElement>(null);

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
      if (state.updatedAt && expectedUpdatedAtRef.current) {
        expectedUpdatedAtRef.current.value = state.updatedAt;
      }
    }
  }, [state]);

  const { contentKeys, model: previewModel } =
    useTemplatePreview(documentJson);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  const showSavedBanner =
    !dirty &&
    !pending &&
    (state.success || (isEdit && props.createdJustNow && !state.message));

  return (
    <form action={formAction} noValidate>
      {/* Datos serializados que acompañan al submit. */}
      <input
        type="hidden"
        name="document"
        value={JSON.stringify(documentJson)}
      />
      <input type="hidden" name="variables" value={JSON.stringify(variables)} />
      {isEdit && (
        <input
          ref={expectedUpdatedAtRef}
          type="hidden"
          name="expected_updated_at"
          defaultValue={
            props.mode === "edit" ? props.template.updated_at : ""
          }
        />
      )}

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

      <TemplateMobileViewToggle value={mobileView} onChange={setMobileView} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ================= columna de edición ================= */}
        <div
          className={`space-y-6 ${mobileView === "preview" ? "hidden xl:block" : ""}`}
        >
          <TemplateMetadataForm
            name={name}
            description={description}
            status={status}
            errors={state.errors}
            onNameChange={(value) => {
              setName(value);
              markDirty();
            }}
            onDescriptionChange={(value) => {
              setDescription(value);
              markDirty();
            }}
            onStatusChange={(value) => {
              setStatus(value);
              markDirty();
            }}
          />

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
          <TemplatePreviewPanel model={previewModel} />
        </div>
      </div>

      <TemplateSaveControls
        dirty={dirty}
        pending={pending}
        saved={!!state.success}
        isEdit={isEdit}
      />
    </form>
  );
}
