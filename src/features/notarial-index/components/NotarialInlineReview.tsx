"use client";

/**
 * Revisión/corrección rápida de un registro del Índice sin salir de la
 * tabla. Es OTRA UI sobre la misma lógica del formulario completo de la
 * Escritura (`NotarialMetadataSection`) — mismas server actions
 * (`saveNotarialMetadataAction`, `confirmNotarialMetadataAction`,
 * `startNotarialCorrectionAction`), mismas funciones de derivación/
 * precedencia (`../model/notarial`), sin reimplementar nada de eso aquí.
 *
 * A propósito NO reutiliza `NotarialMetadataSection` completo: esa vista
 * también resuelve sugerencias de precarga desde el contenido de la
 * Escritura y sus Option Blocks (`prefill`, fuera de alcance de este PR —
 * ver docs de la Iteración 2), lo que obligaría a cargar ese contexto
 * completo por fila en el listado. La expansión inline es deliberadamente
 * el subconjunto "corrección rápida" (edita los valores guardados
 * directamente, sin sugerencias); el trabajo con sugerencias sigue en
 * "Ver escritura".
 *
 * El listado (`NOTARIAL_INDEX_SELECT`) ya trae instrument_number/
 * authorized_at/protocol_book/initial_folio/final_folio — solo
 * act_name_override/parties_override/notes (valores RAW, no los ya
 * resueltos que muestra la tabla) se piden bajo demanda al expandir, vía
 * `getNotarialRowDetailAction` (server action, RLS de por medio).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveNotarialMetadataAction, type NotarialMetadataState } from "../server/metadata-actions";
import {
  confirmNotarialMetadataAction,
  startNotarialCorrectionAction,
} from "../server/confirmation-actions";
import { getNotarialRowDetailAction, type NotarialRowDetail } from "../server/detail-actions";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import {
  canConfirmNotarialIndex,
  isNotarialComplete,
  joinMissingFieldLabels,
  notarialConfirmationState,
  notarialMissingFields,
  NOTARIAL_CONFIRMATION_STATE_LABEL,
} from "../model/notarial";
import { isoToCostaRicaLocal } from "../model/datetime";
import { FieldError } from "@/components/forms/FieldError";
import { useToast } from "@/components/feedback/Toast";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

const initialState: NotarialMetadataState = {};

type Props = {
  row: NotarialIndexRow;
  /** notarial_index.generate — mismo permiso que ya gobierna esta pantalla
   * (guardar/confirmar/corregir); sin él, todo se ve pero de solo lectura. */
  canManage: boolean;
};

