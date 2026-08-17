"use client";

/**
 * Workspace unificado de una Escritura — creación y edición.
 *
 * El contenido se organiza en cuatro pasos navegables (Completar / Revisar
 * y finalizar / Cobro / Índice) mediante `DocumentWorkspaceHeader`,
 * visibles desde que se inicia una Escritura nueva: no existe un flujo
 * alternativo de una sola página para el modo creación. Los cuatro
 * permanecen siempre montados — solo se ocultan con CSS — así que cambiar
 * de paso nunca descarta cambios sin guardar en Completar (comparte estado
 * con "Revisar y finalizar": `values`, `clientId`, `dirty`), tanto antes
 * como después del primer guardado.
 *
 * "Revisar y finalizar" fusiona lo que antes eran dos pasos separados
 * ("Revisar" y "Finalizar"): el paso de solo revisar el documento quedaba
 * vacío salvo por un botón, así que la finalización ocurre en el mismo
 * lugar donde se está viendo la escritura que se aprueba, no en una
 * pantalla aparte. La revisión (contenido + pendientes) opera sobre estado
 * local puro y es alcanzable antes de guardar; los controles de
 * finalización (`DocumentStatusControls`, descargar DOCX) requieren que la
 * Escritura ya exista.
 *
 * "Cobro" requiere que la Escritura ya exista (depende de `documentId`) y
 * queda bloqueado hasta entonces; "Índice" además requiere que esté
 * finalizada, igual que siempre. Índice vive fuera del `<form>` principal
 * porque tiene su propio `<form>`/Server Action (no puede anidarse).
 */

import { useActionState, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TemplateDocument } from "@/lib/editor/types";
import type { OptionSelectionsMap, VariableTransformsMap } from "@/lib/editor/render";
import { extractActiveDocumentVariables } from "@/lib/editor/variables";
import type { FillableTemplateField } from "@/features/templates";
import type { CreatedClient } from "@/features/clients";
import type { DocumentClientOption } from "../model/role-autofill";
import { groupVariablesByRole } from "../model/role-autofill";
import {
  createDocumentDraftAction,
  updateDocumentDraftAction,
  type DocumentDraftState,
} from "../server/content-actions";
import type { DocumentRow } from "../server/detail-queries";
import type { DocumentActivityPage } from "../server/activity-queries";
import {
  isDocumentStatus,
  isReadOnlyStatus,
  type DocumentStatus,
} from "../model/lifecycle";
import { useDocumentDirtyState } from "../hooks/use-document-dirty-state";
import { useDocumentLayout } from "../hooks/use-document-layout";
import { useDocumentPreview } from "../hooks/use-document-preview";
import { DocumentContextBar } from "./DocumentContextBar";
import { DocumentMobileViewToggle } from "./DocumentMobileViewToggle";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import { DocumentStatusControls } from "./DocumentStatusControls";
import { DownloadDocxButton } from "./DownloadDocxButton";
import { PendingFieldsDialog, type PendingField } from "./PendingFieldsDialog";
import {
  DocumentWorkspaceHeader,
  type DocumentWorkspaceSection,
} from "./DocumentWorkspaceHeader";
import {
  MilestoneFeedback,
  MilestoneFeedbackAction,
} from "@/components/feedback/MilestoneFeedback";
import { ResizableSplitPane } from "@/components/document/ResizableSplitPane";
import { ExpandableDocumentPanel } from "@/components/document/ExpandableDocumentPanel";
import { DocumentSheet } from "@/components/document/DocumentSheet";
import type { NotarialMetadata } from "@/features/notarial-index/model/notarial";
import type { NotarialMetadataPrefill } from "@/features/notarial-index/model/prefill";
import { NotarialMetadataSection } from "@/features/notarial-index";
import type { ReceivableEntry } from "@/features/receivables";
import { DocumentReceivableStep } from "./DocumentReceivableStep";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type SharedProps = {
  document: TemplateDocument;
  fields: FillableTemplateField[];
  templateName: string;
  clients: DocumentClientOption[];
  initialClientId: string | null;
  /** documents.finalize — controla Finalizar/Reabrir/Volver a borrador. */
  canFinalize: boolean;
};

