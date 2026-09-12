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
 * funcional en ambos modos. Los cinco pasos, incluido Índice, viven dentro
 * del mismo `<form>` — Índice ya no tiene su propio `<form>`/Server Action
 * (su guardado corre por `TemplateIndexConfigurationHandle`, invocado
 * directamente), así que no hay riesgo de formularios anidados.
 *
 * El control de Guardar (`TemplateSaveControls`) es el último hijo de ese
 * mismo `<form>`, pero visualmente es un dock flotante (`position: fixed`,
 * vía `WorkspaceActionDock`) — el mismo patrón aprobado en el workspace de
 * Escrituras (`DocumentSaveControls`): persistente durante el scroll desde
 * cualquier paso, sin importar cuál esté oculto, en vez de la franja sticky
 * de ancho completo que tenía antes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useSaveRevision } from "@/lib/forms/use-save-revision";
import {
  createTemplateWorkspaceAction,
  getTemplateIndexFieldOptionsAction,
  updateTemplateWorkspaceAction,
  type TemplateWorkspaceState,
} from "../server/template-actions";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import type { TemplateDocument } from "@/lib/editor/types";
import { extractOptionBlockSummaries } from "@/lib/editor/option-blocks";
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
import { useTemplateWorkspaceSection } from "../hooks/use-template-workspace-section";
import {
  TemplateIndexConfigurationSection,
  type IndexConfigurationField,
  type TemplateIndexConfiguration,
  type TemplateIndexConfigurationHandle,
} from "@/features/notarial-index";
import { useToast } from "@/components/feedback/Toast";
import { stripSearchParams } from "@/lib/navigation/strip-search-params";
import { ResizableSplitPane } from "@/components/document/ResizableSplitPane";
import { ExpandableDocumentPanel } from "@/components/document/ExpandableDocumentPanel";
import { AiHelpDialog } from "./AiHelpDialog";
import { useUnsavedChanges } from "@/components/navigation/NavigationGuard";
import { TemplatePublishPanel } from "./TemplatePublishPanel";


// ------------------------------------------------------------------ props

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
  include_in_notarial_index_by_default: boolean;
};

