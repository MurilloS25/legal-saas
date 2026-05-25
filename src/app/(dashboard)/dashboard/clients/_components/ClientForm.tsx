"use client";

import { useActionState } from "react";
import {
  createClientAction,
  updateClientAction,
  type ClientState,
} from "../actions";
import type { ClientRow } from "../queries";

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

// ------------------------------------------------------------------ field error helper

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-700">
      {message}
    </p>
  );
}

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
    <form action={formAction} className="space-y-5" noValidate>
      {state.success && (
        <div
          role="status"
          className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
        >
          {state.message}
        </div>
      )}

      {state.message && !state.success && !state.errors && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      {/* Full name */}
      <div>
        <label htmlFor="full_name" className={labelClass}>
          Nombre completo{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
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
        <FieldError message={state.errors?.full_name} />
      </div>

      {/* Identification type */}
      <div>
        <label htmlFor="identification_type" className={labelClass}>
          Tipo de identificación{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
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
        <FieldError message={state.errors?.identification_type} />
      </div>

      {/* Identification number */}
      <div>
        <label htmlFor="identification_number" className={labelClass}>
          Número de identificación{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
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
        <FieldError message={state.errors?.identification_number} />
      </div>

      {/* Marital status */}
      <div>
        <label htmlFor="marital_status" className={labelClass}>
          Estado civil{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <select
          id="marital_status"
          name="marital_status"
          required
          defaultValue={client?.marital_status ?? ""}
          className={inputClass}
          aria-describedby={
            state.errors?.marital_status ? "marital_status-error" : undefined
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
        <FieldError message={state.errors?.marital_status} />
      </div>

      {/* Nationality */}
      <div>
        <label htmlFor="nationality" className={labelClass}>
          Nacionalidad{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
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
        <FieldError message={state.errors?.nationality} />
      </div>

      {/* Occupation */}
      <div>
        <label htmlFor="occupation" className={labelClass}>
          Ocupación{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
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
        <FieldError message={state.errors?.occupation} />
      </div>

      {/* Exact address */}
      <div>
        <label htmlFor="exact_address" className={labelClass}>
          Dirección exacta{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <textarea
          id="exact_address"
          name="exact_address"
          required
          rows={3}
          defaultValue={client?.exact_address ?? ""}
          className={inputClass}
          placeholder="San José, Escazú, del parque 200 metros norte"
          aria-describedby={
            state.errors?.exact_address ? "exact_address-error" : undefined
          }
          aria-invalid={!!state.errors?.exact_address}
        />
        <FieldError message={state.errors?.exact_address} />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
