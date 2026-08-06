"use client";

import { useId } from "react";
import { FieldError } from "@/components/forms/FieldError";
import type { TemplateWorkspaceState } from "../server/template-actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "archived", label: "Archivado" },
] as const;

type Props = {
  name: string;
  description: string;
  status: string;
  errors: TemplateWorkspaceState["errors"];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  /** templates.write — sin este permiso los 3 campos son de solo lectura. */
  disabled?: boolean;
};

export function TemplateMetadataForm({
  name,
  description,
  status,
  errors,
  onNameChange,
  onDescriptionChange,
  onStatusChange,
  disabled = false,
}: Props) {
  const nameId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const requiredMark = (
    <span aria-hidden="true" className="text-red-500 ml-0.5">
      *
    </span>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-sm font-semibold text-slate-900">
          Información básica
        </h2>
        <p className="text-xs text-slate-500">
          Los campos marcados con{" "}
          <span aria-hidden="true" className="text-red-500 font-semibold">
            *
          </span>{" "}
          son obligatorios.
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor={nameId} className={labelClass}>
              Nombre del machote{requiredMark}
            </label>
            <input
              id={nameId}
              name="name"
              type="text"
              required
              disabled={disabled}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className={inputClass}
              placeholder="Ej: Contrato de Arrendamiento Residencial"
              aria-describedby={errors?.name ? `${nameId}-error` : undefined}
              aria-invalid={!!errors?.name}
            />
            <FieldError id={`${nameId}-error`} message={errors?.name} />
          </div>

          <div className="sm:w-44">
            <label htmlFor={statusId} className={labelClass}>
              Estado{requiredMark}
            </label>
            <select
              id={statusId}
              name="status"
              required
              disabled={disabled}
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className={inputClass}
              aria-describedby={errors?.status ? `${statusId}-error` : undefined}
              aria-invalid={!!errors?.status}
            >
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError id={`${statusId}-error`} message={errors?.status} />
          </div>
        </div>

        <div>
          <label htmlFor={descriptionId} className={labelClass}>
            Descripción{" "}
            <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            id={descriptionId}
            name="description"
            type="text"
            disabled={disabled}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className={inputClass}
            placeholder="Descripción breve del propósito del machote"
            aria-describedby={
              errors?.description ? `${descriptionId}-error` : undefined
            }
            aria-invalid={!!errors?.description}
          />
          <FieldError
            id={`${descriptionId}-error`}
            message={errors?.description}
          />
        </div>
      </div>
    </section>
  );
}
