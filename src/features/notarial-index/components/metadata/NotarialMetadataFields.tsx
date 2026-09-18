"use client";

import { FieldError } from "@/components/forms/FieldError";
import type { NotarialMetadata } from "../../model/notarial";
import type {
  NotarialAuthorizedAtPrefill,
  NotarialMetadataPrefill,
  NotarialPrefillField,
} from "../../model/prefill";
import type { NotarialMetadataState } from "../../model/action-state";
import { CollapsibleFieldRow } from "../CollapsibleFieldRow";
import type { NotarialMetadataDraft } from "./useNotarialMetadataDraft";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

export type NotarialMetadataRowId =
  | "instrument_number"
  | "authorized_at"
  | "act_name_override"
  | "protocol_book"
  | "folios"
  | "parties_override"
  | "notes";

type Props = {
  openRowId: NotarialMetadataRowId | null;
  onToggle: (id: NotarialMetadataRowId) => void;
  fieldsDisabled: boolean;
  errors: NotarialMetadataState["errors"];
  metadata: NotarialMetadata | null;
  prefill: NotarialMetadataPrefill;
  actNamePreview: string | null;
  draft: NotarialMetadataDraft;
  canEdit: boolean;
  isConfirmed: boolean;
  canResetParties: boolean;
  pending: boolean;
};

