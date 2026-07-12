"use client";

import Link from "next/link";
import { useActionState } from "react";
import { prepareDocumentAction, type DocumentFillState } from "../actions";
import type { TemplateFieldRow } from "../queries";
import { FieldError } from "@/components/forms/FieldError";
import {
  renderTemplateContent,
  findUnresolvedVariables,
} from "@/lib/templates/render";

// ------------------------------------------------------------------ styles

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

// ------------------------------------------------------------------ dynamic input

type FieldInputProps = {
  field: TemplateFieldRow;
  defaultValue: string;
  error?: string;
};

function FieldInput({ field, defaultValue, error }: FieldInputProps) {
  const id = `fill-${field.field_key}`;
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
      {/* Todos los valores se escriben como texto (montos en palabras,
          fechas jurídicas, etc.). Los campos legados de tipo textarea
          conservan el área de texto; el resto usa input de texto. */}
      {field.field_type === "textarea" ? (
        <textarea {...shared} rows={4} className={inputClass + " resize-y"} />
      ) : (
        <input {...shared} type="text" />
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

// ------------------------------------------------------------------ component

type Props = {
  templateId: string;
  fields: TemplateFieldRow[];
  /** Contenido del machote con placeholders, para la vista previa. */
  content: string;
  /** Destino del botón Cancelar. Por defecto, el detalle del machote. */
  cancelHref?: string;
};

const initialState: DocumentFillState = {};

export function DocumentFillForm({
  templateId,
  fields,
  content,
  cancelHref,
}: Props) {
  const action = prepareDocumentAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const prepared = state.preparedValues;
  // El reemplazo lo hace el helper compartido de render; el componente solo
  // presenta el resultado como texto plano.
  const preview = prepared ? renderTemplateContent(content, prepared) : null;
  const unresolved = prepared ? findUnresolvedVariables(content, prepared) : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <p className="text-sm font-semibold text-slate-900">
            Datos del documento
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios. Los valores no se guardan en el sistema.
          </p>
        </div>

        <form action={formAction} noValidate className="px-6 py-6">
          {state.message && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}

          <div className="space-y-5">
            {fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                defaultValue={prepared?.[field.field_key] ?? ""}
                error={state.errors?.[field.field_key]}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href={cancelHref ?? `/dashboard/templates/${templateId}`}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Preparando…" : "Preparar documento"}
            </button>
          </div>
        </form>
      </div>

      {/* ---- Vista previa del documento (solo en memoria) ---- */}
      {preview !== null && (
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
              Contenido del machote con los datos sustituidos. No se guarda en
              el sistema.
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

          <pre className="px-6 py-5 text-sm text-slate-900 whitespace-pre-wrap break-words font-sans leading-relaxed">
            {preview}
          </pre>
        </section>
      )}
    </div>
  );
}