type Props = SharedProps &
  (
    | { mode: "create"; templateId: string; defaultTitle: string }
    | {
        mode: "edit";
        draft: DocumentRow;
        savedJustNow?: boolean;
        /** documents.edit */
        canEdit: boolean;
        initialSection: DocumentWorkspaceSection;
        activity: DocumentActivityPage;
        canDuplicate: boolean;
        receivables: ReceivableEntry[];
        /** receivables.manage — habilita crear cuenta/registrar pago desde
         * el paso "Cobro" sin salir de la Escritura. */
        canManageReceivables: boolean;
        notarialMetadata: NotarialMetadata | null;
        notarialPrefill: NotarialMetadataPrefill;
        canResetParties: boolean;
        actNamePreview: string | null;
        generatedPartiesPreview: string | null;
        reviewRequired: boolean;
      }
  );

const initialState: DocumentDraftState = {};

function resolveSection(
  raw: string | null,
  persisted: boolean,
  notarialUnlocked: boolean,
): DocumentWorkspaceSection {
  if (raw === "notarial") return notarialUnlocked ? "notarial" : "completar";
  // "finalizar" ya no es un paso propio — su contenido vive ahora en
  // "revisar" ("Revisar y finalizar"). Un enlace viejo con ese valor
  // aterriza ahí en vez de perderse en el paso por defecto.
  if (raw === "finalizar") return persisted ? "revisar" : "completar";
  if (raw === "cobro" && !persisted) return "completar";
  return raw === "revisar" || raw === "cobro" ? raw : "completar";
}

