"use client";

import { useActionState, useState } from "react";
import type { TemplateDocument } from "@/lib/editor/types";
import type { FillableTemplateField } from "@/features/templates";
import type { CreatedClient } from "@/features/clients";
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

type Props = {
  document: TemplateDocument;
  fields: FillableTemplateField[];
  templateName: string;
  clients: { id: string; full_name: string }[];
  initialClientId: string | null;
} & (
  | { mode: "create"; templateId: string; defaultTitle: string }
  | { mode: "edit"; draft: DocumentRow; savedJustNow?: boolean }
);

const initialState: DocumentDraftState = {};

export function DocumentComposer(props: Props) {
  const { document, fields, templateName, clients } = props;
  const isEdit = props.mode === "edit";
  const draft = isEdit ? props.draft : null;
  const status: DocumentStatus =
    draft && isDocumentStatus(draft.status) ? draft.status : "draft";
  const readOnly = isEdit && isReadOnlyStatus(status);

  const action = isEdit
    ? updateDocumentDraftAction.bind(null, props.draft.id)
    : createDocumentDraftAction.bind(null, props.templateId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { dirty, markDirty } = useDocumentDirtyState(state);
  const {
    focusedKey,
    focusField,
    mobileView,
    setFocusedKey,
    setMobileView,
  } = useDocumentLayout();

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
  const [fieldFilter, setFieldFilter] = useState<"all" | "pending">("all");

  // El cliente creado desde el diálogo contextual queda seleccionado de
  // inmediato, sin recargar la página ni tocar el resto del formulario.
  function handleClientCreated(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
    setClientId(client.id);
    markDirty();
  }

  const { model, persistedPendingCount } = useDocumentPreview(
    document,
    values,
    draft?.field_values,
  );
  const completedCount = fields.filter(
    (field) => (values[field.field_key] ?? "").trim() !== "",
  ).length;
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

  return (
    <form action={formAction} noValidate>
      {hiddenFields.map((field) => (
        <input
          key={field.field_key}
          type="hidden"
          name={field.field_key}
          value={values[field.field_key] ?? ""}
        />
      ))}

      {showSavedBanner && (
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

      <DocumentMobileViewToggle
        value={mobileView}
        onChange={setMobileView}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <DocumentPreviewPanel
          dirty={dirty}
          focusedKey={focusedKey}
          mobileView={mobileView}
          model={model}
          templateName={templateName}
          onVariableClick={focusField}
        />
        <DocumentFormPanel
          clientId={clientId}
          clients={clientOptions}
          completedCount={completedCount}
          dirty={dirty}
          documentId={draft?.id ?? null}
          fieldFilter={fieldFilter}
          fields={fields}
          mobileView={mobileView}
          pending={pending}
          pendingVariableCount={persistedPendingCount}
          readOnly={readOnly}
          saveStatusText={saveStatusText}
          state={state}
          status={status}
          title={title}
          values={values}
          visibleFields={visibleFields}
          onClientChange={changeClient}
          onClientCreated={handleClientCreated}
          onFieldBlur={() => setFocusedKey(undefined)}
          onFieldChange={changeField}
          onFieldFilterChange={setFieldFilter}
          onFieldFocus={setFocusedKey}
          onTitleChange={changeTitle}
        />
      </div>
    </form>
  );
}
