"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createDocumentDraftAction,
  updateDocumentDraftAction,
  type DocumentDraftState,
} from "../actions";
import type { DocumentRow } from "../queries";
import type { TemplateFieldRow } from "../../templates/queries";
import { FieldError } from "@/components/forms/FieldError";
import { findUnresolvedVariables } from "@/lib/templates/render";

// ------------------------------------------------------------------ styles

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

// ------------------------------------------------------------------ field input

type FieldInputProps = {
  field: TemplateFieldRow;
  defaultValue: string;
  error?: string;
};

function FieldInput({ field, defaultValue, error }: FieldInputProps) {
  const id = `draft-${field.field_key}`;
  const errorId = `${id}-error`;

  const shared = {
    id,
    name: field.field_key,
    required: field.required,
    defaultValue,
    className: inputClass,
    "aria-describedby": error ? errorId : undefined,
    "aria-invalid": !!error,
  };

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {field.label}
        {field.required ? (
          requiredMark
        ) : (
          <span className="text-slate-400 font-normal"> (opcional)</span>
        )}
      </label>
      {field.field_type === "textarea" ? (
        <textarea {...shared} rows={4} className={inputClass + " resize-y"} />
      ) : (
        <input {...shared} type="text" />
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

// ------------------------------------------------------------------ props

type Props = {
  fields: TemplateFieldRow[];
  /** Contenido del machote con placeholders (para variables sin valor). */
  content: string;
} & (
  | { mode: "create"; templateId: string; defaultTitle: string }
  | { mode: "edit"; document: DocumentRow; savedJustNow?: boolean }
);

const initialState: DocumentDraftState = {};

// ------------------------------------------------------------------ component

export function DocumentDraftForm(props: Props) {
  const { fields, content } = props;
  const isEdit = props.mode === "edit";
  const doc = isEdit ? props.document : null;

  const action = isEdit
    ? updateDocumentDraftAction.bind(null, props.document.id)
    : createDocumentDraftAction.bind(null, props.templateId);

  const [state, formAction, pending] = useActionState(action, initialState);

  const savedValues = doc?.field_values ?? {};
  const showSavedBanner =
    state.success || (isEdit && props.savedJustNow && !state.message && !state.errors);

  // Variables del contenido sin valor en el último guardado.
  const unresolved = doc ? findUnresolvedVariables(content, savedValues) : [];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      {/* ---- Formulario ---- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <p className="text-sm font-semibold text-slate-900">
            Datos de la escritura
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios. Al guardar se actualiza la vista previa.
          </p>
        </div>

        <form action={formAction} noValidate className="px-6 py-6">
          {showSavedBanner && (
            <div
              role="status"
              className="mb-6 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800"
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

          <div className="space-y-5">
            <div>
              <label htmlFor="draft-title" className={labelClass}>
                Título de la escritura{requiredMark}
              </label>
              <input
                id="draft-title"
                name="title"
                type="text"
                required
                defaultValue={isEdit ? doc!.title : props.defaultTitle}
                className={inputClass}
                aria-describedby={
                  state.titleError ? "draft-title-error" : undefined
                }
                aria-invalid={!!state.titleError}
              />
              <FieldError id="draft-title-error" message={state.titleError} />
            </div>

            {fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                defaultValue={savedValues[field.field_key] ?? ""}
                error={state.errors?.[field.field_key]}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href="/dashboard/documents"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Volver a Escrituras
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </form>
      </div>

      {/* ---- Vista previa guardada (solo en edición) ---- */}
      {isEdit && (
        <section
          aria-labelledby="document-preview-heading"
          className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-100 bg-teal-50/60">
            <h2
              id="document-preview-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Vista previa del documento
            </h2>
            <p className="text-xs text-slate-500">
              Refleja el último borrador guardado.
            </p>
          </div>

          {unresolved.length > 0 && (
            <div className="px-6 py-3 border-b border-amber-100 bg-amber-50">
              <p className="text-xs font-medium text-amber-800 mb-1.5">
                Variables sin valor (se muestran tal cual en el texto):
              </p>
              <div className="flex flex-wrap gap-2">
                {unresolved.map((variable) => (
                  <code
                    key={variable}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-amber-800 border border-amber-200"
                  >{`{{${variable}}}`}</code>
                ))}
              </div>
            </div>
          )}

          <div className="px-8 py-8">
            <pre className="mx-auto max-w-prose text-sm text-slate-900 whitespace-pre-wrap break-words font-sans leading-relaxed">
              {doc!.rendered_content}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