export function DocumentComposer(props: Props) {
  const { document, fields, templateName, clients, canFinalize } = props;
  const isEdit = props.mode === "edit";
  const draft = isEdit ? props.draft : null;
  const status: DocumentStatus =
    draft && isDocumentStatus(draft.status) ? draft.status : "draft";
  const canEdit = isEdit ? props.canEdit : true;
  const readOnly = (isEdit && isReadOnlyStatus(status)) || !canEdit;
  const notarialUnlocked = isEdit && status === "final";

  const action = isEdit
    ? updateDocumentDraftAction.bind(null, props.draft.id)
    : createDocumentDraftAction.bind(null, props.templateId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { dirty, markDirty } = useDocumentDirtyState(state);
  const { mobileView, setMobileView } = useDocumentLayout();

  const [section, setSection] = useState<DocumentWorkspaceSection>(
    isEdit ? props.initialSection : "completar",
  );
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // `useSearchParams` refleja la URL actual sin importar cómo cambió — back/
  // forward del navegador, pushState propio (`goToSection`) o un `<Link>`
  // real de otro componente (ej. "Completar datos del índice" en
  // `DocumentStatusControls`). Un simple listener de `popstate` no cubre
  // este último caso: la navegación de un `<Link>` de Next no dispara
  // `popstate`, así que la sección quedaba desincronizada de la URL. Se
  // ajusta durante el render (comparando contra el último valor de
  // searchParams ya procesado) en vez de en un efecto, para no disparar un
  // render en cascada — mismo patrón que el auto-expand de errores en
  // `TemplateIndexConfigurationSection`.
  const searchParams = useSearchParams();
  const resolvedSection = resolveSection(
    searchParams.get("section"),
    isEdit,
    notarialUnlocked,
  );
  const [lastSearchParams, setLastSearchParams] = useState(searchParams);
  if (searchParams !== lastSearchParams) {
    setLastSearchParams(searchParams);
    if (resolvedSection !== section) setSection(resolvedSection);
  }

  const goToSection = useCallback((next: DocumentWorkspaceSection) => {
    setSection(next);
    if (typeof window === "undefined") return;
    const url =
      next === "completar"
        ? window.location.pathname
        : `${window.location.pathname}?section=${next}`;
    window.history.pushState(null, "", url);
  }, []);

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
  const [clientOptions, setClientOptions] = useState(clients);
  const [milestoneDismissed, setMilestoneDismissed] = useState(false);
  const [editingTarget, setEditingTarget] = useState<
    { nodeId: string; variableKey: string } | undefined
  >();
  const [optionSelections, setOptionSelections] = useState<OptionSelectionsMap>(
    () => draft?.option_selections ?? {},
  );

  // El cliente creado desde el diálogo contextual del chip "Cliente
  // principal" queda seleccionado de inmediato. El de un chip de Parte
  // (ver DocumentContextBar) nunca llega aquí — solo se registra en la
  // lista compartida, sin tocar `clientId`.
  function handleClientCreated(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
    setClientId(client.id);
    markDirty();
  }
  function handleClientRegistered(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
  }

  const transforms = useMemo<VariableTransformsMap>(() => {
    const map: VariableTransformsMap = {};
    for (const field of fields) {
      if (field.output_transform !== "none") {
        map[field.field_key] = field.output_transform;
      }
    }
    return map;
  }, [fields]);

  const { model, persistedPendingCount } = useDocumentPreview(
    document,
    values,
    draft?.field_values,
    transforms,
    optionSelections,
    draft?.option_selections,
  );

  const roleGroups = useMemo(() => groupVariablesByRole(fields), [fields]);

  function applyRoleAutofill(fieldValues: Record<string, string>) {
    setValues((current) => ({ ...current, ...fieldValues }));
    markDirty();
  }

  const fieldsByKey = useMemo(
    () => new Map(fields.map((field) => [field.field_key, field])),
    [fields],
  );

  // Solo cuentan las variables activas para la variante elegida de cada
  // Bloque de opciones — así el progreso y "campos pendientes" nunca piden
  // campos de una variante que no está seleccionada.
  const activeKeys = useMemo(
    () => extractActiveDocumentVariables(document, optionSelections),
    [document, optionSelections],
  );
  const completedCount = activeKeys.filter(
    (key) => (values[key] ?? "").trim() !== "",
  ).length;
  const totalCount = activeKeys.length;
  const pendingFields: PendingField[] = activeKeys
    .filter((key) => (values[key] ?? "").trim() === "")
    .map((key) => ({ key, label: fieldsByKey.get(key)?.label ?? key }));

  function goToField(key: string) {
    const occurrence = model
      .flatMap((paragraph) => paragraph.runs)
      .flatMap((run) => (run.kind === "optionBlock" ? run.runs : [run]))
      .find((run) => run.kind === "variable" && run.key === key);
    if (occurrence?.kind === "variable") {
      setEditingTarget({ nodeId: occurrence.nodeId, variableKey: key });
    }
    setMobileView("document");
    goToSection("completar");
  }

  function goToNextPending() {
    if (activeKeys.length === 0) return;
    const startIndex = editingTarget
      ? activeKeys.indexOf(editingTarget.variableKey)
      : -1;
    for (let offset = 1; offset <= activeKeys.length; offset++) {
      const key = activeKeys[(startIndex + offset) % activeKeys.length];
      if ((values[key] ?? "").trim() === "") {
        goToField(key);
        return;
      }
    }
  }

  const saveStatusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : state.success || isEdit
        ? "Guardado"
        : "Sin guardar";
  const isFirstSaveMilestone =
    isEdit &&
    props.savedJustNow &&
    !state.success &&
    !state.message &&
    !state.errors;
  const bannerKind: "milestone" | "saved" | null =
    dirty || pending
      ? null
      : isFirstSaveMilestone && !milestoneDismissed
        ? "milestone"
        : state.success
          ? "saved"
          : null;

  function changeTitle(value: string) {
    setTitle(value);
    markDirty();
  }

  function changeClient(value: string) {
    setClientId(value);
    markDirty();
  }

  function changeField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  function startEditingField(nodeId: string, variableKey: string) {
    setEditingTarget({ nodeId, variableKey });
  }

  function stopEditingField() {
    setEditingTarget(undefined);
  }

  function selectVariant(blockId: string, variantId: string) {
    setOptionSelections((current) => ({ ...current, [blockId]: variantId }));
    markDirty();
  }

  const documentSheet = (
    <DocumentSheet
      model={model}
      pendingVariableDisplay="placeholder"
      emptyMessage="El machote no tiene contenido."
      aria-labelledby="composer-document-heading"
      values={readOnly ? undefined : values}
      editingNodeId={readOnly ? undefined : editingTarget?.nodeId}
      onStartEdit={readOnly ? undefined : startEditingField}
      onChangeValue={readOnly ? undefined : changeField}
      onStopEdit={readOnly ? undefined : stopEditingField}
      onSelectVariant={readOnly ? undefined : selectVariant}
    />
  );

  const contextBar = (
    <DocumentContextBar
      clientId={clientId}
      clients={clientOptions}
      roleGroups={roleGroups}
      values={values}
      readOnly={readOnly}
      onClientChange={changeClient}
      onClientCreated={handleClientCreated}
      onClientRegistered={handleClientRegistered}
      onApplyRoleAutofill={applyRoleAutofill}
    />
  );

  const completarPrimary = (
    <section aria-label="Datos de la Escritura" className="space-y-5">
      {!readOnly && contextBar}
      <div>
        <label htmlFor="composer-title" className={labelClass}>
          Título de la escritura
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          id="composer-title"
          name="title"
          type="text"
          required
          value={title}
          disabled={readOnly}
          onChange={(event) => changeTitle(event.target.value)}
          className={inputClass}
        />
      </div>

      {totalCount > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1.5">Progreso</h3>
          <p role="status" className="text-xs font-medium text-slate-600">
            {completedCount} de {totalCount} campos completos
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent-600 transition-all"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
            />
          </div>
          <div className="mt-2">
            <PendingFieldsDialog pendingFields={pendingFields} onGoToField={goToField} />
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={goToNextPending}
              disabled={pendingFields.length === 0}
              className="mt-2 w-full rounded-lg border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm font-medium text-accent-800 transition-colors hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente pendiente →
            </button>
          )}
        </div>
      )}

      {totalCount === 0 && (
        <p className="text-sm text-slate-500">
          Este machote no tiene variables: el documento es texto fijo y solo
          necesita un título.
        </p>
      )}

      {readOnly && (
        <p role="status" className="text-xs text-slate-500">
          {isEdit && canEdit
            ? "Esta escritura está finalizada (solo lectura). Reábrela para editarla de nuevo."
            : "Tu rol no permite editar escrituras. La ves en modo lectura."}
        </p>
      )}
      {!readOnly && (
        <div>
          <p className={`text-xs ${dirty && !pending ? "text-amber-700 font-medium" : "text-slate-500"}`}>
            {saveStatusText}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div>
      <DocumentWorkspaceHeader
        documentId={isEdit ? props.draft.id : undefined}
        title={title}
        clientName={
          clientOptions.find((client) => client.id === clientId)?.full_name ?? null
        }
        status={status}
        section={section}
        saveStatusText={saveStatusText}
        onSectionChange={goToSection}
        activity={isEdit ? props.activity : undefined}
        canDuplicate={isEdit ? props.canDuplicate : false}
      />

      <form action={formAction} noValidate>
        {fields.map((field) => (
          <input
            key={field.field_key}
            type="hidden"
            name={field.field_key}
            value={values[field.field_key] ?? ""}
          />
        ))}
        <input type="hidden" name="option_selections" value={JSON.stringify(optionSelections)} />
        {/* Paso activo al momento de guardar — el primer guardado (modo
            create) lo usa para redirigir a la misma pestaña en vez de
            reiniciar en "Completar", así la transición create → edit se
            siente como continuación del mismo stepper. */}
        <input type="hidden" name="section" value={section} />

        {bannerKind === "milestone" && draft && (
          <MilestoneFeedback
            title="Escritura guardada como borrador"
            description="Cuando completes los campos pendientes, continúa a Revisar para verificar la escritura antes de finalizarla o gestionar cobros."
            actions={
              <MilestoneFeedbackAction
                label="Ir a Revisar"
                href={`/dashboard/documents/${draft.id}?section=revisar`}
              />
            }
            onDismiss={() => setMilestoneDismissed(true)}
            clearParams={["saved"]}
          />
        )}
        {bannerKind === "saved" && (
          <div role="status" className="mb-6 rounded-lg bg-accent-50 border border-accent-200 px-4 py-3 text-sm text-accent-800">
            Borrador guardado.
          </div>
        )}
        {state.message && (
          <div role="alert" className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}
        {state.errors && Object.keys(state.errors).length > 0 && (
          <div role="alert" className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <ul className="list-disc space-y-0.5 pl-5">
              {Object.entries(state.errors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div
          id="document-panel-completar"
          role="tabpanel"
          aria-labelledby="document-step-completar"
          hidden={section !== "completar"}
        >
          <DocumentMobileViewToggle value={mobileView} onChange={setMobileView} />
          <ResizableSplitPane
            secondaryTitle="Datos de la Escritura"
            onExpand={() => setPreviewExpanded(true)}
            primaryClassName={mobileView === "data" ? "hidden xl:block" : ""}
            secondaryClassName={mobileView === "document" ? "hidden xl:block" : ""}
            defaultSecondaryPercent={35}
            primary={
              <DocumentPreviewPanel
                dirty={dirty}
                mobileView="document"
                model={model}
                templateName={templateName}
                values={readOnly ? undefined : values}
                editingNodeId={readOnly ? undefined : editingTarget?.nodeId}
                onStartEdit={readOnly ? undefined : startEditingField}
                onChangeValue={readOnly ? undefined : changeField}
                onStopEdit={readOnly ? undefined : stopEditingField}
                onSelectVariant={readOnly ? undefined : selectVariant}
              />
            }
            secondary={completarPrimary}
          />
        </div>

        <div
          id="document-panel-revisar"
          role="tabpanel"
          aria-labelledby="document-step-revisar"
          hidden={section !== "revisar"}
        >
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60 sticky top-0 z-10">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Revisión del documento</h2>
                <p className="text-xs text-slate-500">Vista de solo lectura, tal como quedará la escritura.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToSection("completar")}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewExpanded(true)}
                  title="Ver en pantalla completa"
                  aria-label="Ver en pantalla completa"
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  ⤢
                </button>
              </div>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">{documentSheet}</div>

            {/* Estado + acciones finales — franja compacta dentro de la
                misma card, en vez de una segunda card grande separada solo
                para dos botones. Requiere que la Escritura ya exista. */}
            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              {isEdit ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">
                    {dirty
                      ? "Hay cambios sin guardar en Completar. Guárdalos antes de cambiar el estado."
                      : totalCount > 0
                        ? `${completedCount} de ${totalCount} campos completos.`
                        : "Este machote no tiene variables."}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DownloadDocxButton
                      documentId={props.draft.id}
                      disabled={dirty}
                      pendingVariableCount={persistedPendingCount}
                      variant="compact"
                    />
                    <DocumentStatusControls
                      key={status}
                      documentId={props.draft.id}
                      status={status}
                      dirty={dirty}
                      canFinalize={canFinalize}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Finalizar y descargar estarán disponibles después de
                  guardar la escritura por primera vez.
                </p>
              )}
            </div>
          </section>
          <div className="mt-4">
            <PendingFieldsDialog pendingFields={pendingFields} onGoToField={goToField} />
          </div>
        </div>
      </form>

      <ExpandableDocumentPanel
        open={previewExpanded}
        onClose={() => setPreviewExpanded(false)}
        title={`Documento — ${title || "Escritura sin título"}`}
      >
        {documentSheet}
      </ExpandableDocumentPanel>

      <div
        id="document-panel-cobro"
        role="tabpanel"
        aria-labelledby="document-step-cobro"
        hidden={section !== "cobro"}
      >
        {isEdit ? (
          <DocumentReceivableStep
            documentId={props.draft.id}
            documentTitle={title}
            receivables={props.receivables}
            clientOptions={clientOptions}
            defaultClientId={clientId || undefined}
            canManage={props.canManageReceivables}
          />
        ) : (
          <LockedStepPlaceholder title="Cobro" />
        )}
      </div>

      <div
        id="document-panel-notarial"
        role="tabpanel"
        aria-labelledby="document-step-notarial"
        hidden={section !== "notarial"}
      >
        {isEdit ? (
          <NotarialMetadataSection
            documentId={props.draft.id}
            metadata={props.notarialMetadata}
            prefill={props.notarialPrefill}
            readOnly
            canEdit={canEdit}
            canResetParties={props.canResetParties}
            actNamePreview={props.actNamePreview}
            generatedPartiesPreview={props.generatedPartiesPreview}
            reviewRequired={props.reviewRequired}
          />
        ) : (
          <LockedStepPlaceholder title="Índice" />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ locked step

/** Placeholder para un paso que depende de que la Escritura ya exista. */
function LockedStepPlaceholder({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="px-6 py-8 text-center text-sm text-slate-500">
        Disponible después de guardar la escritura por primera vez. Guarda
        desde Completar para desbloquearlo.
      </div>
    </section>
  );
}
