"use client";

/**
 * Workspace unificado de machotes.
 *
 * Crear y editar usan exactamente esta interfaz: información básica,
 * editor enriquecido, variables unificadas y preview documental. En modo
 * create todo permanece local hasta guardar (machote + variables se crean
 * en un solo submit); en modo edit se muestra el estado de cambios sin
 * guardar. No hay autoguardado.
 *
 * En modo edit, el contenido se organiza en tres secciones navegables
 * (Documento / Variables / Índice notarial) mediante `TemplateWorkspaceHeader`.
 * Las tres permanecen siempre montadas — solo se ocultan con CSS — para que
 * cambiar de sección nunca reinicie el editor Tiptap ni descarte cambios sin
 * guardar. La configuración del índice notarial vive en un `<form>` propio,
 * hermano del formulario de documento/variables, para evitar formularios
 * anidados.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  createTemplateWorkspaceAction,
  updateTemplateWorkspaceAction,
  type TemplateWorkspaceState,
} from "../server/template-actions";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import type { TemplateDocument } from "@/lib/editor/types";
import { TemplateEditor, type TemplateEditorHandle } from "./TemplateEditor";
import { TemplateMetadataForm } from "./TemplateMetadataForm";
import {
  TemplateMobileViewToggle,
  type TemplateMobileView,
} from "./TemplateMobileViewToggle";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { TemplateSaveControls } from "./TemplateSaveControls";
import { TemplateVariablesPanel } from "./TemplateVariablesPanel";
import {
  TemplateWorkspaceHeader,
  type TemplateWorkspaceSection,
} from "./TemplateWorkspaceHeader";
import { useTemplatePreview } from "../hooks/use-template-preview";
import {
  TemplateIndexConfigurationSection,
  type IndexConfigurationField,
  type TemplateIndexConfiguration,
} from "@/features/notarial-index";

// ------------------------------------------------------------------ props

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
};

type EditModeProps = {
  mode: "edit";
  template: WorkspaceTemplate;
  createdJustNow?: boolean;
  initialSection?: TemplateWorkspaceSection;
  indexConfiguration: TemplateIndexConfiguration | null;
  indexFields: IndexConfigurationField[];
  headerActions?: React.ReactNode;
};

type Props = {
  initialDocument: TemplateDocument;
  initialVariables: TemplateWorkspaceVariable[];
} & ({ mode: "create" } | EditModeProps);

const initialState: TemplateWorkspaceState = {};

function resolveSection(raw: string | null): TemplateWorkspaceSection {
  return raw === "variables" || raw === "notarial" ? raw : "document";
}

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
  const [section, setSection] = useState<TemplateWorkspaceSection>(
    isEdit ? (props.initialSection ?? "document") : "document",
  );
  const expectedUpdatedAtRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TemplateEditorHandle>(null);

  // Mantiene la URL sincronizada con la sección activa sin disparar una
  // navegación real (evita remontar el editor). `popstate` cubre
  // atrás/adelante del navegador.
  useEffect(() => {
    if (!isEdit) return;
    function onPopState() {
      setSection(resolveSection(new URLSearchParams(window.location.search).get("section")));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isEdit]);

  const goToSection = useCallback(
    (next: TemplateWorkspaceSection) => {
      setSection(next);
      if (typeof window === "undefined") return;
      const url =
        next === "document"
          ? window.location.pathname
          : `${window.location.pathname}?section=${next}`;
      window.history.pushState(null, "", url);
    },
    [],
  );

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

  /**
   * Único punto de entrada para cambios desde la pestaña Variables. El nodo
   * Tiptap de cada variable guarda su propia copia de `label` (para poder
   * mostrarla sin depender de la configuración externa); si esta lista trae
   * una etiqueta distinta para una clave ya presente, empuja el cambio a
   * los nodos existentes en el editor para que la ficha y la vista previa
   * dejen de mostrar la etiqueta anterior.
   */
  function handleVariablesChange(next: TemplateWorkspaceVariable[]) {
    for (const nextVariable of next) {
      const previous = variables.find(
        (v) => v.field_key === nextVariable.field_key,
      );
      if (previous && previous.label !== nextVariable.label) {
        editorRef.current?.updateVariableLabel(
          nextVariable.field_key,
          nextVariable.label,
        );
      }
    }
    setVariables(next);
    markDirty();
  }

  const showSavedBanner =
    !dirty &&
    !pending &&
    (state.success || (isEdit && props.createdJustNow && !state.message));

  const saveStatusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : "Guardado";

  return (
    <div>
      {isEdit && (
        <TemplateWorkspaceHeader
          name={name}
          status={status}
          section={section}
          statusText={saveStatusText}
          onSectionChange={goToSection}
          actions={props.mode === "edit" ? props.headerActions : undefined}
        />
      )}

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

        {/* ================= Documento ================= */}
        <div
          id="template-panel-document"
          role={isEdit ? "tabpanel" : undefined}
          aria-labelledby={isEdit ? "template-tab-document" : undefined}
          hidden={isEdit && section !== "document"}
        >
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
                    ref={editorRef}
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

              {!isEdit && (
                <TemplateVariablesPanel
                  variables={variables}
                  contentKeys={contentKeys}
                  onChange={handleVariablesChange}
                />
              )}
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
        </div>

        {/* ================= Variables (solo edit) ================= */}
        {isEdit && (
          <div
            id="template-panel-variables"
            role="tabpanel"
            aria-labelledby="template-tab-variables"
            hidden={section !== "variables"}
          >
            <TemplateVariablesPanel
              variables={variables}
              contentKeys={contentKeys}
              onChange={handleVariablesChange}
            />
          </div>
        )}

        {section !== "notarial" && (
          <TemplateSaveControls
            dirty={dirty}
            pending={pending}
            saved={!!state.success}
            isEdit={isEdit}
          />
        )}
      </form>

      {/* ================= Índice notarial (solo edit) =================
          Hermano del <form> de arriba, no descendiente: tiene su propio
          <form> con su propia Server Action y no puede anidarse dentro. */}
      {isEdit && (
        <div
          id="template-panel-notarial"
          role="tabpanel"
          aria-labelledby="template-tab-notarial"
          hidden={section !== "notarial"}
        >
          <TemplateIndexConfigurationSection
            templateId={props.template.id}
            configuration={props.indexConfiguration}
            fields={props.indexFields}
          />
        </div>
      )}
    </div>
  );
}
