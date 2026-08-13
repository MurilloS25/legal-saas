"use client";

/**
 * Workspace unificado de machotes.
 *
 * Crear y editar usan exactamente esta interfaz, incluyendo el stepper: no
 * existe un flujo alternativo de una sola página para el modo creación — el
 * usuario entra al flujo guiado (Información → Documento → Variables →
 * Índice → Publicar) desde el momento en que presiona "Nuevo machote". En
 * modo create todo permanece local hasta el primer guardado (machote +
 * variables se crean en un solo submit, que redirige a la URL de edición);
 * en modo edit se muestra además el estado de cambios sin guardar. No hay
 * autoguardado.
 *
 * Los cinco pasos permanecen siempre montados — solo se ocultan con CSS —
 * para que cambiar de paso nunca reinicie el editor Tiptap ni descarte datos
 * sin guardar, tanto antes como después del primer guardado. Solo "Índice"
 * está bloqueado antes de que el machote exista (depende de `template_id`);
 * el resto de los pasos opera sobre estado local puro y es igual de
 * funcional en ambos modos. La configuración del índice notarial vive en un
 * `<form>` propio, hermano del formulario de documento/variables, para
 * evitar formularios anidados.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { flushSync } from "react-dom";
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
import { TemplateVariablesPanel, buildVariableRows } from "./TemplateVariablesPanel";
import {
  TemplateWorkspaceHeader,
  type TemplateWorkspaceSection,
} from "./TemplateWorkspaceHeader";
import { useTemplatePreview } from "../hooks/use-template-preview";
import {
  TemplateIndexConfigurationSection,
  type IndexConfigurationField,
  type IndexConfigurationOptionBlock,
  type TemplateIndexConfiguration,
} from "@/features/notarial-index";
import {
  MilestoneFeedback,
  MilestoneFeedbackAction,
} from "@/components/feedback/MilestoneFeedback";
import { ResizableSplitPane } from "@/components/document/ResizableSplitPane";
import { ExpandableDocumentPanel } from "@/components/document/ExpandableDocumentPanel";
import { AiHelpDialog } from "./AiHelpDialog";

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
  indexOptionBlocks: IndexConfigurationOptionBlock[];
  headerActions?: React.ReactNode;
  /** templates.write — la página ya bloquea /new sin este permiso, así que
   * en modo "create" siempre es true (ver el mismo patrón en
   * ClientForm/ReceivableForm/DocumentComposer). */
  canWrite: boolean;
};

type Props = {
  initialDocument: TemplateDocument;
  initialVariables: TemplateWorkspaceVariable[];
} & ({ mode: "create" } | EditModeProps);

const initialState: TemplateWorkspaceState = {};

function resolveSection(raw: string | null): TemplateWorkspaceSection {
  return raw === "information" ||
    raw === "variables" ||
    raw === "notarial" ||
    raw === "publish"
    ? raw
    : "document";
}

// ------------------------------------------------------------------ component

