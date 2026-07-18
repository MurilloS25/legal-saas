"use client";

import { FieldError } from "@/components/forms/FieldError";
import type { FillableTemplateField } from "@/features/templates";
import type { DocumentDraftState } from "../server/content-actions";
import type { DocumentStatus } from "../model/lifecycle";
import { documentFieldInputId } from "../model/composer";
import type { DocumentMobileView } from "../hooks/use-document-layout";
import { DocumentComposerActions } from "./DocumentComposerActions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

type FieldFilter = "all" | "pending";

type Props = {
  clientId: string;
  clients: { id: string; full_name: string }[];
  completedCount: number;
  dirty: boolean;
  documentId: string | null;
  fieldFilter: FieldFilter;
  fields: FillableTemplateField[];
  mobileView: DocumentMobileView;
  pending: boolean;
  pendingVariableCount: number;
  readOnly: boolean;
  saveStatusText: string;
  state: DocumentDraftState;
  status: DocumentStatus;
  title: string;
  values: Record<string, string>;
  visibleFields: FillableTemplateField[];
  onClientChange: (value: string) => void;
  onFieldBlur: () => void;
  onFieldChange: (key: string, value: string) => void;
  onFieldFilterChange: (value: FieldFilter) => void;
  onFieldFocus: (key: string) => void;
  onTitleChange: (value: string) => void;
};

function filterButtonClass(active: boolean) {
  return `rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 ${
    active
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
  }`;
}

export function DocumentFormPanel({
  clientId,
  clients,
  completedCount,
  dirty,
  documentId,
  fieldFilter,
  fields,
  mobileView,
  pending,
  pendingVariableCount,
  readOnly,
  saveStatusText,
  state,
  status,
  title,
  values,
  visibleFields,
  onClientChange,
  onFieldBlur,
  onFieldChange,
  onFieldFilterChange,
  onFieldFocus,
  onTitleChange,
}: Props) {
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
          Datos de la escritura
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
        </div>

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
                className="h-full rounded-full bg-accent-600 transition-all"
                style={{
                  width: `${Math.round((completedCount / fields.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {fields.length > 1 && (
          <div role="group" aria-label="Filtrar campos" className="flex gap-2">
            <button
              type="button"
              onClick={() => onFieldFilterChange("all")}
              aria-pressed={fieldFilter === "all"}
              className={filterButtonClass(fieldFilter === "all")}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onFieldFilterChange("pending")}
              aria-pressed={fieldFilter === "pending"}
              className={filterButtonClass(fieldFilter === "pending")}
            >
              Pendientes
            </button>
          </div>
        )}

        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">
            Este machote no tiene variables: el documento es texto fijo y solo
            necesita un título.
          </p>
        ) : visibleFields.length === 0 ? (
          <p className="text-sm text-accent-700">
            Todos los campos están completos.
          </p>
        ) : (
          visibleFields.map((field) => {
            const id = documentFieldInputId(field.field_key);
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
                  onChange={(event) =>
                    onFieldChange(field.field_key, event.target.value)
                  }
                  onFocus={() => onFieldFocus(field.field_key)}
                  onBlur={onFieldBlur}
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

      <DocumentComposerActions
        dirty={dirty}
        documentId={documentId}
        pending={pending}
        pendingVariableCount={pendingVariableCount}
        readOnly={readOnly}
        saveStatusText={saveStatusText}
        status={status}
      />
    </section>
  );
}
