"use client";

/**
 * Campos del Cliente compartidos por el formulario completo (`ClientForm`)
 * y el diálogo de creación contextual (`CreateClientDialog`), para que
 * ambos se comporten igual según el tipo de identificación.
 *
 * - Cédula física: nombre, cédula, estado civil, nacionalidad, ocupación y
 *   dirección (sin cambios respecto al formulario anterior).
 * - Cédula jurídica: razón social, cédula jurídica (con sus guiones) y
 *   domicilio. Estado civil, nacionalidad y ocupación no aplican.
 *
 * Al cambiar a "Cédula jurídica" los campos personales se ocultan y se
 * deshabilitan (no se envían), pero conservan lo escrito: si se vuelve a
 * "Cédula física" antes de guardar, reaparecen intactos. Al guardar como
 * jurídica el servidor los guarda vacíos; en edición se advierte antes de
 * guardar si el Cliente tenía esos datos (nunca se borran en silencio).
 */

import { useState } from "react";
import { FieldError } from "@/components/forms/FieldError";
import type { ClientState } from "../model/action-state";
import {
  IDENTIFICATION_TYPES,
  IDENTIFICATION_TYPE_LABELS,
  MARITAL_STATUS_OPTIONS,
  isLegalEntityType,
  resolveMaritalStatusSelection,
  type IdentificationType,
} from "../model/client-schema";
import type { ClientRow } from "../model/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

function toIdentificationType(raw: string | null | undefined): IdentificationType {
  return (IDENTIFICATION_TYPES as readonly string[]).includes(raw ?? "")
    ? (raw as IdentificationType)
    : "cedula_fisica";
}

type Props = {
  /** Prefijo de los `id` de los controles (el diálogo convive con otro formulario). */
  idPrefix?: string;
  client?: ClientRow | null;
  errors?: ClientState["errors"];
  disabled?: boolean;
  autoFocus?: boolean;
  addressRows?: number;
  gapClass?: string;
};

