"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  createTemplateFieldAction,
  updateTemplateFieldAction,
  type TemplateFieldState,
} from "../actions";
import type { TemplateFieldRow } from "../queries";
import { FieldError } from "@/components/forms/FieldError";
import { DeleteTemplateFieldButton } from "./DeleteTemplateFieldButton";

// ------------------------------------------------------------------ styles

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

const addButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors";

// ------------------------------------------------------------------ field form

type FieldFormProps = {
  templateId: string;
  field?: TemplateFieldRow;
  onClose: () => void;
};

const initialFieldState: TemplateFieldState = {};

function TemplateFieldForm({ templateId, field, onClose }: FieldFormProps) {
  const isEdit = !!field;

  const action = isEdit
    ? updateTemplateFieldAction.bind(null, field.id, templateId)
    : createTemplateFieldAction.bind(null, templateId);

  const [state, formAction, pending] = useActionState(action, initialFieldState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
      noValidate
      aria-label={isEdit ? "Editar campo" : "Nuevo campo"}
      className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
    >
      {state.message && !state.errors && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="field-label" className={labelClass}>
            Etiqueta{requiredMark}
          </label>
          <input
            id="field-label"
            name="label"
            type="text"
            required
            defaultValue={field?.label ?? ""}
            className={inputClass}
            placeholder="Ej: Comprador 1 - Nombre completo"
            aria-describedby={state.errors?.label ? "field-label-error" : undefined}
            aria-invalid={!!state.errors?.label}
          />
          <FieldError id="field-label-error" message={state.errors?.label} />
        </div>

        <div>
          <label htmlFor="field-key" className={labelClass}>
            Variable{requiredMark}
          </label>
          <input
            id="field-key"
            name="field_key"
            type="text"
            required
            defaultValue={field?.field_key ?? ""}
            className={inputClass + " font-mono"}
            placeholder="Ej: buyer_1.full_name"
            aria-describedby={
              state.errors?.field_key
                ? "field-key-error field-key-help"
                : "field-key-help"
            }
            aria-invalid={!!state.errors?.field_key}
          />
          <FieldError id="field-key-error" message={state.errors?.field_key} />
          <p id="field-key-help" className="mt-1.5 text-xs text-slate-500">
            En el contenido del machote se usará como{" "}
            <code className="font-mono">{"{{buyer_1.full_name}}"}</code>.
          </p>
        </div>

        <div className="flex items-end pb-2.5">
          <label
            htmlFor="field-required"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
          >
            <input
              id="field-required"
              name="required"
              type="checkbox"
              defaultChecked={field?.required ?? false}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-2 focus:ring-teal-500"
            />
            Campo obligatorio
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Guardando…" : "Guardar campo"}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ section

type Props = {
  templateId: string;
  fields: TemplateFieldRow[];
};

type ActiveForm = { mode: "create" } | { mode: "edit"; fieldId: string } | null;

export function TemplateFieldsSection({ templateId, fields }: Props) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  const closeForm = () => setActiveForm(null);
  const isCreating = activeForm?.mode === "create";

  return (
    <section
      aria-labelledby="template-fields-heading"
      className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* ---- Section header ---- */}
      <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h2
            id="template-fields-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Campos del machote
          </h2>
          <p className="text-xs text-slate-500">
            Define los datos que se solicitarán al crear una escritura con
            este machote. Todos los valores se escriben como texto.
          </p>
        </div>
        {fields.length > 0 && !activeForm && (
          <button
            type="button"
            onClick={() => setActiveForm({ mode: "create" })}
            className={addButtonClass}
          >
            Agregar campo
          </button>
        )}
      </div>

      <div className="px-6 py-5">
        {/* ---- Empty state ---- */}
        {fields.length === 0 && !isCreating && (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-8 text-center">
            <p className="text-sm text-slate-600 mb-4">
              Este machote aún no tiene campos definidos.
            </p>
            <button
              type="button"
              onClick={() => setActiveForm({ mode: "create" })}
              className={addButtonClass}
            >
              Agregar campo
            </button>
          </div>
        )}

        {/* ---- Field list ---- */}
        {fields.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {fields.map((field) =>
              activeForm?.mode === "edit" && activeForm.fieldId === field.id ? (
                <li key={field.id} className="py-3">
                  <TemplateFieldForm
                    templateId={templateId}
                    field={field}
                    onClose={closeForm}
                  />
                </li>
              ) : (
                <li
                  key={field.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {field.label}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                        {`{{${field.field_key}}}`}
                      </code>
                      {field.required && (
                        <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                          Obligatorio
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveForm({ mode: "edit", fieldId: field.id })
                      }
                      aria-label={`Editar ${field.label}`}
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                    >
                      Editar
                    </button>
                    <DeleteTemplateFieldButton
                      fieldId={field.id}
                      templateId={templateId}
                      fieldLabel={field.label}
                    />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {/* ---- Create form ---- */}
        {isCreating && (
          <div className={fields.length > 0 ? "mt-4" : ""}>
            <TemplateFieldForm templateId={templateId} onClose={closeForm} />
          </div>
        )}
      </div>
    </section>
  );
}
