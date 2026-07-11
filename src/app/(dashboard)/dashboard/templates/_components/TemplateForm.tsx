"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateState,
} from "../actions";
import type { TemplateRow } from "../queries";
import { FieldError } from "@/components/forms/FieldError";

function extractContent(row: TemplateRow): string {
  if (!row.content_json) return "";
  const json = row.content_json as { text?: string };
  return json.text ?? "";
}

// ------------------------------------------------------------------ status options

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "archived", label: "Archivado" },
] as const;

// ------------------------------------------------------------------ styles

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

// ------------------------------------------------------------------ props

type Props =
  | { mode: "create" }
  | { mode: "edit"; template: TemplateRow };

const initialState: TemplateState = {};

// ------------------------------------------------------------------ component

export function TemplateForm(props: Props) {
  const isEdit = props.mode === "edit";
  const template = isEdit ? props.template : null;
  const currentContent = template ? extractContent(template) : "";

  const action = isEdit
    ? updateTemplateAction.bind(null, template!.id)
    : createTemplateAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ---- Card header ---- */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-teal-700"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {isEdit ? "Editar machote" : "Nuevo machote"}
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios.
          </p>
        </div>
      </div>

      {/* ---- Form body ---- */}
      <form action={formAction} noValidate className="px-6 py-6">
        {/* Global error feedback (validation passed but DB failed) */}
        {state.message && !state.errors && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <div className="space-y-5">
          {/* Row 1: Name + Status */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="name" className={labelClass}>
                Nombre del machote{requiredMark}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={template?.name ?? ""}
                className={inputClass}
                placeholder="Ej: Contrato de Arrendamiento Residencial"
                aria-describedby={state.errors?.name ? "name-error" : undefined}
                aria-invalid={!!state.errors?.name}
              />
              <FieldError id="name-error" message={state.errors?.name} />
            </div>

            <div className="sm:w-44">
              <label htmlFor="status" className={labelClass}>
                Estado{requiredMark}
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={template?.status ?? "draft"}
                className={inputClass}
                aria-describedby={state.errors?.status ? "status-error" : undefined}
                aria-invalid={!!state.errors?.status}
              >
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError id="status-error" message={state.errors?.status} />
            </div>
          </div>

          {/* Description — optional */}
          <div>
            <label htmlFor="description" className={labelClass}>
              Descripción{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              defaultValue={template?.description ?? ""}
              className={inputClass}
              placeholder="Descripción breve del propósito del machote"
              aria-describedby={
                state.errors?.description ? "description-error" : undefined
              }
              aria-invalid={!!state.errors?.description}
            />
            <FieldError id="description-error" message={state.errors?.description} />
          </div>

          {/* Content — required, full-width textarea */}
          <div>
            <label htmlFor="content" className={labelClass}>
              Contenido{requiredMark}
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={16}
              defaultValue={currentContent}
              className={inputClass + " resize-y font-mono text-xs leading-relaxed"}
              placeholder="Redacta aquí el texto del machote. Puedes usar variables como {{buyer_1.full_name}}."
              aria-describedby={state.errors?.content ? "content-error" : undefined}
              aria-invalid={!!state.errors?.content}
            />
            <FieldError id="content-error" message={state.errors?.content} />
          </div>
        </div>

        {/* ---- Buttons ---- */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <Link
            href="/dashboard/templates"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Guardando…
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear machote"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
