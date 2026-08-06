"use client";

import { FieldError } from "@/components/forms/FieldError";
import { CreateClientDialog, type CreatedClient } from "@/features/clients";
import type { DocumentDraftState } from "../server/content-actions";
import type { DocumentStatus } from "../model/lifecycle";
import type { DocumentMobileView } from "../hooks/use-document-layout";
import type { DocumentClientOption, RoleVariableGroup } from "../model/role-autofill";
import { DocumentComposerActions } from "./DocumentComposerActions";
import { RoleAutofillPanel } from "./RoleAutofillPanel";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

type Props = {
  clientId: string;
  clients: DocumentClientOption[];
  completedCount: number;
  dirty: boolean;
  documentId: string | null;
  mobileView: DocumentMobileView;
  pending: boolean;
  pendingVariableCount: number;
  readOnly: boolean;
  canEdit: boolean;
  canFinalize: boolean;
  roleGroups: RoleVariableGroup[];
  saveStatusText: string;
  state: DocumentDraftState;
  status: DocumentStatus;
  title: string;
  totalCount: number;
  values: Record<string, string>;
  onApplyRoleAutofill: (fieldValues: Record<string, string>) => void;
  onClientChange: (value: string) => void;
  onClientCreated: (client: CreatedClient) => void;
  onGoToNextPending: () => void;
  onTitleChange: (value: string) => void;
};

export function DocumentFormPanel({
  clientId,
  clients,
  completedCount,
  dirty,
  documentId,
  mobileView,
  pending,
  pendingVariableCount,
  readOnly,
  canEdit,
  canFinalize,
  roleGroups,
  saveStatusText,
  state,
  status,
  title,
  totalCount,
  values,
  onApplyRoleAutofill,
  onClientChange,
  onClientCreated,
  onGoToNextPending,
  onTitleChange,
}: Props) {
  const remaining = totalCount - completedCount;
  const allComplete = totalCount > 0 && remaining <= 0;

  return (
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
          Datos de la Escritura
        </h2>
        <p className="text-xs text-slate-500">
          Lo que escribas se refleja de inmediato en el documento.
        </p>
      </div>

      <div className="px-6 py-5 space-y-5 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto">
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
            onChange={(event) => onTitleChange(event.target.value)}
            className={inputClass}
            aria-describedby={state.titleError ? "composer-title-error" : undefined}
            aria-invalid={!!state.titleError}
          />
          <FieldError id="composer-title-error" message={state.titleError} />
        </div>

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
            onChange={(event) => onClientChange(event.target.value)}
            className={inputClass}
          >
            <option value="">Sin cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
          {!readOnly && (
            <div className="mt-2">
              <CreateClientDialog onCreated={onClientCreated} />
            </div>
          )}
        </div>

        <RoleAutofillPanel
          groups={roleGroups}
          clients={clients}
          values={values}
          readOnly={readOnly}
          onApply={onApplyRoleAutofill}
        />

        {totalCount > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
              Progreso
            </h3>
            <p role="status" className="text-xs font-medium text-slate-600">
              {completedCount} de {totalCount} campos completos
            </p>
            <p className="text-xs text-slate-500">
              {allComplete
                ? "Todos los campos están completos."
                : `${remaining} pendientes`}
            </p>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-accent-600 transition-all"
                style={{
                  width: `${Math.round((completedCount / totalCount) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {!readOnly && totalCount > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
              Acción
            </h3>
            <button
              type="button"
              onClick={onGoToNextPending}
              disabled={allComplete}
              className="w-full rounded-lg border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm font-medium text-accent-800 transition-colors hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente pendiente →
            </button>
          </div>
        )}

        {totalCount === 0 && (
          <p className="text-sm text-slate-500">
            Este machote no tiene variables: el documento es texto fijo y solo
            necesita un título.
          </p>
        )}
      </div>

      <DocumentComposerActions
        dirty={dirty}
        documentId={documentId}
        pending={pending}
        pendingVariableCount={pendingVariableCount}
        readOnly={readOnly}
        canEdit={canEdit}
        saveStatusText={saveStatusText}
        status={status}
        canFinalize={canFinalize}
      />
    </section>
  );
}