export function ClientFields({
  idPrefix = "",
  client = null,
  errors,
  disabled = false,
  autoFocus = false,
  addressRows = 3,
  gapClass = "gap-5",
}: Props) {
  const [type, setType] = useState<IdentificationType>(
    toIdentificationType(client?.identification_type),
  );
  const legalEntity = isLegalEntityType(type);
  const id = (name: string) => `${idPrefix}${name}`;

  // Solo en edición: el Cliente guardado es persona física con datos
  // personales y el usuario lo está cambiando a jurídica.
  const personalDataWillBeCleared =
    legalEntity &&
    !!client &&
    !isLegalEntityType(client.identification_type) &&
    [client.marital_status, client.nationality, client.occupation].some(
      (value) => (value ?? "").trim() !== "",
    );

  const describedBy = (
    name: keyof NonNullable<ClientState["errors"]>,
    hint = false,
  ) =>
    [errors?.[name] ? id(`${name}-error`) : null, hint ? id(`${name}-hint`) : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <>
      {/* Row 1: Identification type + number */}
      <div className={`grid grid-cols-1 ${gapClass} sm:grid-cols-2`}>
        <div>
          <label htmlFor={id("identification_type")} className={labelClass}>
            Tipo de identificación{requiredMark}
          </label>
          <select
            id={id("identification_type")}
            name="identification_type"
            required
            disabled={disabled}
            value={type}
            onChange={(event) =>
              setType(toIdentificationType(event.target.value))
            }
            className={inputClass}
            aria-describedby={describedBy("identification_type")}
            aria-invalid={!!errors?.identification_type}
          >
            {IDENTIFICATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {IDENTIFICATION_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError
            id={id("identification_type-error")}
            message={errors?.identification_type}
          />
        </div>

        <div>
          <label htmlFor={id("identification_number")} className={labelClass}>
            {legalEntity ? "Cédula jurídica" : "Número de cédula"}
            {requiredMark}
          </label>
          <input
            id={id("identification_number")}
            name="identification_number"
            type="text"
            required
            disabled={disabled}
            defaultValue={client?.identification_number ?? ""}
            className={inputClass}
            placeholder={legalEntity ? "3-101-123456" : "0-0000-0000"}
            aria-describedby={describedBy("identification_number", true)}
            aria-invalid={!!errors?.identification_number}
          />
          <p
            id={id("identification_number-hint")}
            className="mt-1 text-xs text-slate-500"
          >
            {legalEntity
              ? "Se guardará tal como la escribes, con sus guiones."
              : "La identificación se guardará sin guiones ni espacios."}
          </p>
          <FieldError
            id={id("identification_number-error")}
            message={errors?.identification_number}
          />
        </div>
      </div>

      {/* Row 2: Name — full width */}
      <div>
        <label htmlFor={id("full_name")} className={labelClass}>
          {legalEntity ? "Razón social" : "Nombre completo"}
          {requiredMark}
        </label>
        <input
          id={id("full_name")}
          name="full_name"
          type="text"
          required
          autoFocus={autoFocus}
          disabled={disabled}
          defaultValue={client?.full_name ?? ""}
          className={inputClass}
          placeholder={
            legalEntity
              ? "Inversiones Ejemplo Sociedad Anónima"
              : "Juan Pérez Rodríguez"
          }
          aria-describedby={describedBy("full_name")}
          aria-invalid={!!errors?.full_name}
        />
        <FieldError id={id("full_name-error")} message={errors?.full_name} />
      </div>

      {personalDataWillBeCleared && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Una persona jurídica no tiene estado civil, nacionalidad ni
          ocupación. Si guardas como cédula jurídica, esos datos de este
          Cliente se eliminarán. Vuelve a “Cédula física” antes de guardar
          para conservarlos.
        </div>
      )}

      {/* Datos personales: solo persona física. Ocultos + deshabilitados
          (no se envían) para jurídica, sin perder lo escrito. */}
      <fieldset
        hidden={legalEntity}
        disabled={disabled || legalEntity}
        className="space-y-5 border-0 p-0 m-0 min-w-0"
      >
        <legend className="sr-only">Datos de persona física</legend>
        <div className={`grid grid-cols-1 ${gapClass} sm:grid-cols-2`}>
          <div>
            <label htmlFor={id("marital_status")} className={labelClass}>
              Estado civil{requiredMark}
            </label>
            <select
              id={id("marital_status")}
              name="marital_status"
              required
              defaultValue={resolveMaritalStatusSelection(client?.marital_status)}
              className={inputClass}
              aria-describedby={describedBy("marital_status")}
              aria-invalid={!!errors?.marital_status}
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
              id={id("marital_status-error")}
              message={errors?.marital_status}
            />
          </div>

          <div>
            <label htmlFor={id("nationality")} className={labelClass}>
              Nacionalidad{requiredMark}
            </label>
            <input
              id={id("nationality")}
              name="nationality"
              type="text"
              required
              defaultValue={client?.nationality ?? ""}
              className={inputClass}
              placeholder="Costarricense"
              aria-describedby={describedBy("nationality")}
              aria-invalid={!!errors?.nationality}
            />
            <FieldError
              id={id("nationality-error")}
              message={errors?.nationality}
            />
          </div>
        </div>

        <div>
          <label htmlFor={id("occupation")} className={labelClass}>
            Ocupación{requiredMark}
          </label>
          <input
            id={id("occupation")}
            name="occupation"
            type="text"
            required
            defaultValue={client?.occupation ?? ""}
            className={inputClass}
            placeholder="Ingeniero civil"
            aria-describedby={describedBy("occupation")}
            aria-invalid={!!errors?.occupation}
          />
          <FieldError id={id("occupation-error")} message={errors?.occupation} />
        </div>
      </fieldset>

      {/* Address — full width */}
      <div>
        <label htmlFor={id("exact_address")} className={labelClass}>
          {legalEntity ? "Domicilio" : "Dirección exacta"}
          {requiredMark}
        </label>
        <textarea
          id={id("exact_address")}
          name="exact_address"
          required
          rows={addressRows}
          disabled={disabled}
          defaultValue={client?.exact_address ?? ""}
          className={inputClass}
          placeholder="San José, Escazú, del parque 200 metros norte…"
          aria-describedby={describedBy("exact_address")}
          aria-invalid={!!errors?.exact_address}
        />
        <FieldError
          id={id("exact_address-error")}
          message={errors?.exact_address}
        />
      </div>
    </>
  );
}
