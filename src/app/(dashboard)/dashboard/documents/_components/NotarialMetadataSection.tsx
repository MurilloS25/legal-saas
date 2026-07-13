"use client";

/**
 * Sección "Datos para índice" del detalle de una Escritura: formulario de la
 * metadata notarial interna. La completitud se calcula sobre los campos
 * mínimos (número de instrumento, fecha de autorización, tipo de acto) y es
 * interna al sistema, no una validación legal. Bloqueado cuando la Escritura
 * está finalizada.
 */

import { useActionState, useId, useState } from "react";
import {
  saveNotarialMetadataAction,
  type NotarialMetadataState,
} from "../notarial-actions";
import type { NotarialMetadata } from "@/lib/documents/notarial";
import { isNotarialComplete } from "@/lib/documents/notarial";
import { isoToCostaRicaLocal } from "@/lib/documents/notarial-datetime";
import { FieldError } from "@/components/forms/FieldError";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const initialState: NotarialMetadataState = {};

type Props = {
  documentId: string;
  metadata: NotarialMetadata | null;
  /** true cuando la Escritura está finalizada (solo lectura). */
  readOnly: boolean;
};

export function NotarialMetadataSection({
  documentId,
  metadata,
  readOnly,
}: Props) {
  const headingId = useId();
  const action = saveNotarialMetadataAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Valores controlados para el badge de completitud en vivo.
  const [instrument, setInstrument] = useState(
    metadata?.instrument_number ?? "",
  );
  const [authorizedAt, setAuthorizedAt] = useState(
    isoToCostaRicaLocal(metadata?.authorized_at ?? null),
  );
  const [actType, setActType] = useState(metadata?.act_type ?? "");

  const complete = isNotarialComplete({
    instrument_number: instrument,
    authorized_at: authorizedAt,
    act_type: actType,
  });

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h2 id={headingId} className="text-sm font-semibold text-slate-900">
            Datos para índice
          </h2>
          <p className="text-xs text-slate-500">
            Metadata interna para organizar el índice notarial. «Completo»
            significa completo según los campos del sistema, no una validación
            legal.
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            complete
              ? "bg-teal-50 text-teal-700 border border-teal-200"
              : "bg-amber-50 text-amber-800 border border-amber-300"
          }`}
        >
          {complete ? "Completo" : "Incompleto"}
        </span>
      </div>

      <form action={formAction} noValidate className="px-6 py-6">
        {state.success && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800"
          >
            Datos del índice guardados.
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
        {readOnly && (
          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            La escritura está finalizada. Reábrela para editar los datos del
            índice.
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="instrument_number" className={labelClass}>
              Número de instrumento
            </label>
            <input
              id="instrument_number"
              name="instrument_number"
              type="text"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              disabled={readOnly}
              className={inputClass}
              aria-invalid={!!state.errors?.instrument_number}
            />
            <FieldError
              id="instrument_number-error"
              message={state.errors?.instrument_number}
            />
          </div>

          <div>
            <label htmlFor="authorized_at" className={labelClass}>
              Fecha y hora de autorización
            </label>
            <input
              id="authorized_at"
              name="authorized_at"
              type="datetime-local"
              value={authorizedAt}
              onChange={(e) => setAuthorizedAt(e.target.value)}
              disabled={readOnly}
              className={inputClass}
              aria-invalid={!!state.errors?.authorized_at}
            />
            <FieldError
              id="authorized_at-error"
              message={state.errors?.authorized_at}
            />
            <p className="mt-1 text-xs text-slate-400">
              Hora de Costa Rica.
            </p>
          </div>

          <div>
            <label htmlFor="act_type" className={labelClass}>
              Tipo de acto
            </label>
            <input
              id="act_type"
              name="act_type"
              type="text"
              value={actType}
              onChange={(e) => setActType(e.target.value)}
              disabled={readOnly}
              className={inputClass}
              placeholder="Ej: Compraventa, Poder especial"
              aria-invalid={!!state.errors?.act_type}
            />
            <FieldError id="act_type-error" message={state.errors?.act_type} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="book_reference" className={labelClass}>
                Libro/Tomo{" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                id="book_reference"
                name="book_reference"
                type="text"
                defaultValue={metadata?.book_reference ?? ""}
                disabled={readOnly}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="folio_reference" className={labelClass}>
                Folio{" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                id="folio_reference"
                name="folio_reference"
                type="text"
                defaultValue={metadata?.folio_reference ?? ""}
                disabled={readOnly}
                className={inputClass}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="appearing_parties_summary" className={labelClass}>
              Comparecientes (resumen){" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="appearing_parties_summary"
              name="appearing_parties_summary"
              rows={3}
              defaultValue={metadata?.appearing_parties_summary ?? ""}
              disabled={readOnly}
              className={inputClass + " resize-y"}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              Notas internas{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={metadata?.notes ?? ""}
              disabled={readOnly}
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-xs text-slate-400">
              Uso interno; no se incluyen en la exportación del índice.
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Guardando…" : "Guardar datos del índice"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
