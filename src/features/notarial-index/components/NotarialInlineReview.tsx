"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/Toast";
import { FieldError } from "@/components/forms/FieldError";
import { useUnsavedChanges } from "@/components/navigation/NavigationGuard";
import { matchesPersistedNotarialSnapshot } from "../model/confirmation-snapshot";
import { isoToCostaRicaLocal } from "../model/datetime";
import {
  canConfirmNotarialIndex,
  isNotarialComplete,
  notarialConfirmationState,
  notarialMissingFields,
  NOTARIAL_CONFIRMATION_STATE_LABEL,
  type NotarialMetadata,
} from "../model/notarial";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import {
  confirmNotarialMetadataAction,
  startNotarialCorrectionAction,
} from "../server/confirmation-actions";
import {
  getNotarialInlineDetailAction,
  type NotarialInlineDetailResult,
} from "../server/inline-detail-actions";
import {
  saveNotarialMetadataAction,
} from "../server/metadata-actions";
import type { NotarialMetadataState } from "../model/action-state";
import { notarialNextStep } from "../model/next-step";

const INLINE_PRIMARY_BUTTON =
  "rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";
const initialActionState: NotarialMetadataState = {};

type Props = {
  row: NotarialIndexRow;
  canManage: boolean;
  onDirtyChange: (documentId: string, dirty: boolean) => void;
};

function detailInitialState(): NotarialInlineDetailResult | null {
  return null;
}

export function NotarialInlineReview({ row, canManage, onDirtyChange }: Props) {
  const [detail, setDetail] = useState(detailInitialState);

  useEffect(() => {
    let active = true;
    getNotarialInlineDetailAction(row.document_id).then((result) => {
      if (active) setDetail(result);
    });
    return () => {
      active = false;
    };
  }, [row.document_id]);

  if (detail === null) {
    return (
      <div role="status" className="bg-slate-50/60 px-5 py-6 text-sm text-slate-600">
        Cargando revisión…
      </div>
    );
  }

  if (!detail.success) {
    return (
      <div role="alert" className="bg-red-50 px-5 py-6 text-sm text-red-700">
        {detail.message}
      </div>
    );
  }

  return (
    <NotarialInlineReviewForm
      key={`${row.document_id}:${detail.metadata?.version ?? 0}`}
      row={row}
      metadata={detail.metadata}
      canManage={canManage}
      onDirtyChange={onDirtyChange}
    />
  );
}

type FormProps = Props & { metadata: NotarialMetadata | null };

