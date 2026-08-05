"use client";

import { useActionState, useMemo, useState } from "react";
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
import {
  isDocumentStatus,
  isReadOnlyStatus,
  type DocumentStatus,
} from "../model/lifecycle";
import { useDocumentDirtyState } from "../hooks/use-document-dirty-state";
import { useDocumentLayout } from "../hooks/use-document-layout";
import { useDocumentPreview } from "../hooks/use-document-preview";
import { DocumentFormPanel } from "./DocumentFormPanel";
import { DocumentMobileViewToggle } from "./DocumentMobileViewToggle";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import {
  MilestoneFeedback,
  MilestoneFeedbackAction,
} from "@/components/feedback/MilestoneFeedback";

type Props = {
  document: TemplateDocument;
  fields: FillableTemplateField[];
  templateName: string;
  clients: DocumentClientOption[];
  initialClientId: string | null;
  /** documents.finalize — sin importar el modo, controla Finalizar/Reabrir/
   * Volver a borrador dentro de DocumentStatusControls. */
  canFinalize: boolean;
} & (
  | { mode: "create"; templateId: string; defaultTitle: string }
  | {
      mode: "edit";
      draft: DocumentRow;
      savedJustNow?: boolean;
      /** documents.edit — la página ya bloquea /new sin documents.create,
       * así que en modo "create" siempre es true (ver el mismo patrón en
       * ClientForm/ReceivableForm). */
      canEdit: boolean;
    }
);

const initialState: DocumentDraftState = {};

export function DocumentComposer(props: Props) {
  const { document, fields, templateName, clients, canFinalize } = props;
  const isEdit = props.mode === "edit";
  const draft = isEdit ? props.draft : null;
  const status: DocumentStatus =
    draft && isDocumentStatus(draft.status) ? draft.status : "draft";
  const canEdit = isEdit ? props.canEdit : true;
  const readOnly = (isEdit && isReadOnlyStatus(status)) || !canEdit;

  const action = isEdit
    ? updateDocumentDraftAction.bind(null, props.draft.id)
    : createDocumentDraftAction.bind(null, props.templateId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { dirty, markDirty } = useDocumentDirtyState(state);
  const { mobileView, setMobileView } = useDocumentLayout();

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

  // El cliente creado desde el diálogo contextual queda seleccionado de
  // inmediato, sin recargar la página ni tocar el resto del formulario.
  function handleClientCreated(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
    setClientId(client.id);
    markDirty();
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

  // Solo cuentan las variables activas para la variante elegida de cada
  // Bloque de opciones — igual que el chequeo de finalización — así el
  // progreso y "Siguiente pendiente" nunca piden campos de una variante que
  // no está seleccionada.
  const activeKeys = useMemo(
    () => extractActiveDocumentVariables(document, optionSelections),
    [document, optionSelections],
  );
  const completedCount = activeKeys.filter(
    (key) => (values[key] ?? "").trim() !== "",
  ).length;
  const totalCount = activeKeys.length;

  function goToNextPending() {
    if (activeKeys.length === 0) return;
    const startIndex = editingTarget
      ? activeKeys.indexOf(editingTarget.variableKey)
      : -1;
    for (let offset = 1; offset <= activeKeys.length; offset++) {
      const key = activeKeys[(startIndex + offset) % activeKeys.length];
      if ((values[key] ?? "").trim() === "") {
        const occurrence = model
          .flatMap((paragraph) => paragraph.runs)
          .flatMap((run) =>
            run.kind === "optionBlock" ? run.runs : [run],
          )
          .find((run) => run.kind === "variable" && run.key === key);
        if (occurrence?.kind === "variable") {
          setEditingTarget({ nodeId: occurrence.nodeId, variableKey: key });
        }
        setMobileView("document");
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
  // El hito de "primer guardado" solo aplica hasta el primer guardado
  // posterior real: en cuanto state.success pasa a true por una acción
  // nueva, el borrador deja de ser "recién creado".
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

  // Cambiar de variante actualiza de inmediato el documento/preview/DOCX
  // (todos derivan de `optionSelections`) y marca la Escritura como sucia,
  // igual que cualquier otro cambio — se persiste con "Guardar cambios",
  // nunca de forma automática. Los valores de variables que la nueva
  // variante ya no usa no se tocan ni se borran: siguen en `values` por si
  // el usuario vuelve a la variante anterior.
  function selectVariant(blockId: string, variantId: string) {
    setOptionSelections((current) => ({ ...current, [blockId]: variantId }));
    markDirty();
  }

  return (
    <form action={formAction} noValidate>
      {fields.map((field) => (
        <input
          key={field.field_key}
          type="hidden"
          name={field.field_key}
          value={values[field.field_key] ?? ""}
        />
      ))}
      <input
        type="hidden"
        name="option_selections"
        value={JSON.stringify(optionSelections)}
      />

      {bannerKind === "milestone" && draft && (
        <MilestoneFeedback
          title="Escritura guardada como borrador"
          description="La Escritura ya fue creada. Ahora puedes asociar cuentas por cobrar y continuar completando el documento."
          actions={
            <MilestoneFeedbackAction
              label="Ver Cuentas por cobrar"
              href={`/dashboard/documents/${draft.id}?section=receivables`}
            />
          }
          onDismiss={() => setMilestoneDismissed(true)}
          clearParams={["saved"]}
        />
      )}
      {bannerKind === "saved" && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-accent-50 border border-accent-200 px-4 py-3 text-sm text-accent-800"
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
      {state.errors && Object.keys(state.errors).length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          <ul className="list-disc space-y-0.5 pl-5">
            {Object.entries(state.errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <DocumentMobileViewToggle
        value={mobileView}
        onChange={setMobileView}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <DocumentPreviewPanel
          dirty={dirty}
          mobileView={mobileView}
          model={model}
          templateName={templateName}
          values={readOnly ? undefined : values}
          editingNodeId={readOnly ? undefined : editingTarget?.nodeId}
          onStartEdit={readOnly ? undefined : startEditingField}
          onChangeValue={readOnly ? undefined : changeField}
          onStopEdit={readOnly ? undefined : stopEditingField}
          onSelectVariant={readOnly ? undefined : selectVariant}
        />
        <DocumentFormPanel
          clientId={clientId}
          clients={clientOptions}
          completedCount={completedCount}
          dirty={dirty}
          documentId={draft?.id ?? null}
          mobileView={mobileView}
          pending={pending}
          pendingVariableCount={persistedPendingCount}
          readOnly={readOnly}
          canEdit={canEdit}
          canFinalize={canFinalize}
          roleGroups={roleGroups}
          saveStatusText={saveStatusText}
          state={state}
          status={status}
          title={title}
          totalCount={totalCount}
          values={values}
          onApplyRoleAutofill={applyRoleAutofill}
          onClientChange={changeClient}
          onClientCreated={handleClientCreated}
          onGoToNextPending={goToNextPending}
          onTitleChange={changeTitle}
        />
      </div>
    </form>
  );
}
