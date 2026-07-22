"use client";

/**
 * Sección "Datos para índice" del detalle de una Escritura: formulario de la
 * metadata notarial interna. La completitud se calcula sobre los campos
 * estructurados requeridos por el índice interno. Puede corregirse aun cuando
 * la Escritura esté finalizada, sin alterar el contenido de la Escritura.
 */

import { useActionState, useId, useState } from "react";
import {
  saveNotarialMetadataAction,
  type NotarialMetadataState,
} from "../server/metadata-actions";
import type { NotarialMetadata } from "../model/notarial";
import type {
  NotarialAuthorizedAtPrefill,
  NotarialMetadataPrefill,
  NotarialPrefillField,
} from "../model/prefill";
import { isNotarialComplete } from "../model/notarial";
import { FieldError } from "@/components/forms/FieldError";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const initialState: NotarialMetadataState = {};

type Props = {
  documentId: string;
  metadata: NotarialMetadata | null;
  prefill: NotarialMetadataPrefill;
  /** true cuando el contenido de la Escritura está finalizado. */
  readOnly: boolean;
  canResetParties?: boolean;
  actNamePreview?: string | null;
  generatedPartiesPreview?: string | null;
  reviewRequired?: boolean;
};

export function NotarialMetadataSection({
  documentId,
  metadata,
  prefill,
  readOnly,
  canResetParties = false,
  actNamePreview = null,
  generatedPartiesPreview = null,
  reviewRequired = false,
}: Props) {
  const headingId = useId();
  const action = saveNotarialMetadataAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Valores controlados para el badge de completitud en vivo.
  const [instrument, setInstrument] = useState(prefill.instrumentNumber.value);
  const [authorizedAt, setAuthorizedAt] = useState(prefill.authorizedAt.value);
  const [protocolBook, setProtocolBook] = useState(prefill.protocolBook.value);
  const [initialFolio, setInitialFolio] = useState(prefill.initialFolio.value);
  const [finalFolio, setFinalFolio] = useState(prefill.finalFolio.value);
  const [actName, setActName] = useState(prefill.actName.value);
  const [parties, setParties] = useState(metadata?.parties_override ?? "");
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.resetParties) setParties("");
  }

  const complete = isNotarialComplete({
    instrument_number: Number(instrument),
    authorized_at: authorizedAt,
    protocol_book: protocolBook,
    initial_folio: initialFolio,
    final_folio: finalFolio,
    act_name_override: actName,
    act_name_snapshot: metadata?.act_name_snapshot ?? actNamePreview,
    parties_override: parties,
    generated_parties:
      metadata?.generated_parties ?? generatedPartiesPreview,
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
        {/* "Completo" es un estado positivo real → verde semántico, no el
            acento decorativo. */}
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            complete
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
            className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800"
          >
            {state.successMessage ?? "Datos del índice guardados."}
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
            La escritura está finalizada. Puedes corregir estos datos del
            índice sin modificar el contenido de la escritura.
          </div>
        )}
        {reviewRequired && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            El contenido de la escritura cambió después del último guardado de
            estos datos. Revísalos antes de preparar el índice; no se modificó
            ningún valor manual.
          </div>
        )}

        <input type="hidden" name="version" value={metadata?.version ?? 1} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="instrument_number" className={labelClass}>
              Número de instrumento
            </label>
            <input
              id="instrument_number"
              name="instrument_number"
              type="number"
              min={1}
              step={1}
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.instrument_number}
              aria-describedby={
                state.errors?.instrument_number
                  ? "instrument_number-error"
                  : undefined
              }
            />
            <FieldError
              id="instrument_number-error"
              message={state.errors?.instrument_number}
            />
            <PrefillHelp field={prefill.instrumentNumber} />
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
              className={inputClass}
              aria-invalid={!!state.errors?.authorized_at}
              aria-describedby={
                state.errors?.authorized_at ? "authorized_at-error" : undefined
              }
            />
            <FieldError
              id="authorized_at-error"
              message={state.errors?.authorized_at}
            />
            <AuthorizedAtPrefillHelp field={prefill.authorizedAt} />
            <p className="mt-1 text-xs text-slate-400">
              Hora de Costa Rica.
            </p>
          </div>

          <div>
            <label htmlFor="act_name_override" className={labelClass}>
              Acto o contrato
            </label>
            <input
              id="act_name_override"
              name="act_name_override"
              type="text"
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              className={inputClass}
              placeholder={metadata?.act_name_snapshot ?? "Nombre del machote"}
              aria-invalid={!!state.errors?.act_name_override}
              aria-describedby={
                state.errors?.act_name_override
                  ? "act_name_override-error"
                  : undefined
              }
            />
            <FieldError
              id="act_name_override-error"
              message={state.errors?.act_name_override}
            />
            <PrefillHelp field={prefill.actName} />
            <p className="mt-1 text-xs text-slate-400">
              Si queda vacío, se usa el nombre guardado del machote.
            </p>
          </div>

          <div>
            <label htmlFor="protocol_book" className={labelClass}>
              Tomo
            </label>
            <input
              id="protocol_book"
              name="protocol_book"
              type="text"
              value={protocolBook}
              onChange={(event) => setProtocolBook(event.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.protocol_book}
              aria-describedby={
                state.errors?.protocol_book ? "protocol_book-error" : undefined
              }
            />
            <FieldError
              id="protocol_book-error"
              message={state.errors?.protocol_book}
            />
            <PrefillHelp field={prefill.protocolBook} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label htmlFor="initial_folio" className={labelClass}>
                Folio inicial
              </label>
              <input
                id="initial_folio"
                name="initial_folio"
                type="text"
                value={initialFolio}
                onChange={(event) => {
                  const next = event.target.value;
                  if (finalFolio === "" || finalFolio === initialFolio) {
                    setFinalFolio(next);
                  }
                  setInitialFolio(next);
                }}
                className={inputClass}
                aria-invalid={!!state.errors?.initial_folio}
                aria-describedby={
                  state.errors?.initial_folio ? "initial_folio-error" : undefined
                }
              />
              <FieldError
                id="initial_folio-error"
                message={state.errors?.initial_folio}
              />
              <PrefillHelp field={prefill.initialFolio} />
            </div>
            <div>
              <label htmlFor="final_folio" className={labelClass}>
                Folio final
              </label>
              <input
                id="final_folio"
                name="final_folio"
                type="text"
                value={finalFolio}
                onChange={(event) => setFinalFolio(event.target.value)}
                className={inputClass}
                aria-invalid={!!state.errors?.final_folio}
                aria-describedby={
                  state.errors?.final_folio ? "final_folio-error" : undefined
                }
              />
              <FieldError
                id="final_folio-error"
                message={state.errors?.final_folio}
              />
              <PrefillHelp field={prefill.finalFolio} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="parties_override" className={labelClass}>
              Partes
            </label>
            <textarea
              id="parties_override"
              name="parties_override"
              rows={3}
              value={parties}
              onChange={(event) => setParties(event.target.value)}
              placeholder={
                metadata?.generated_parties ??
                generatedPartiesPreview ??
                "Se generará desde la configuración del machote"
              }
              className={inputClass + " resize-y"}
              aria-invalid={!!state.errors?.parties_override}
              aria-describedby={
                state.errors?.parties_override
                  ? "parties_override-error"
                  : undefined
              }
            />
            <FieldError
              id="parties_override-error"
              message={state.errors?.parties_override}
            />
            <PrefillHelp field={prefill.parties} />
            <p className="mt-1 text-xs text-slate-400">
              Una corrección manual tiene prioridad sobre el valor generado.
            </p>
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
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-xs text-slate-400">
              Uso interno; no se incluyen en la exportación del índice.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {canResetParties && metadata && (
            <button
              type="submit"
              name="intent"
              value="reset-parties"
              disabled={pending}
              onClick={(event) => {
                if (
                  metadata.parties_override &&
                  !window.confirm(
                    "Se reemplazará la corrección manual de Partes con el valor actual del machote. ¿Deseas continuar?",
                  )
                ) {
                  event.preventDefault();
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Restablecer desde el machote
            </button>
          )}
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Guardando…" : "Guardar datos del índice"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PrefillHelp({ field }: { field: NotarialPrefillField }) {
  if (!field.rawValue) {
    if (field.source !== "template") return null;
    return (
      <p className="mt-1 text-xs text-slate-500">
        El valor fue precargado desde el machote. Revísalo antes de preparar el
        índice.
      </p>
    );
  }

  if (!field.compatible) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-medium">
          No pudimos interpretar este valor para el Índice Notarial.
        </p>
        <p className="mt-1">Original: “{field.rawValue}”</p>
        <p>Estado: Requiere revisión y corrección manual.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <p>Original: “{field.rawValue}”</p>
      <p>Interpretado: {field.value}</p>
      <p>
        Estado: Listo{field.source === "saved" ? " · corrección guardada" : ""}
      </p>
    </div>
  );
}

function AuthorizedAtPrefillHelp({
  field,
}: {
  field: NotarialAuthorizedAtPrefill;
}) {
  const rawValue = [field.rawDate, field.rawTime].filter(Boolean).join(" / ");
  if (field.optionBlockName) {
    return (
      <div
        className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
          field.compatible
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <p>Fuente: Bloque de opciones · {field.optionBlockName}</p>
        {field.optionVariantLabel && (
          <p>Variante: {field.optionVariantLabel}</p>
        )}
        {rawValue && <p>Original: “{rawValue}”</p>}
        {field.compatible ? (
          <>
            <p>Interpretado: {field.value}</p>
            <p>
              Estado: Listo
              {field.source === "saved" ? " · corrección guardada" : ""}
            </p>
          </>
        ) : (
          <p>Estado: Requiere revisión y corrección manual.</p>
        )}
      </div>
    );
  }
  return <PrefillHelp field={{ ...field, rawValue: rawValue || undefined }} />;
}