function NotarialInlineReviewForm({
  row,
  metadata,
  canManage,
  onDirtyChange,
}: FormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const action = saveNotarialMetadataAction.bind(null, row.document_id);
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  const [instrument, setInstrument] = useState(
    metadata?.instrument_number
      ? String(metadata.instrument_number)
      : row.instrument_number
        ? String(row.instrument_number)
        : "",
  );
  const [authorizedAt, setAuthorizedAt] = useState(
    isoToCostaRicaLocal(metadata?.authorized_at ?? row.authorized_at),
  );
  const [protocolBook, setProtocolBook] = useState(
    metadata?.protocol_book ?? row.protocol_book ?? "",
  );
  const [initialFolio, setInitialFolio] = useState(
    metadata?.initial_folio ?? row.initial_folio ?? "",
  );
  const [finalFolio, setFinalFolio] = useState(
    metadata?.final_folio ?? row.final_folio ?? "",
  );
  const [actName, setActName] = useState(
    metadata?.act_name_override ?? row.act_name ?? "",
  );
  const [parties, setParties] = useState(
    metadata?.parties_override ?? row.parties ?? "",
  );
  const [notes, setNotes] = useState(metadata?.notes ?? "");
  const [confirmedAt, setConfirmedAt] = useState(
    metadata?.notarial_confirmed_at ?? row.notarial_confirmed_at,
  );
  const [reviewRequired, setReviewRequired] = useState(
    metadata?.notarial_review_required ?? row.notarial_review_required,
  );
  const [version, setVersion] = useState(metadata?.version ?? row.version ?? 1);
  const [confirmationDialog, setConfirmationDialog] = useState<
    "confirm" | "correct" | null
  >(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  const visible = {
    instrument_number: instrument === "" ? null : Number(instrument),
    authorized_at: authorizedAt,
    protocol_book: protocolBook,
    initial_folio: initialFolio,
    final_folio: finalFolio,
    act_name_override: actName,
    act_name_snapshot: metadata?.act_name_snapshot ?? row.act_name,
    parties_override: parties,
    generated_parties: metadata?.generated_parties ?? row.parties,
    notes,
  };
  const [initialVisible] = useState(() => JSON.stringify(visible));
  const matchesPersisted = metadata
    ? matchesPersistedNotarialSnapshot(visible, metadata)
    : JSON.stringify(visible) === initialVisible;
  const dirty = !matchesPersisted;
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirtyChange(row.document_id, dirty);
    return () => onDirtyChange(row.document_id, false);
  }, [dirty, onDirtyChange, row.document_id]);

  const complete = isNotarialComplete(visible);
  const missingFields = notarialMissingFields(visible);
  const confirmationState = notarialConfirmationState(
    {
      notarial_confirmed_at: confirmedAt,
      notarial_review_required: reviewRequired,
    },
    complete,
  );
  const isConfirmed = confirmationState === "confirmed";
  const fieldsDisabled = !canManage || isConfirmed || pending || confirmationBusy;
  const canConfirmNow =
    canManage &&
    metadata !== null &&
    canConfirmNotarialIndex(confirmationState, complete);
  const canCorrectNow = canManage && isConfirmed;
  // Misma regla que la sección del Índice en la Escritura: una acción
  // principal por estado. Sin metadata guardada nunca se puede confirmar,
  // así que "nunca guardado" cuenta como cambios sin guardar.
  const nextStep = notarialNextStep({
    state: confirmationState,
    dirty: metadata === null || !matchesPersisted,
    complete,
    missingFields,
    canEdit: canManage,
    canConfirm: canManage,
  });

  const lastSuccess = useRef<NotarialMetadataState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      showToast(state.successMessage ?? "Cambios del índice guardados.");
      router.refresh();
    }
  }, [router, showToast, state]);

  async function handleConfirm() {
    if (!canConfirmNow || dirty || pending || confirmationBusy) return;
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await confirmNotarialMetadataAction(row.document_id, version);
    setConfirmationBusy(false);
    if (result.success) {
      setConfirmedAt(new Date().toISOString());
      setReviewRequired(false);
      if (result.version) setVersion(result.version);
      showToast("Datos del Índice confirmados.");
      router.refresh();
      return;
    }
    setConfirmationError(
      result.message ?? "No fue posible confirmar los datos del índice.",
    );
  }

  async function handleCorrection() {
    if (!canCorrectNow || confirmationBusy) return;
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await startNotarialCorrectionAction(row.document_id, version);
    setConfirmationBusy(false);
    if (result.success) {
      setConfirmedAt(null);
      setReviewRequired(true);
      if (result.version) setVersion(result.version);
      showToast("Corrección de datos del Índice iniciada.");
      router.refresh();
      return;
    }
    setConfirmationError(
      result.message ?? "No fue posible iniciar la corrección.",
    );
  }

  const badgeClass =
    confirmationState === "confirmed"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
      : confirmationState === "review_required"
        ? "border border-amber-300 bg-amber-50 text-amber-800"
        : confirmationState === "ready_to_confirm"
          ? "border border-accent-200 bg-accent-50 text-accent-700"
          : "bg-slate-100 text-slate-500";

  return (
    <section
      aria-label={`Revisión de ${row.title}`}
      className="space-y-4 bg-slate-50/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {NOTARIAL_CONFIRMATION_STATE_LABEL[confirmationState]}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/documents/${row.document_id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1"
          >
            Ver escritura
          </Link>
        </div>
      </div>

      <p
        className={`text-xs ${
          confirmationState === "review_required" || !complete
            ? "text-amber-800"
            : "text-slate-600"
        }`}
      >
        {nextStep.guidance}
      </p>
      {!canManage && (
        <p role="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Tu rol permite revisar estos datos, pero no modificarlos.
        </p>
      )}
      {confirmationError && (
        <p role="alert" className="text-xs text-red-700">
          {confirmationError}
        </p>
      )}

      <form action={formAction} noValidate>
        {state.message && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.message}
          </p>
        )}
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="instrument_number_derived_snapshot" value={metadata?.instrument_number_derived_snapshot ?? ""} />
        <input type="hidden" name="authorized_date_derived_snapshot" value={metadata?.authorized_date_derived_snapshot ?? ""} />
        <input type="hidden" name="authorized_time_derived_snapshot" value={metadata?.authorized_time_derived_snapshot ?? ""} />
        <input type="hidden" name="protocol_book_derived_snapshot" value={metadata?.protocol_book_derived_snapshot ?? ""} />
        <input type="hidden" name="initial_folio_derived_snapshot" value={metadata?.initial_folio_derived_snapshot ?? ""} />
        <input type="hidden" name="final_folio_derived_snapshot" value={metadata?.final_folio_derived_snapshot ?? ""} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InlineField label="Número de instrumento" id={`inline-instrument-${row.document_id}`} error={state.errors?.instrument_number}>
            <input id={`inline-instrument-${row.document_id}`} name="instrument_number" type="number" min={1} step={1} disabled={fieldsDisabled} value={instrument} onChange={(event) => setInstrument(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.instrument_number} aria-describedby={state.errors?.instrument_number ? `inline-instrument-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Fecha y hora de autorización" id={`inline-authorized-${row.document_id}`} error={state.errors?.authorized_at}>
            <input id={`inline-authorized-${row.document_id}`} name="authorized_at" type="datetime-local" disabled={fieldsDisabled} value={authorizedAt} onChange={(event) => setAuthorizedAt(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.authorized_at} aria-describedby={state.errors?.authorized_at ? `inline-authorized-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Tomo" id={`inline-protocol-${row.document_id}`} error={state.errors?.protocol_book}>
            <input id={`inline-protocol-${row.document_id}`} name="protocol_book" disabled={fieldsDisabled} value={protocolBook} onChange={(event) => setProtocolBook(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.protocol_book} aria-describedby={state.errors?.protocol_book ? `inline-protocol-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Folio inicial" id={`inline-initial-folio-${row.document_id}`} error={state.errors?.initial_folio}>
            <input id={`inline-initial-folio-${row.document_id}`} name="initial_folio" disabled={fieldsDisabled} value={initialFolio} onChange={(event) => setInitialFolio(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.initial_folio} aria-describedby={state.errors?.initial_folio ? `inline-initial-folio-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Folio final" id={`inline-final-folio-${row.document_id}`} error={state.errors?.final_folio}>
            <input id={`inline-final-folio-${row.document_id}`} name="final_folio" disabled={fieldsDisabled} value={finalFolio} onChange={(event) => setFinalFolio(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.final_folio} aria-describedby={state.errors?.final_folio ? `inline-final-folio-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Acto o contrato" id={`inline-act-${row.document_id}`} error={state.errors?.act_name_override}>
            <input id={`inline-act-${row.document_id}`} name="act_name_override" disabled={fieldsDisabled} value={actName} onChange={(event) => setActName(event.target.value)} className={inputClass} aria-invalid={!!state.errors?.act_name_override} aria-describedby={state.errors?.act_name_override ? `inline-act-${row.document_id}-error` : undefined} />
          </InlineField>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <InlineField label="Partes / comparecientes" id={`inline-parties-${row.document_id}`} error={state.errors?.parties_override}>
            <textarea id={`inline-parties-${row.document_id}`} name="parties_override" rows={3} disabled={fieldsDisabled} value={parties} onChange={(event) => setParties(event.target.value)} className={`${inputClass} resize-y`} aria-invalid={!!state.errors?.parties_override} aria-describedby={state.errors?.parties_override ? `inline-parties-${row.document_id}-error` : undefined} />
          </InlineField>
          <InlineField label="Notas internas (opcional)" id={`inline-notes-${row.document_id}`} error={state.errors?.notes}>
            <textarea id={`inline-notes-${row.document_id}`} name="notes" rows={3} disabled={fieldsDisabled} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} resize-y`} aria-invalid={!!state.errors?.notes} aria-describedby={state.errors?.notes ? `inline-notes-${row.document_id}-error` : undefined} />
          </InlineField>
        </div>

        {nextStep.primary && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {nextStep.primary === "save" && (
              <button type="submit" name="intent" value="save" disabled={pending || confirmationBusy} className={INLINE_PRIMARY_BUTTON}>
                {pending ? "Guardando…" : "Guardar datos"}
              </button>
            )}
            {nextStep.primary === "confirm" && canConfirmNow && (
              <button type="button" disabled={confirmationBusy || pending} onClick={() => setConfirmationDialog("confirm")} className={INLINE_PRIMARY_BUTTON}>
                Confirmar datos
              </button>
            )}
            {nextStep.primary === "correct" && canCorrectNow && (
              <button type="button" disabled={confirmationBusy} onClick={() => setConfirmationDialog("correct")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50">
                Corregir datos
              </button>
            )}
          </div>
        )}
      </form>

      {confirmationDialog === "confirm" && (
        <ConfirmDialog title="¿Confirmar datos del Índice?" description="Confirma que revisaste la información visible. Después quedará bloqueada para edición normal." confirmLabel="Confirmar datos" pending={confirmationBusy || dirty} onConfirm={handleConfirm} onClose={() => setConfirmationDialog(null)} />
      )}
      {confirmationDialog === "correct" && (
        <ConfirmDialog title="¿Corregir datos del Índice?" description="Las modificaciones quedarán registradas y deberás confirmar los datos nuevamente." confirmLabel="Corregir datos" tone="danger" pending={confirmationBusy} onConfirm={handleCorrection} onClose={() => setConfirmationDialog(null)} />
      )}
    </section>
  );
}

function InlineField({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
