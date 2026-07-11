"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createClientAction,
  updateClientAction,
  type ClientState,
} from "../actions";
import type { ClientRow } from "../queries";
import { DeleteClientButton } from "./DeleteClientButton";
import { FieldError } from "@/components/forms/FieldError";

// ------------------------------------------------------------------ marital status options

const MARITAL_STATUS_OPTIONS = [
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
  { value: "union_libre", label: "Unión libre" },
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
  | { mode: "edit"; client: ClientRow };

const initialState: ClientState = {};

// ------------------------------------------------------------------ component

export function ClientForm(props: Props) {
  const isEdit = props.mode === "edit";
  const client = isEdit ? props.client : null;

  const action = isEdit
    ? updateClientAction.bind(null, client!.id)
    : createClientAction;

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
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Información básica
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios.
          </p>
        </div>
        {isEdit && client && (
          <div className="ml-auto shrink-0">
            <DeleteClientButton
              clientId={client.id}
              clientName={client.full_name}
              variant="icon"
            />
          </div>
        )}
      </div>

      {/* ---- Form body ---- */}
      <form action={formAction} noValidate className="px-6 py-6">
        {/* Global feedback */}
        {state.success && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
          >
            {state.message}
          </div>
        )}
        {state.message && !state.success && !state.errors && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <div className="space-y-5">
          {/* Row 1: Full name + Identification type */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className={labelClass}>
                Nombre completo{requiredMark}
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                defaultValue={client?.full_name ?? ""}
                className={inputClass}
                placeholder="Juan Pérez Rodríguez"
                aria-describedby={
                  state.errors?.full_name ? "full_name-error" : undefined
                }
                aria-invalid={!!state.errors?.full_name}
              />
              <FieldError
                id="full_name-error"
                message={state.errors?.full_name}
              />
            </div>

            <div>
              <label htmlFor="identification_type" className={labelClass}>
                Tipo de identificación{requiredMark}
              </label>
              <select
                id="identification_type"
                name="identification_type"
                required
                defaultValue={client?.identification_type ?? "cedula_fisica"}
                className={inputClass}
                aria-describedby={
                  state.errors?.identification_type
                    ? "identification_type-error"
                    : undefined
                }
                aria-invalid={!!state.errors?.identification_type}
              >
                <option value="cedula_fisica">Cédula física</option>
              </select>
              <FieldError
                id="identification_type-error"
                message={state.errors?.identification_type}
              />
            </div>
          </div>

          {/* Row 2: ID number + Marital status */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="identification_number" className={labelClass}>
                Número de cédula{requiredMark}
              </label>
              <input
                id="identification_number"
                name="identification_number"
                type="text"
                required
                defaultValue={client?.identification_number ?? ""}
                className={inputClass}
                placeholder="0-0000-0000"
                aria-describedby={
                  state.errors?.identification_number
                    ? "identification_number-error"
                    : undefined
                }
                aria-invalid={!!state.errors?.identification_number}
              />
              <FieldError
                id="identification_number-error"
                message={state.errors?.identification_number}
              />
            </div>

            <div>
              <label htmlFor="marital_status" className={labelClass}>
                Estado civil{requiredMark}
              </label>
              <select
                id="marital_status"
                name="marital_status"
                required
                defaultValue={client?.marital_status ?? ""}
                className={inputClass}
                aria-describedby={
                  state.errors?.marital_status
                    ? "marital_status-error"
                    : undefined
                }
                aria-invalid={!!state.errors?.marital_status}
              >
                <option value="" disabled>
                  Seleccionar…
                </option>
                {MARITAL_STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError
                id="marital_status-error"
                message={state.errors?.marital_status}
              />
            </div>
          </div>

          {/* Row 3: Nationality + Occupation */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="nationality" className={labelClass}>
                Nacionalidad{requiredMark}
              </label>
              <input
                id="nationality"
                name="nationality"
                type="text"
                required
                defaultValue={client?.nationality ?? ""}
                className={inputClass}
                placeholder="Costarricense"
                aria-describedby={
                  state.errors?.nationality ? "nationality-error" : undefined
                }
                aria-invalid={!!state.errors?.nationality}
              />
              <FieldError
                id="nationality-error"
                message={state.errors?.nationality}
              />
            </div>

            <div>
              <label htmlFor="occupation" className={labelClass}>
                Ocupación{requiredMark}
              </label>
              <input
                id="occupation"
                name="occupation"
                type="text"
                required
                defaultValue={client?.occupation ?? ""}
                className={inputClass}
                placeholder="Ingeniero civil"
                aria-describedby={
                  state.errors?.occupation ? "occupation-error" : undefined
                }
                aria-invalid={!!state.errors?.occupation}
              />
              <FieldError
                id="occupation-error"
                message={state.errors?.occupation}
              />
            </div>
          </div>

          {/* Row 4: Exact address — full width */}
          <div>
            <label htmlFor="exact_address" className={labelClass}>
              Dirección exacta{requiredMark}
            </label>
            <textarea
              id="exact_address"
              name="exact_address"
              required
              rows={3}
              defaultValue={client?.exact_address ?? ""}
              className={inputClass}
              placeholder="San José, Escazú, del parque 200 metros norte…"
              aria-describedby={
                state.errors?.exact_address ? "exact_address-error" : undefined
              }
              aria-invalid={!!state.errors?.exact_address}
            />
            <FieldError
              id="exact_address-error"
              message={state.errors?.exact_address}
            />
          </div>
        </div>

        {/* ---- Buttons ---- */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <Link
            href="/dashboard/clients"
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
              "Crear cliente"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