export function NotarialMetadataFields({
  openRowId,
  onToggle,
  fieldsDisabled,
  errors,
  metadata,
  prefill,
  actNamePreview,
  draft,
  canEdit,
  isConfirmed,
  canResetParties,
  pending,
}: Props) {
  const {
    values: {
      instrument,
      authorizedDate,
      authorizedTime,
      actName,
      protocolBook,
      initialFolio,
      finalFolio,
      parties,
      notes,
    },
    setters: {
      setInstrument,
      setAuthorizedDate,
      setAuthorizedTime,
      setActName,
      setProtocolBook,
      setInitialFolio,
      setFinalFolio,
      setParties,
      setNotes,
    },
    authorizedAt,
    partiesFallback,
    status: {
      instrumentConfigured,
      authorizedAtConfigured,
      actNameConfigured,
      protocolBookConfigured,
      foliosConfigured,
      partiesConfigured,
    },
  } = draft;

  return (
    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      <CollapsibleFieldRow
        id="notarial-instrument"
        name="Número de instrumento"
        meta={instrument || "Sin configurar"}
        status={instrumentConfigured ? "configured" : "pending"}
        open={openRowId === "instrument_number"}
        onToggle={() => onToggle("instrument_number")}
      >
        <label htmlFor="instrument_number" className={labelClass}>
          Número de instrumento
        </label>
        <input
          id="instrument_number"
          type="number"
          min={1}
          step={1}
          disabled={fieldsDisabled}
          value={instrument}
          onChange={(event) => setInstrument(event.target.value)}
          className={inputClass}
          aria-invalid={!!errors?.instrument_number}
          aria-describedby={errors?.instrument_number ? "instrument_number-error" : undefined}
        />
        <FieldError id="instrument_number-error" message={errors?.instrument_number} />
        <PrefillHelp field={prefill.instrumentNumber} onUseSuggestion={setInstrument} />
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-authorized-at"
        name="Fecha y hora de autorización"
        meta={
          authorizedAt
            ? formatNotarialDateTime(authorizedAt)
            : authorizedDate
              ? `${authorizedDate} · hora pendiente`
              : authorizedTime
                ? `${authorizedTime} · fecha pendiente`
                : "Fecha de autorización pendiente"
        }
        status={authorizedAtConfigured ? "configured" : "pending"}
        open={openRowId === "authorized_at"}
        onToggle={() => onToggle("authorized_at")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="authorized_date" className={labelClass}>
              Fecha de autorización
            </label>
            <input
              id="authorized_date"
              type="date"
              disabled={fieldsDisabled}
              value={authorizedDate}
              onChange={(event) => setAuthorizedDate(event.target.value)}
              className={inputClass}
              aria-invalid={!!errors?.authorized_at}
            />
            <PrefillHelp field={prefill.authorizedAt.date} />
          </div>
          <div>
            <label htmlFor="authorized_time" className={labelClass}>
              Hora de autorización
            </label>
            <input
              id="authorized_time"
              type="time"
              disabled={fieldsDisabled}
              value={authorizedTime}
              onChange={(event) => setAuthorizedTime(event.target.value)}
              className={inputClass}
              aria-invalid={!!errors?.authorized_at}
              aria-describedby={errors?.authorized_at ? "authorized_at-error" : undefined}
            />
            {prefill.authorizedAt.optionBlockName ? (
              <AuthorizedAtPrefillHelp field={prefill.authorizedAt} />
            ) : (
              <PrefillHelp field={prefill.authorizedAt.time} />
            )}
          </div>
        </div>
        <FieldError id="authorized_at-error" message={errors?.authorized_at} />
        <p className="mt-1 text-xs text-slate-400">Hora de Costa Rica.</p>
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-act-name"
        name="Acto o contrato"
        meta={actName || metadata?.act_name_snapshot || actNamePreview || "Sin configurar"}
        status={actNameConfigured ? "configured" : "pending"}
        open={openRowId === "act_name_override"}
        onToggle={() => onToggle("act_name_override")}
      >
        <label htmlFor="act_name_override" className={labelClass}>
          Acto o contrato
        </label>
        <input
          id="act_name_override"
          type="text"
          disabled={fieldsDisabled}
          value={actName}
          onChange={(event) => setActName(event.target.value)}
          className={inputClass}
          placeholder={metadata?.act_name_snapshot ?? "Nombre del machote"}
          aria-invalid={!!errors?.act_name_override}
          aria-describedby={errors?.act_name_override ? "act_name_override-error" : undefined}
        />
        <FieldError id="act_name_override-error" message={errors?.act_name_override} />
        <PrefillHelp field={prefill.actName} />
        <p className="mt-1 text-xs text-slate-400">
          Si queda vacío, se usa el nombre guardado del machote.
        </p>
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-protocol-book"
        name="Tomo"
        meta={protocolBook || "Sin configurar"}
        status={protocolBookConfigured ? "configured" : "pending"}
        open={openRowId === "protocol_book"}
        onToggle={() => onToggle("protocol_book")}
      >
        <label htmlFor="protocol_book" className={labelClass}>Tomo</label>
        <input
          id="protocol_book"
          type="text"
          disabled={fieldsDisabled}
          value={protocolBook}
          onChange={(event) => setProtocolBook(event.target.value)}
          className={inputClass}
          aria-invalid={!!errors?.protocol_book}
          aria-describedby={errors?.protocol_book ? "protocol_book-error" : undefined}
        />
        <FieldError id="protocol_book-error" message={errors?.protocol_book} />
        <PrefillHelp field={prefill.protocolBook} onUseSuggestion={setProtocolBook} />
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-folios"
        name="Folios"
        meta={foliosConfigured ? `${initialFolio} – ${finalFolio}` : "Sin configurar"}
        status={foliosConfigured ? "configured" : "pending"}
        open={openRowId === "folios"}
        onToggle={() => onToggle("folios")}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="initial_folio" className={labelClass}>Folio inicial</label>
            <input
              id="initial_folio"
              type="text"
              disabled={fieldsDisabled}
              value={initialFolio}
              onChange={(event) => {
                const next = event.target.value;
                if (finalFolio === "" || finalFolio === initialFolio) setFinalFolio(next);
                setInitialFolio(next);
              }}
              className={inputClass}
              aria-invalid={!!errors?.initial_folio}
              aria-describedby={errors?.initial_folio ? "initial_folio-error" : undefined}
            />
            <FieldError id="initial_folio-error" message={errors?.initial_folio} />
            <PrefillHelp field={prefill.initialFolio} onUseSuggestion={setInitialFolio} />
          </div>
          <div>
            <label htmlFor="final_folio" className={labelClass}>Folio final</label>
            <input
              id="final_folio"
              type="text"
              disabled={fieldsDisabled}
              value={finalFolio}
              onChange={(event) => setFinalFolio(event.target.value)}
              className={inputClass}
              aria-invalid={!!errors?.final_folio}
              aria-describedby={errors?.final_folio ? "final_folio-error" : undefined}
            />
            <FieldError id="final_folio-error" message={errors?.final_folio} />
            <PrefillHelp field={prefill.finalFolio} onUseSuggestion={setFinalFolio} />
          </div>
        </div>
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-parties"
        name="Partes"
        meta={parties.trim() !== "" ? "Corrección manual" : partiesFallback ? "Generado desde el machote" : "Sin configurar"}
        status={partiesConfigured ? "configured" : "pending"}
        open={openRowId === "parties_override"}
        onToggle={() => onToggle("parties_override")}
      >
        <label htmlFor="parties_override" className={labelClass}>Partes</label>
        <textarea
          id="parties_override"
          rows={3}
          disabled={fieldsDisabled}
          value={parties}
          onChange={(event) => setParties(event.target.value)}
          placeholder={partiesFallback ?? "Se generará desde la configuración del machote"}
          className={inputClass + " resize-y"}
          aria-invalid={!!errors?.parties_override}
          aria-describedby={errors?.parties_override ? "parties_override-error" : undefined}
        />
        <FieldError id="parties_override-error" message={errors?.parties_override} />
        <PrefillHelp field={prefill.parties} />
        <p className="mt-1 text-xs text-slate-400">
          Una corrección manual tiene prioridad sobre el valor generado.
        </p>
        {canEdit && !isConfirmed && canResetParties && metadata && (
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
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Restablecer desde el machote
          </button>
        )}
      </CollapsibleFieldRow>

      <CollapsibleFieldRow
        id="notarial-notes"
        name="Notas internas"
        meta="Opcional"
        status="optional"
        open={openRowId === "notes"}
        onToggle={() => onToggle("notes")}
      >
        <label htmlFor="notes" className={labelClass}>
          Notas internas <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="notes"
          rows={2}
          disabled={fieldsDisabled}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClass + " resize-y"}
        />
        <p className="mt-1 text-xs text-slate-400">
          Uso interno; no se incluyen en la exportación del índice.
        </p>
      </CollapsibleFieldRow>
    </div>
  );
}