export function TemplateWorkspace(props: Props) {
  const isEdit = props.mode === "edit";
  const template = isEdit ? props.template : null;
  const canWrite = isEdit ? props.canWrite : true;

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
  const [milestoneDismissed, setMilestoneDismissed] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const expectedUpdatedAtRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TemplateEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const aiHelpButtonRef = useRef<HTMLButtonElement>(null);

  function closeAiHelp() {
    setAiHelpOpen(false);
    window.setTimeout(() => aiHelpButtonRef.current?.focus(), 0);
  }

  // Mantiene la URL sincronizada con la sección activa sin disparar una
  // navegación real (evita remontar el editor). `popstate` cubre
  // atrás/adelante del navegador. Activo en ambos modos: el stepper es
  // navegable desde el modo creación también.
  useEffect(() => {
    function onPopState() {
      const next = resolveSection(
        new URLSearchParams(window.location.search).get("section"),
      );
      // "notarial" depende de que el machote ya exista — en modo creación,
      // ignorar un intento de llegar ahí por URL en vez de exponer el
      // formulario real (que necesita template_id).
      setSection(next === "notarial" && !isEdit ? "document" : next);
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

  // Señales de completitud reales para el stepper — no hay ningún paso
  // "bloqueado" en Machotes (todo es libremente navegable), pero sí
  // marcamos "complete" cuando hay una condición derivable, igual que ya
  // hace la lista de Variables o el banner de completitud del Índice.
  const informationComplete = name.trim() !== "";
  const variablesPendingCount = buildVariableRows(variables, contentKeys).filter(
    (row) => row.status === "pending",
  ).length;
  const indexComplete = isEdit ? (props.indexConfiguration?.isComplete ?? false) : false;
  // El Índice depende de template_id — no puede configurarse antes del
  // primer guardado, sin importar qué tan completos estén los demás pasos.
  const indexLocked = !isEdit;

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

  /**
   * "Guardar variable" en modo edición: persiste de inmediato, sin esperar
   * a "Guardar cambios". `flushSync` fuerza el commit de `setVariables`
   * antes de leer el DOM, para que el input oculto `variables` ya refleje
   * el nuevo valor cuando `requestSubmit` arma el envío — si no, el submit
   * podría ir con el valor anterior (una carrera entre el render y el
   * envío). Reutiliza el mismo action/RPC que "Guardar cambios", así que
   * la protección de concurrencia optimista (`expected_updated_at`) aplica
   * igual aquí.
   */
  function saveVariableNow(next: TemplateWorkspaceVariable[]) {
    flushSync(() => {
      handleVariablesChange(next);
    });
    formRef.current?.requestSubmit();
  }

  // El hito "recién creado" solo aplica hasta el primer guardado posterior
  // real: en cuanto state.success pasa a true por una acción nueva, el
  // machote deja de ser "recién creado" y vuelve al feedback simple.
  const isFirstSaveMilestone =
    isEdit && props.createdJustNow && !state.success && !state.message;
  const bannerKind: "milestone" | "saved" | null =
    dirty || pending
      ? null
      : isFirstSaveMilestone && !milestoneDismissed
        ? "milestone"
        : state.success
          ? "saved"
          : null;

  const saveStatusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : "Guardado";

  return (
    <div>
      <TemplateWorkspaceHeader
        name={name}
        status={status}
        section={section}
        statusText={saveStatusText}
        onSectionChange={goToSection}
        informationComplete={informationComplete}
        variablesPendingCount={variablesPendingCount}
        indexComplete={indexComplete}
        indexLocked={indexLocked}
        actions={props.mode === "edit" ? props.headerActions : undefined}
      />

      <form ref={formRef} action={formAction} noValidate>
        {/* Datos serializados que acompañan al submit. */}
        <input
          type="hidden"
          name="document"
          value={JSON.stringify(documentJson)}
        />
        <input type="hidden" name="variables" value={JSON.stringify(variables)} />
        {/* Paso activo al momento de guardar — el primer guardado (modo
            create) lo usa para redirigir a la misma pestaña en vez de
            reiniciar en "Documento", así la transición create → edit se
            siente como continuación del mismo stepper. */}
        <input type="hidden" name="section" value={section} />
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
        {bannerKind === "milestone" && (
          <MilestoneFeedback
            title="Machote creado correctamente"
            description="Ahora puedes configurar sus Variables y la información del Índice Notarial."
            actions={
              <>
                <MilestoneFeedbackAction
                  label="Revisar Variables"
                  onClick={() => goToSection("variables")}
                />
                <MilestoneFeedbackAction
                  label="Configurar Índice Notarial"
                  onClick={() => goToSection("notarial")}
                />
              </>
            }
            onDismiss={() => setMilestoneDismissed(true)}
            clearParams={["created"]}
          />
        )}
        {bannerKind === "saved" && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-accent-50 border border-accent-200 px-4 py-3 text-sm text-accent-800"
          >
            Machote guardado.
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

        {/* ================= Información ================= */}
        <div
          id="template-panel-information"
          role="tabpanel"
          aria-labelledby="template-tab-information"
          hidden={section !== "information"}
        >
          <TemplateMetadataForm
            name={name}
            description={description}
            status={status}
            errors={state.errors}
            disabled={!canWrite}
            fieldset="info"
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
        </div>

        {/* ================= Documento ================= */}
        <div
          id="template-panel-document"
          role="tabpanel"
          aria-labelledby="template-tab-document"
          hidden={section !== "document"}
        >
          <TemplateMobileViewToggle value={mobileView} onChange={setMobileView} />

          <ResizableSplitPane
            secondaryTitle="Vista previa"
            onExpand={() => setPreviewExpanded(true)}
            primaryClassName={mobileView === "preview" ? "hidden xl:block" : ""}
            secondaryClassName={mobileView === "edit" ? "hidden xl:block" : ""}
            primary={
              <div className="space-y-6">
                {/* ---- contenido ---- */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Contenido del machote
                      </h2>
                      <p className="text-xs text-slate-500">
                        Redacta el documento e inserta variables donde va la
                        información de cada escritura.
                      </p>
                    </div>
                    <button
                      type="button"
                      ref={aiHelpButtonRef}
                      onClick={() => setAiHelpOpen(true)}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                    >
                      Ayuda para crear con IA
                    </button>
                  </div>
                  <div className="px-6 py-5">
                    <TemplateEditor
                      ref={editorRef}
                      initialDocument={props.initialDocument}
                      variables={variables}
                      editable={canWrite}
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
              </div>
            }
            secondary={<TemplatePreviewPanel model={previewModel} bare />}
          />
        </div>

        {/* ================= Variables ================= */}
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
            onSaveVariable={isEdit ? saveVariableNow : undefined}
            readOnly={!canWrite}
          />
        </div>

        {/* ================= Publicar ================= */}
        <div
          id="template-panel-publish"
          role="tabpanel"
          aria-labelledby="template-tab-publish"
          hidden={section !== "publish"}
        >
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                <h2 className="text-sm font-semibold text-slate-900">
                  Resumen antes de publicar
                </h2>
                <p className="text-xs text-slate-500">
                  Publicar solo cambia el estado — no exige que las
                  variables o el Índice Notarial estén completos.
                </p>
              </div>
              <div className="px-6 py-5 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nombre</span>
                  <span className="font-medium text-slate-900">
                    {name || "Sin nombre"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Variables configuradas</span>
                  <span className="font-medium text-slate-900">
                    {variables.length - variablesPendingCount} de {variables.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Índice notarial</span>
                  <span className="font-medium text-slate-900">
                    {isEdit
                      ? indexComplete
                        ? "Completo"
                        : "Parcial u opcional"
                      : "Disponible después de guardar"}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                <h2 className="text-sm font-semibold text-slate-900">Estado</h2>
              </div>
              <div className="px-6 py-5 max-w-xs">
                <TemplateMetadataForm
                  name={name}
                  description={description}
                  status={status}
                  errors={state.errors}
                  disabled={!canWrite}
                  fieldset="publish"
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
              </div>
            </section>
          </div>
        </div>

        {section !== "notarial" && (
          <TemplateSaveControls
            dirty={dirty}
            pending={pending}
            saved={!!state.success}
            isEdit={isEdit}
            canWrite={canWrite}
          />
        )}
      </form>

      <ExpandableDocumentPanel
        open={previewExpanded}
        onClose={() => setPreviewExpanded(false)}
        title={`Vista previa — ${name || "Machote sin nombre"}`}
      >
        <TemplatePreviewPanel model={previewModel} bare />
      </ExpandableDocumentPanel>

      {aiHelpOpen && <AiHelpDialog onClose={closeAiHelp} />}

      {/* ================= Índice notarial =================
          Hermano del <form> de arriba, no descendiente: tiene su propio
          <form> con su propia Server Action y no puede anidarse dentro.
          Bloqueado hasta el primer guardado — depende de template_id. */}
      <div
        id="template-panel-notarial"
        role="tabpanel"
        aria-labelledby="template-tab-notarial"
        hidden={section !== "notarial"}
      >
        {isEdit ? (
          <TemplateIndexConfigurationSection
            templateId={props.template.id}
            configuration={props.indexConfiguration}
            readOnly={!canWrite}
            fields={props.indexFields}
            optionBlocks={props.indexOptionBlocks}
          />
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-semibold text-slate-900">Índice</h2>
            </div>
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Disponible después de guardar el machote por primera vez.
              Guarda desde cualquier otro paso para desbloquearlo.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