type EditModeProps = {
  mode: "edit";
  template: WorkspaceTemplate;
  createdJustNow?: boolean;
  initialSection?: TemplateWorkspaceSection;
  indexConfiguration: TemplateIndexConfiguration | null;
  indexFields: IndexConfigurationField[];
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
  const { dirty, markDirty, captureRevision, completeSave } = useSaveRevision();
  const submittedRevision = useRef(0);
  const [mobileView, setMobileView] = useState<TemplateMobileView>("edit");
  // "Información" es el primer paso definido — tanto una escritura nueva
  // como una entrada normal de edición abren ahí (ver `resolveInitialSection`
  // en la página de edición para la única excepción explícita: preservar el
  // paso tras el redirect create → edit del primer guardado).
  const { section, goToSection } = useTemplateWorkspaceSection(
    isEdit,
    isEdit ? (props.initialSection ?? "information") : "information",
  );
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(template?.updated_at ?? "");
  const editorRef = useRef<TemplateEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const aiHelpButtonRef = useRef<HTMLButtonElement>(null);
  const indexRef = useRef<TemplateIndexConfigurationHandle>(null);
  // Mapeos del Índice sin guardar — reportado por
  // `TemplateIndexConfigurationSection` (no vive en un `<form>` propio, así
  // que su dirty no se detecta solo). Se suma al `dirty` global de abajo.
  const [indexDirty, setIndexDirty] = useState(false);
  const [indexSaveError, setIndexSaveError] = useState<string | null>(null);

  function closeAiHelp() {
    setAiHelpOpen(false);
    window.setTimeout(() => aiHelpButtonRef.current?.focus(), 0);
  }

  // El toggle del default notarial vive en un <form> hermano (ver comentario
  // de módulo) con su propia Server Action — sin esto, guardar el toggle
  // deja el `expected_updated_at` de ESTE formulario apuntando al
  // `updated_at` viejo, y el siguiente guardado del Machote se rechaza como
  // conflicto optimista contra el propio usuario (nadie más lo tocó).
  function handleNotarialIndexDefaultSaved(updatedAt: string) {
    setExpectedVersion(updatedAt);
  }


  const action = isEdit
    ? updateTemplateWorkspaceAction.bind(null, template!.id)
    : createTemplateWorkspaceAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [lastVersionState, setLastVersionState] = useState(state);
  if (lastVersionState !== state) {
    setLastVersionState(state);
    if (state.success && state.updatedAt) setExpectedVersion(state.updatedAt);
  }
  const { showToast } = useToast();

  const { contentKeys, document, model: previewModel } =
    useTemplatePreview(documentJson);

  // Todos los Bloques de opciones del documento EN VIVO (no una foto server
  // del último guardado) — así el mapeo Hora/Minutos del Índice ve de
  // inmediato un bloque recién insertado, o una variante recién agregada,
  // sin necesidad de guardar primero.
  const optionBlockSummaries = useMemo(
    () => (document ? extractOptionBlockSummaries(document) : []),
    [document],
  );

  // El contenido es la única fuente de verdad de qué variables existen (ver
  // comentario de módulo de `TemplateVariablesPanel`): cuando una clave
  // configurada pierde su última referencia en el contenido, se poda de
  // `variables` aquí mismo — no solo se oculta en el panel — para que lo que
  // se guarda (`<input type="hidden" name="variables">` más abajo) nunca
  // conserve configuración huérfana. Ajustado durante el render, mismo
  // patrón que el resto de este archivo (evita un efecto/render en cascada
  // para una sincronización que ya se puede resolver comparando contra el
  // último valor calculado).
  const contentKeySet = useMemo(() => new Set(contentKeys), [contentKeys]);
  if (variables.some((variable) => !contentKeySet.has(variable.field_key))) {
    setVariables((current) =>
      current.filter((variable) => contentKeySet.has(variable.field_key)),
    );
  }

  // Candidatos para los selectores del Índice (Partes, campos simples):
  // las `template_fields` persistidas (con `id` real) más cualquier
  // variable configurada en esta misma sesión que todavía no tiene una —
  // con un id sintético `local:<clave>` que
  // `TemplateIndexConfigurationHandle.save` traduce al id real (pidiendo
  // una lista fresca) recién después de guardar el machote. Sin esto, una
  // variable recién pegada y configurada no podría elegirse como Partes
  // hasta recargar la página.
  const indexFieldCandidates = useMemo(() => {
    const persisted = isEdit ? props.indexFields : [];
    const byKey = new Set(persisted.map((field) => field.fieldKey));
    const localOnly = variables
      .filter((variable) => !byKey.has(variable.field_key))
      .map((variable) => ({
        id: `local:${variable.field_key}`,
        fieldKey: variable.field_key,
        label: variable.label || variable.field_key,
      }));
    return [...persisted, ...localOnly];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, variables]);

  // Señales de completitud reales para el stepper — no hay ningún paso
  // "bloqueado" en Machotes (todo es libremente navegable), pero sí
  // marcamos "complete" cuando hay una condición derivable, igual que ya
  // hace la lista de Variables o el banner de completitud del Índice.
  const informationComplete = name.trim() !== "";
  const variableRows = buildVariableRows(variables, contentKeys);
  const variablesPendingCount = variableRows.filter(
    (row) => row.status === "pending",
  ).length;
  // Un machote sin ninguna variable detectada (texto fijo) es un estado
  // válido — pero no es lo mismo que "ya revisé las variables y todas
  // están configuradas". Sin filas que evaluar, el paso no cuenta como
  // completo (evita el falso check al abrir un machote nuevo vacío).
  const variablesComplete = variableRows.length > 0 && variablesPendingCount === 0;
  const indexComplete = isEdit ? (props.indexConfiguration?.isComplete ?? false) : false;
  // El Índice depende de template_id — no puede configurarse antes del
  // primer guardado, sin importar qué tan completos estén los demás pasos.
  const indexLocked = !isEdit;

  // Un paso muestra ✓ solo cuando su condición fue confirmada por un
  // guardado exitoso (`savedOnceValid`) Y sigue cumpliéndose ahora mismo —
  // así un check nunca aparece antes de guardar, y desaparece de inmediato
  // si el usuario deja datos localmente inválidos sin volver a guardar
  // (sin esperar a un nuevo submit). En modo edición se siembra desde los
  // valores iniciales (ya persistidos); en creación arranca todo en falso
  // porque nada se ha guardado todavía.
  const [savedOnceValid, setSavedOnceValid] = useState<
    Record<TemplateWorkspaceSection, boolean>
  >(() => ({
    information: isEdit && informationComplete,
    document: isEdit,
    variables: isEdit && variablesComplete,
    notarial: isEdit && indexComplete,
    publish: isEdit && status === "active",
  }));
  // Guardado único: un solo botón "Guardar" persiste todo — Información,
  // Documento, Variables e Índice — sin navegar de paso como efecto
  // colateral (navegar entre secciones es libre, no requiere guardar antes
  // ni después; ver el stepper). Índice usa un RPC separado internamente
  // (`TemplateIndexConfigurationHandle.save`), pero solo se dispara cuando
  // el machote base ya se guardó con éxito — su RPC necesita el `id` real
  // de cualquier variable creada en esta misma sesión, que recién existe
  // después de ese guardado (ver `getTemplateIndexFieldOptionsAction`).
  const [indexSavePending, setIndexSavePending] = useState(false);

  async function finishIndexSave() {
    if (!isEdit || !indexRef.current?.isDirty()) return true;
    setIndexSaveError(null);
    setIndexSavePending(true);
    try {
      const freshFields = await getTemplateIndexFieldOptionsAction(template!.id);
      const result = await indexRef.current.save(freshFields);
      if (!result.success) {
        setIndexSaveError(
          result.message ?? "No fue posible guardar la configuración del Índice.",
        );
        return false;
      }
      return true;
    } finally {
      setIndexSavePending(false);
    }
  }

  // Un guardado exitoso del machote base recalcula qué pasos quedan
  // confirmados, y encadena el guardado del Índice si tenía mapeos sin
  // guardar — NO se muestra "Guardado" ni se limpia el dirty global hasta
  // que ambas partes terminan bien (ver `finishIndexSave`): un guardado
  // parcial nunca debe verse como éxito completo.
  const lastSuccess = useRef<TemplateWorkspaceState | null>(null);
  useEffect(() => {
    if (!state.success || lastSuccess.current === state) return;
    lastSuccess.current = state;
    setSavedOnceValid({
      information: informationComplete,
      document: true,
      variables: variablesComplete,
      notarial: indexComplete,
      publish: status === "active",
    });

    void (async () => {
      const savedRevision = submittedRevision.current;
      const indexOk = await finishIndexSave();
      completeSave(savedRevision);
      if (indexOk) showToast("Machote guardado.");
    })();
    // Deliberadamente solo [state]: se leen los valores más recientes de
    // los demás closures (informationComplete, section, etc.), pero el
    // efecto solo debe reaccionar a un guardado nuevo, no a cada tecleo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Solo el Índice tiene cambios (nada más en el machote base): evita
  // reenviar el formulario principal sin cambios reales — se guarda
  // directo, sin pasar por el submit nativo ni por el efecto de arriba.
  async function handleSaveClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (dirty || !isEdit || !indexRef.current?.isDirty()) return;
    event.preventDefault();
    const indexOk = await finishIndexSave();
    if (indexOk) showToast("Machote guardado.");
  }

  // El primer guardado en modo creación llega vía redirect del Server
  // Action (`?created=1`), no vía `useActionState` — el `state` de este
  // render arranca vacío, así que el efecto de arriba nunca dispara para
  // este caso. Se muestra el mismo toast una sola vez al montar y se limpia
  // el parámetro de la URL para que no reaparezca al recargar o volver
  // atrás. `firedRef` evita un toast duplicado bajo React Strict Mode (dev):
  // Strict Mode invoca cada efecto de montaje dos veces (monta → limpia →
  // monta de nuevo) sobre la misma instancia, así que un simple `[]` sin
  // guarda dispararía `showToast` dos veces.
  const createdToastFired = useRef(false);
  useEffect(() => {
    if (!isEdit || !props.createdJustNow || createdToastFired.current) return;
    createdToastFired.current = true;
    showToast("Machote guardado.");
    const next = stripSearchParams(
      window.location.pathname,
      window.location.search,
      ["created"],
    );
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
    // Solo debe ejecutarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedInformation = savedOnceValid.information && informationComplete;
  const completedDocument = savedOnceValid.document;
  const completedVariables = savedOnceValid.variables && variablesComplete;
  const completedIndex = savedOnceValid.notarial && indexComplete;
  const completedPublish = savedOnceValid.publish && status === "active";

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

  const globalDirty = dirty || indexDirty;

  useUnsavedChanges(globalDirty);

  const saveStatusText =
    pending || indexSavePending
      ? "Guardando…"
      : indexSaveError
        ? "Error al guardar"
        : globalDirty
          ? "Cambios sin guardar"
          : "Guardado";

  return (
    <>
      {!isEdit && pending && <p role="status" className="mb-3 text-sm text-slate-600">Guardando… Espera antes de continuar editando.</p>}
    <div inert={!isEdit && pending}>
      <TemplateWorkspaceHeader
        name={name}
        status={status}
        section={section}
        statusText={saveStatusText}
        onSectionChange={goToSection}
        informationComplete={completedInformation}
        documentComplete={completedDocument}
        variablesComplete={completedVariables}
        indexComplete={completedIndex}
        publishComplete={completedPublish}
        indexLocked={indexLocked}
        actions={props.mode === "edit" ? props.headerActions : undefined}
      />

      <form ref={formRef} action={formAction} noValidate onSubmit={(event) => {
        if (pending || indexSavePending) { event.preventDefault(); return; }
        submittedRevision.current = captureRevision();
      }}>
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
            type="hidden"
            name="expected_updated_at"
            value={expectedVersion}
          />
        )}

        {/* ---- feedback global ---- */}
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
          {/* Sin `onSaveVariable`: "Guardar variable" ya no persiste de
              inmediato — solo actualiza el estado local (como cualquier
              otro cambio) y el botón "Guardar" único se encarga. */}
          <TemplateVariablesPanel
            variables={variables}
            contentKeys={contentKeys}
            onChange={handleVariablesChange}
            readOnly={!canWrite}
          />
        </div>

        <TemplatePublishPanel
          hidden={section !== "publish"}
          name={name}
          description={description}
          status={status}
          variableCount={variables.length}
          variablesPendingCount={variablesPendingCount}
          isEdit={isEdit}
          indexComplete={indexComplete}
          canWrite={canWrite}
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

        {/* ================= Índice notarial =================
            Ahora dentro del mismo <form> que los demás pasos: ya no tiene
            su propio elemento <form> (el guardado único invoca su handle
            imperativo directamente, ver arriba), así que anidarlo aquí no
            es un <form> dentro de otro — solo un panel más ocultado por
            CSS igual que el resto. Moverlo adentro es lo que permite que
            la barra de Guardar (sticky, más abajo) se anote al final del
            contenido REAL de cada paso, incluida Índice — si quedara fuera
            del <form>, la barra "flotaría" pegada al principio de la
            página al ver Índice, porque el <form> (con todos los demás
            pasos ocultos) colapsaría a una altura mínima. Bloqueado hasta
            el primer guardado — depende de template_id. */}
        <div
          id="template-panel-notarial"
          role="tabpanel"
          aria-labelledby="template-tab-notarial"
          hidden={section !== "notarial"}
        >
          {isEdit ? (
            <TemplateIndexConfigurationSection
              ref={indexRef}
              templateId={props.template.id}
              configuration={props.indexConfiguration}
              readOnly={!canWrite}
              fields={indexFieldCandidates}
              optionBlocks={optionBlockSummaries}
              includeByDefault={props.template.include_in_notarial_index_by_default}
              onIncludeByDefaultSaved={handleNotarialIndexDefaultSaved}
              onSaveOptionBlockTimeMapping={(blockId, structuredOutput) =>
                editorRef.current?.updateOptionBlockStructuredOutput(
                  blockId,
                  structuredOutput,
                )
              }
              onDirtyChange={setIndexDirty}
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

        {/* Dock flotante de Guardar: única zona estable de guardado del
            machote completo, visible desde cualquier paso — incluida
            Índice, que ya no tiene su propio botón. Último hijo del
            <form>, pero `position: fixed` (vía `WorkspaceActionDock`) lo
            mantiene siempre alcanzable durante el scroll, sin importar qué
            paso esté visible. */}
        <TemplateSaveControls
          dirty={globalDirty}
          pending={pending || indexSavePending}
          saved={!!state.success && !indexSaveError}
          isEdit={isEdit}
          canWrite={canWrite}
          errorMessage={indexSaveError ?? undefined}
          onSaveClick={handleSaveClick}
        />
      </form>

      <ExpandableDocumentPanel
        open={previewExpanded}
        onClose={() => setPreviewExpanded(false)}
        title={`Vista previa — ${name || "Machote sin nombre"}`}
      >
        <TemplatePreviewPanel model={previewModel} bare />
      </ExpandableDocumentPanel>

      {aiHelpOpen && <AiHelpDialog onClose={closeAiHelp} />}

    </div>
    </>
  );
}