export function formatNotarialDateTime(value: string): string {
  return value.replace("T", " ");
}

function PrefillHelp({
  field,
  onUseSuggestion,
}: {
  field: NotarialPrefillField;
  onUseSuggestion?: (value: string) => void;
}) {
  const sourceChangedNotice = field.sourceChanged ? (
    <p className="mt-1 text-xs text-amber-700">
      La fuente cambió desde la última corrección manual — revisa si este valor sigue siendo correcto.
    </p>
  ) : null;

  if (!field.rawValue) {
    if (field.source === "suggestion" && field.value) {
      return (
        <p className="mt-1 text-xs text-slate-500">
          Sugerencia: {field.value}.{" "}
          {onUseSuggestion ? (
            <button
              type="button"
              onClick={() => onUseSuggestion(field.value)}
              className="font-medium text-accent-700 hover:underline focus:outline-none focus:underline"
            >
              Usar este valor
            </button>
          ) : (
            "Escríbelo si aplica."
          )}{" "}
          No se guarda hasta que lo confirmes.
        </p>
      );
    }
    if (field.source === "saved") return sourceChangedNotice;
    if (field.source !== "template") return null;
    return (
      <p className="mt-1 text-xs text-slate-500">
        El valor fue precargado desde el machote. Revísalo antes de preparar el índice.
      </p>
    );
  }

  if (!field.compatible) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-medium">No pudimos interpretar este valor para el Índice Notarial.</p>
        <p className="mt-1">Original: “{field.rawValue}”</p>
        <p>Estado: Requiere revisión y corrección manual.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {sourceChangedNotice}
      <p>Original: “{field.rawValue}”</p>
      <p>Interpretado: {field.value}</p>
      <p>Estado: Listo{field.source === "saved" ? " · corrección guardada" : ""}</p>
    </div>
  );
}

function AuthorizedAtPrefillHelp({ field }: { field: NotarialAuthorizedAtPrefill }) {
  const { time, optionBlockName, optionVariantLabel } = field;
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
        time.compatible
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <p>Fuente: Bloque de opciones · {optionBlockName}</p>
      {optionVariantLabel && <p>Variante: {optionVariantLabel}</p>}
      {time.rawValue && <p>Original: “{time.rawValue}”</p>}
      {time.compatible ? (
        <>
          <p>Interpretado: {time.value}</p>
          <p>
            Estado: Listo
            {time.source === "saved" ? " · corrección guardada" : ""}
            {time.sourceChanged ? " · la fuente cambió, revisa el valor" : ""}
          </p>
        </>
      ) : (
        <p>Estado: Requiere revisión y corrección manual.</p>
      )}
    </div>
  );
}
