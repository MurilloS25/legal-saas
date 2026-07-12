"use client";

import Link from "next/link";
import { useActionState } from "react";
import { prepareDocumentAction, type DocumentFillState } from "../actions";
import type { TemplateFieldRow } from "../queries";
import { FieldError } from "@/components/forms/FieldError";

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
};

const initialState: DocumentFillState = {};

export function DocumentFillForm({ templateId, fields }: Props) {
  const action = prepareDocumentAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const prepared = state.preparedValues;

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
              href={`/dashboard/templates/${templateId}`}
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

      {/* ---- Resumen temporal (solo en memoria) ---- */}
      {prepared && (
        <section
          aria-labelledby="fill-summary-heading"
          className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-100 bg-teal-50/60">
            <h2
              id="fill-summary-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Resumen del documento
            </h2>
            <p className="text-xs text-slate-500">
              Datos validados para este documento. No se guardan en el sistema.
            </p>
          </div>
          <dl className="px-6 py-5 divide-y divide-slate-100">
            {fields.map((field) => (
              <div
                key={field.id}
                className="py-2.5 grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr]"
              >
                <dt className="text-sm text-slate-500">{field.label}</dt>
                <dd className="text-sm text-slate-900">
                  {prepared[field.field_key] || (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