export function NotarialInlineReview({ row, canManage }: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<NotarialRowDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    // Cada fila expandida monta una instancia nueva de este componente (solo
    // una expandida a la vez, ver NotarialIndexTable) — no hace falta
    // reaccionar a un cambio de `row.document_id` dentro de la misma
    // instancia, solo pedir el detalle una vez al montar.
    let cancelled = false;
    getNotarialRowDetailAction(row.document_id).then((result) => {
      if (cancelled) return;
      if (result.success) setDetail(result.detail);
      else setDetailError(result.message);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const action = saveNotarialMetadataAction.bind(null, row.document_id);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [instrument, setInstrument] = useState(
    row.instrument_number ? String(row.instrument_number) : "",
  );
  const [authorizedAt, setAuthorizedAt] = useState(
    isoToCostaRicaLocal(row.authorized_at),
  );
  const [protocolBook, setProtocolBook] = useState(row.protocol_book ?? "");
  const [initialFolio, setInitialFolio] = useState(row.initial_folio ?? "");
  const [finalFolio, setFinalFolio] = useState(row.final_folio ?? "");
  const [actName, setActName] = useState("");
  const [parties, setParties] = useState("");
  const [notes, setNotes] = useState("");

  // Los campos que dependen del detalle bajo demanda arrancan vacíos y se
  // rellenan una vez que llega — un solo efecto, no en cada render.
  const hydratedDetailRef = useRef(false);
  useEffect(() => {
    if (!detail || hydratedDetailRef.current) return;
    hydratedDetailRef.current = true;
    setActName(detail.act_name_override ?? "");
    setParties(detail.parties_override ?? "");
    setNotes(detail.notes ?? "");
  }, [detail]);

  // Comparación durante el render (no un efecto) para el reset derivado de
  // `state.resetParties` — mismo patrón que `NotarialMetadataSection` para
  // no repetir el lint de "setState síncrono dentro de un efecto".
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.resetParties) setParties("");
  }

  const lastSuccessState = useRef<NotarialMetadataState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast(state.successMessage ?? "Cambios del índice guardados.");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const version = row.version ?? 1;
  const liveMetadata = {
    instrument_number: instrument === "" ? null : Number(instrument),
    authorized_at: authorizedAt || null,
    protocol_book: protocolBook,
    initial_folio: initialFolio,
    final_folio: finalFolio,
    act_name_override: actName,
    act_name_snapshot: detail?.act_name_snapshot ?? null,
    parties_override: parties,
    generated_parties: detail?.generated_parties ?? null,
  };
  const complete = isNotarialComplete(liveMetadata);
  const missingFields = notarialMissingFields(liveMetadata);
  const confirmationState = notarialConfirmationState(
    {
      notarial_confirmed_at: row.notarial_confirmed_at,
      notarial_review_required: row.notarial_review_required,
    },
    complete,
  );
  const isConfirmed = confirmationState === "confirmed";
  const fieldsDisabled = !canManage || isConfirmed || detail === null;
  const canConfirmNow = canManage && canConfirmNotarialIndex(confirmationState, complete);
  const canCorrectNow = canManage && isConfirmed;

  // ------------------------------------------------------- confirmación
  const [confirmationDialog, setConfirmationDialog] = useState<"confirm" | "correct" | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  async function handleConfirm() {
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await confirmNotarialMetadataAction(row.document_id, version);
    setConfirmationBusy(false);
    if (result.success) {
      showToast("Datos del Índice confirmados.");
      router.refresh();
    } else {
      setConfirmationError(result.message ?? "No fue posible confirmar los datos del índice.");
    }
  }

  async function handleStartCorrection() {
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await startNotarialCorrectionAction(row.document_id, version);
    setConfirmationBusy(false);
    if (result.success) {
      showToast("Corrección de datos del Índice iniciada.");
      router.refresh();
    } else {
      setConfirmationError(result.message ?? "No fue posible iniciar la corrección.");
    }
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
    <div className="space-y-4 bg-slate-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {NOTARIAL_CONFIRMATION_STATE_LABEL[confirmationState]}
        </span>
        <div className="flex items-center gap-2">
          {canConfirmNow && (
            <button
              type="button"
              disabled={confirmationBusy}
              onClick={() => setConfirmationDialog("confirm")}
              className="rounded-lg bg-accent-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 disabled:opacity-50"
            >
              Confirmar datos
            </button>
          )}
          {canCorrectNow && (
            <button
              type="button"
              disabled={confirmationBusy}
              onClick={() => setConfirmationDialog("correct")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 disabled:opacity-50"
            >
              Corregir datos
            </button>
          )}
          <Link
            href={`/dashboard/documents/${row.document_id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1"
          >
            Ver escritura
          </Link>
        </div>
      </div>

      {confirmationError && (
        <p role="alert" className="text-xs text-red-700">
          {confirmationError}
        </p>
      )}

      {!complete && (
        <p className="text-xs text-amber-800">
          Faltan: {joinMissingFieldLabels(missingFields)}.
        </p>
      )}

      {canManage && isConfirmed && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Estos datos están confirmados y de solo lectura. Usa “Corregir datos” para editarlos.
        </p>
      )}
      {!canManage && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Tu rol no permite editar los datos del índice. Los ves en modo lectura.
        </p>
      )}

      {detailError && (
        <p role="alert" className="text-xs text-red-700">
          {detailError}
        </p>
      )}

      <form action={formAction} noValidate>
        {state.message && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {state.message}
          </div>
        )}

        <input type="hidden" name="version" value={version} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor={`inline-instrument-${row.document_id}`} className={labelClass}>
              Número de instrumento
            </label>
            <input
              id={`inline-instrument-${row.document_id}`}
              name="instrument_number"
              type="number"
              min={1}
              step={1}
              disabled={fieldsDisabled}
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.instrument_number}
            />
            <FieldError id={`inline-instrument-error-${row.document_id}`} message={state.errors?.instrument_number} />
          </div>

          <div>
            <label htmlFor={`inline-authorized-${row.document_id}`} className={labelClass}>
              Fecha y hora de autorización
            </label>
            <input
              id={`inline-authorized-${row.document_id}`}
              name="authorized_at"
              type="datetime-local"
              disabled={fieldsDisabled}
              value={authorizedAt}
              onChange={(e) => setAuthorizedAt(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.authorized_at}
            />
            <FieldError id={`inline-authorized-error-${row.document_id}`} message={state.errors?.authorized_at} />
          </div>

          <div>
            <label htmlFor={`inline-protocol-${row.document_id}`} className={labelClass}>
              Tomo
            </label>
            <input
              id={`inline-protocol-${row.document_id}`}
              name="protocol_book"
              type="text"
              disabled={fieldsDisabled}
              value={protocolBook}
              onChange={(e) => setProtocolBook(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.protocol_book}
            />
            <FieldError id={`inline-protocol-error-${row.document_id}`} message={state.errors?.protocol_book} />
          </div>

          <div>
            <label htmlFor={`inline-initial-folio-${row.document_id}`} className={labelClass}>
              Folio inicial
            </label>
            <input
              id={`inline-initial-folio-${row.document_id}`}
              name="initial_folio"
              type="text"
              disabled={fieldsDisabled}
              value={initialFolio}
              onChange={(e) => setInitialFolio(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.initial_folio}
            />
            <FieldError id={`inline-initial-folio-error-${row.document_id}`} message={state.errors?.initial_folio} />
          </div>

          <div>
            <label htmlFor={`inline-final-folio-${row.document_id}`} className={labelClass}>
              Folio final
            </label>
            <input
              id={`inline-final-folio-${row.document_id}`}
              name="final_folio"
              type="text"
              disabled={fieldsDisabled}
              value={finalFolio}
              onChange={(e) => setFinalFolio(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.final_folio}
            />
            <FieldError id={`inline-final-folio-error-${row.document_id}`} message={state.errors?.final_folio} />
          </div>

          <div>
            <label htmlFor={`inline-act-${row.document_id}`} className={labelClass}>
              Acto o contrato
            </label>
            <input
              id={`inline-act-${row.document_id}`}
              name="act_name_override"
              type="text"
              disabled={fieldsDisabled}
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              placeholder={detail?.act_name_snapshot ?? undefined}
              className={inputClass}
              aria-invalid={!!state.errors?.act_name_override}
            />
            <FieldError id={`inline-act-error-${row.document_id}`} message={state.errors?.act_name_override} />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor={`inline-parties-${row.document_id}`} className={labelClass}>
            Partes / comparecientes
          </label>
          <textarea
            id={`inline-parties-${row.document_id}`}
            name="parties_override"
            rows={2}
            disabled={fieldsDisabled}
            value={parties}
            onChange={(e) => setParties(e.target.value)}
            placeholder={detail?.generated_parties ?? "Se genera desde el machote"}
            className={`${inputClass} resize-y`}
            aria-invalid={!!state.errors?.parties_override}
          />
          <FieldError id={`inline-parties-error-${row.document_id}`} message={state.errors?.parties_override} />
          {canManage && !isConfirmed && detail && (
            <button
              type="submit"
              name="intent"
              value="reset-parties"
              disabled={pending}
              onClick={(event) => {
                if (
                  detail.parties_override &&
                  !window.confirm(
                    "Se reemplazará la corrección manual de Partes con el valor actual del machote. ¿Continuar?",
                  )
                ) {
                  event.preventDefault();
                }
              }}
              className="mt-1.5 text-xs font-medium text-accent-700 hover:underline focus:outline-none focus:underline"
            >
              Restablecer desde el machote
            </button>
          )}
        </div>

        <div className="mt-3">
          <label htmlFor={`inline-notes-${row.document_id}`} className={labelClass}>
            Notas internas <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id={`inline-notes-${row.document_id}`}
            name="notes"
            rows={2}
            disabled={fieldsDisabled}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </div>

        {canManage && !isConfirmed && (
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={pending || detail === null}
              className="rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Guardando…" : detail === null ? "Cargando…" : "Guardar"}
            </button>
          </div>
        )}
      </form>

      {confirmationDialog === "confirm" && (
        <ConfirmDialog
          title="¿Confirmar datos del Índice?"
          description="Confirma que revisaste la información utilizada para el Índice Notarial. Después de confirmar, los datos quedarán bloqueados para edición normal."
          confirmLabel="Confirmar datos"
          pending={confirmationBusy}
          onConfirm={handleConfirm}
          onClose={() => setConfirmationDialog(null)}
        />
      )}
      {confirmationDialog === "correct" && (
        <ConfirmDialog
          title="¿Corregir datos del Índice?"
          description="Estos datos ya habían sido confirmados. Las modificaciones quedarán registradas en el historial y deberás confirmarlos nuevamente al terminar."
          confirmLabel="Corregir datos"
          tone="danger"
          pending={confirmationBusy}
          onConfirm={handleStartCorrection}
          onClose={() => setConfirmationDialog(null)}
        />
      )}
    </div>
  );
}
