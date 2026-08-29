"use client";

/**
 * Sección "Datos para índice" del detalle de una Escritura: formulario de la
 * metadata notarial interna. La completitud se calcula sobre los campos
 * estructurados requeridos por el índice interno. Puede corregirse aun cuando
 * la Escritura esté finalizada, sin alterar el contenido de la Escritura.
 *
 * Reestructurado para "progressive disclosure" (mismos primitivos que
 * `TemplateIndexConfigurationSection` de Machotes): resumen configurado/
 * pendiente + filas compactas, una expandida a la vez. Los inputs reales
 * viven siempre montados fuera de la fila colapsable (mismo `<input>`, sin
 * duplicar `name`) — nunca dentro de `{open && children}`, para no repetir
 * el bug de FormData ya encontrado y corregido en Machotes.
 *
 * Ciclo de confirmación (20260818140000_notarial_index_confirmation_lifecycle):
 * Finalizar Escritura ≠ Guardar datos del Índice ≠ Confirmar datos del
 * Índice. Guardar nunca bloquea campos ni confirma; Confirmar es una acción
 * explícita aparte que sí bloquea edición normal hasta que alguien con
 * permiso pulse "Corregir datos". El estado se deriva (nunca se infiere
 * localmente): `notarialConfirmationState()` a partir de
 * `notarial_confirmed_at`/`notarial_review_required` (servidor) +
 * completitud en vivo (cliente).
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  saveNotarialMetadataAction,
  type NotarialMetadataState,
} from "../server/metadata-actions";
import {
  confirmNotarialMetadataAction,
  startNotarialCorrectionAction,
} from "../server/confirmation-actions";
import { setNotarialIndexInclusionAction } from "@/features/documents/server/lifecycle-actions";
import type { NotarialMetadata } from "../model/notarial";
import type {
  NotarialAuthorizedAtPrefill,
  NotarialMetadataPrefill,
  NotarialPrefillField,
} from "../model/prefill";
import {
  canConfirmNotarialIndex,
  isNotarialComplete,
  joinMissingFieldLabels,
  notarialConfirmationState,
  notarialMissingFields,
  NOTARIAL_CONFIRMATION_STATE_LABEL,
} from "../model/notarial";
import { FieldError } from "@/components/forms/FieldError";
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { CollapsibleFieldRow } from "./CollapsibleFieldRow";
import { useToast } from "@/components/feedback/Toast";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const inputClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

const initialState: NotarialMetadataState = {};

type RowId =
  | "instrument_number"
  | "authorized_at"
  | "act_name_override"
  | "protocol_book"
  | "folios"
  | "parties_override"
  | "notes";

/**
 * Mismo riesgo de estado local obsoleto que `inclusion`/`confirmedAt` (ver
 * comentarios en el cuerpo del componente): `NotarialMetadataSection` no se
 * desmonta al reabrir + corregir una fuente + volver a finalizar dentro de
 * la misma sesión, así que el `prefill` recalculado en el servidor llega
 * como prop actualizada sin que el `useState` de cada campo lo capture solo
 * — el input editable se queda mostrando el valor derivado de ANTES de la
 * corrección hasta un refresh completo de la página. Se resincroniza cada
 * campo cuando su valor de prefill cambia, pero solo si el valor local
 * seguía siendo exactamente el último sincronizado, para nunca pisar una
 * edición manual en curso que el usuario todavía no ha guardado.
 */
function useSyncedPrefillField(
  serverValue: string,
  value: string,
  setValue: (next: string) => void,
) {
  const lastSynced = useRef(serverValue);
  useEffect(() => {
    if (lastSynced.current === serverValue) return;
    const untouched = value === lastSynced.current;
    lastSynced.current = serverValue;
    if (untouched) setValue(serverValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverValue]);
}

type Props = {
  documentId: string;
  metadata: NotarialMetadata | null;
  prefill: NotarialMetadataPrefill;
  /** true cuando el contenido de la Escritura está finalizado. */
  readOnly: boolean;
  /** documents.edit — sin este permiso el formulario completo es de solo
   * lectura, sin importar el estado de la Escritura. */
  canEdit: boolean;
  canResetParties?: boolean;
  actNamePreview?: string | null;
  generatedPartiesPreview?: string | null;
  /** El contenido de la Escritura cambió después del último guardado de
   * estos datos — distinto del ciclo de confirmación (ver abajo). */
  reviewRequired?: boolean;
  /** Pertenencia actual al Índice Notarial (independiente de `status`). */
  includeInNotarialIndex: boolean;
  /** notarial_index.generate — trabajar el Índice (incluye asistente),
   * distinto de `documents.finalize` (finalizar/reabrir la Escritura en sí,
   * solo propietario/administrador); sin este permiso el control se muestra
   * pero deshabilitado. */
  canChangeInclusion: boolean;
  /** notarial_index.generate — confirmar/corregir datos del Índice; sin
   * este permiso el estado se ve pero los botones no aparecen. */
  canConfirm: boolean;
  /** Nombre del actor de la confirmación más reciente, o null si nunca se
   * confirmó. */
  confirmedByName: string | null;
  /** Se llama justo después de excluir con éxito — el compositor lo usa
   * para sacar al usuario del paso "Índice" si estaba parado ahí, ya que
   * ese paso deja de aparecer en la navegación normal del stepper. */
  onExcludedFromIndex?: () => void;
};

export function NotarialMetadataSection({
  documentId,
  metadata,
  prefill,
  readOnly,
  canEdit,
  canResetParties = false,
  actNamePreview = null,
  generatedPartiesPreview = null,
  reviewRequired = false,
  includeInNotarialIndex,
  canChangeInclusion,
  canConfirm,
  confirmedByName,
  onExcludedFromIndex,
}: Props) {
  const headingId = useId();
  const action = saveNotarialMetadataAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { showToast } = useToast();
  const [inclusion, setInclusion] = useState(includeInNotarialIndex);
  const [inclusionPending, setInclusionPending] = useState(false);
  const [inclusionError, setInclusionError] = useState<string | null>(null);
  const [inclusionDialog, setInclusionDialog] = useState<"exclude" | "include" | null>(null);
  // `NotarialMetadataSection` no se desmonta al navegar entre pasos de la
  // misma Escritura (mismo route [id], solo cambian los searchParams —
  // mismo patrón que el bug ya documentado y corregido en
  // DocumentLifecycleToast), así que `useState(includeInNotarialIndex)`
  // solo captura el prop del PRIMER montaje. Si la Escritura se finaliza
  // (o se excluye/reincluye) después de ese montaje, la prop del servidor
  // sí llega actualizada en el siguiente render, pero el estado local se
  // queda con el valor viejo — el toggle podía mostrarse marcado aunque
  // `documents.include_in_notarial_index` ya fuera `false` en la base de
  // datos. Se resincroniza explícitamente cuando el prop cambia, sin pisar
  // una actualización optimista local que todavía no llegó por props.
  const lastSyncedInclusion = useRef(includeInNotarialIndex);
  useEffect(() => {
    if (lastSyncedInclusion.current !== includeInNotarialIndex) {
      lastSyncedInclusion.current = includeInNotarialIndex;
      setInclusion(includeInNotarialIndex);
    }
  }, [includeInNotarialIndex]);

  async function applyInclusionChange(next: boolean) {
    setInclusionDialog(null);
    setInclusionError(null);
    setInclusionPending(true);
    const result = await setNotarialIndexInclusionAction(documentId, next);
    setInclusionPending(false);
    if (result.success && result.includeInNotarialIndex !== undefined) {
      lastSyncedInclusion.current = result.includeInNotarialIndex;
      setInclusion(result.includeInNotarialIndex);
      showToast(
        result.includeInNotarialIndex
          ? "Incluida en el Índice Notarial."
          : "Excluida del Índice Notarial.",
      );
      if (!result.includeInNotarialIndex) onExcludedFromIndex?.();
    } else {
      setInclusionError(result.message ?? "No fue posible actualizar el Índice Notarial.");
    }
  }

  // ------------------------------------------------------- confirmación
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<
    "confirm" | "correct" | null
  >(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState(metadata?.notarial_confirmed_at ?? null);
  const [reviewRequiredFlag, setReviewRequiredFlag] = useState(
    metadata?.notarial_review_required ?? false,
  );
  // Mismo riesgo de estado local obsoleto que `inclusion` arriba: reabrir
  // la Escritura invalida la confirmación en el servidor sin desmontar
  // este componente, así que el prop `metadata` se resincroniza aquí en
  // vez de confiar solo en el valor capturado al primer montaje.
  const lastSyncedConfirmedAt = useRef(metadata?.notarial_confirmed_at ?? null);
  const lastSyncedReviewRequired = useRef(metadata?.notarial_review_required ?? false);
  useEffect(() => {
    const serverConfirmedAt = metadata?.notarial_confirmed_at ?? null;
    const serverReviewRequired = metadata?.notarial_review_required ?? false;
    if (lastSyncedConfirmedAt.current !== serverConfirmedAt) {
      lastSyncedConfirmedAt.current = serverConfirmedAt;
      setConfirmedAt(serverConfirmedAt);
    }
    if (lastSyncedReviewRequired.current !== serverReviewRequired) {
      lastSyncedReviewRequired.current = serverReviewRequired;
      setReviewRequiredFlag(serverReviewRequired);
    }
  }, [metadata?.notarial_confirmed_at, metadata?.notarial_review_required]);

  async function handleConfirm() {
    if (!metadata) return;
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await confirmNotarialMetadataAction(documentId, metadata.version);
    setConfirmationBusy(false);
    if (result.success) {
      const confirmedNow = new Date().toISOString();
      lastSyncedConfirmedAt.current = confirmedNow;
      lastSyncedReviewRequired.current = false;
      setConfirmedAt(confirmedNow);
      setReviewRequiredFlag(false);
      showToast("Datos del Índice confirmados.");
    } else {
      setConfirmationError(
        result.message ?? "No fue posible confirmar los datos del índice.",
      );
    }
  }

  async function handleStartCorrection() {
    if (!metadata) return;
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await startNotarialCorrectionAction(documentId, metadata.version);
    setConfirmationBusy(false);
    if (result.success) {
      lastSyncedConfirmedAt.current = null;
      lastSyncedReviewRequired.current = true;
      setConfirmedAt(null);
      setReviewRequiredFlag(true);
      showToast("Corrección de datos del Índice iniciada.");
    } else {
      setConfirmationError(
        result.message ?? "No fue posible iniciar la corrección.",
      );
    }
  }

  const lastSuccessState = useRef<NotarialMetadataState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast(state.successMessage ?? "Cambios del índice guardados.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Valores controlados para el badge de completitud en vivo.
  //
  // `source === "suggestion"` (número de instrumento, tomo, folios cuando no
  // hay mapeo del machote) es una estimación — "el siguiente número", "el
  // último tomo usado en otra Escritura" — no un dato real de ESTA Escritura,
  // a diferencia de `"template"` (interpretado de un valor que el usuario ya
  // escribió en el propio documento). Precargar una sugerencia en el campo
  // editable la volvería indistinguible de un valor real: el badge la
  // mostraría como "Configurado", y como el submit siempre envía este mismo
  // estado (ver el bloque de inputs ocultos más abajo), un guardado disparado
  // por CUALQUIER otro campo la persistiría como si el usuario la hubiera
  // escrito. Por eso una sugerencia arranca el campo vacío — se ofrece solo
  // como texto de ayuda (`PrefillHelp`) hasta que el usuario la acepte
  // explícitamente.
  const startingValue = (field: NotarialPrefillField) =>
    field.source === "suggestion" ? "" : field.value;
  const [instrument, setInstrument] = useState(
    startingValue(prefill.instrumentNumber),
  );
  const [authorizedDate, setAuthorizedDate] = useState(
    startingValue(prefill.authorizedAt.date),
  );
  const [authorizedTime, setAuthorizedTime] = useState(
    startingValue(prefill.authorizedAt.time),
  );
  // Fecha y Hora se derivan (y pueden quedar pendientes) de forma
  // independiente — ver `prefill.ts` — pero `authorized_at` sigue siendo
  // una sola columna `timestamptz`: solo existe como valor completo cuando
  // AMBAS partes están presentes, nunca con una mitad inventada.
  const authorizedAt =
    authorizedDate && authorizedTime
      ? `${authorizedDate}T${authorizedTime}`
      : "";
  const [protocolBook, setProtocolBook] = useState(
    startingValue(prefill.protocolBook),
  );
  const [initialFolio, setInitialFolio] = useState(
    startingValue(prefill.initialFolio),
  );
  const [finalFolio, setFinalFolio] = useState(startingValue(prefill.finalFolio));
  const [actName, setActName] = useState(prefill.actName.value);
  const [parties, setParties] = useState(metadata?.parties_override ?? "");
  const [notes, setNotes] = useState(metadata?.notes ?? "");

  useSyncedPrefillField(
    startingValue(prefill.instrumentNumber),
    instrument,
    setInstrument,
  );
  useSyncedPrefillField(
    startingValue(prefill.authorizedAt.date),
    authorizedDate,
    setAuthorizedDate,
  );
  useSyncedPrefillField(
    startingValue(prefill.authorizedAt.time),
    authorizedTime,
    setAuthorizedTime,
  );
  useSyncedPrefillField(
    startingValue(prefill.protocolBook),
    protocolBook,
    setProtocolBook,
  );
  useSyncedPrefillField(
    startingValue(prefill.initialFolio),
    initialFolio,
    setInitialFolio,
  );
  useSyncedPrefillField(
    startingValue(prefill.finalFolio),
    finalFolio,
    setFinalFolio,
  );
  useSyncedPrefillField(prefill.actName.value, actName, setActName);
  const [openRowId, setOpenRowId] = useState<RowId | null>(null);
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.resetParties) setParties("");
    if (state.errors && Object.keys(state.errors).length > 0) {
      const firstErrorRow = ROW_FOR_ERROR.find((row) => state.errors?.[row.errorKey]);
      if (firstErrorRow) setOpenRowId(firstErrorRow.id);
    }
  }

  const liveMetadata = {
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
  };
  const complete = isNotarialComplete(liveMetadata);
  const missingFields = notarialMissingFields(liveMetadata);

  const confirmationState = notarialConfirmationState(
    { notarial_confirmed_at: confirmedAt, notarial_review_required: reviewRequiredFlag },
    complete,
  );
  const isConfirmed = confirmationState === "confirmed";
  // Mientras está Confirmado, el contenido es de solo lectura para TODOS —
  // la única salida es "Corregir datos" (canConfirm), nunca un guardado
  // directo. La base de datos ya rechaza esto de todos modos
  // (enforce_notarial_metadata_editable); deshabilitar aquí evita el
  // viaje de red innecesario y comunica el bloqueo con claridad.
  const fieldsDisabled = !canEdit || isConfirmed;
  const canConfirmNow = canConfirm && canConfirmNotarialIndex(confirmationState, complete);
  const canCorrectNow = canConfirm && isConfirmed;

  function toggleRow(id: RowId) {
    setOpenRowId((current) => (current === id ? null : id));
  }

  const instrumentConfigured = instrument !== "" && Number(instrument) > 0;
  const authorizedAtConfigured = authorizedAt !== "";
  const protocolBookConfigured = protocolBook.trim() !== "";
  const foliosConfigured = initialFolio.trim() !== "" && finalFolio.trim() !== "";
  const actNameConfigured =
    actName.trim() !== "" || !!(metadata?.act_name_snapshot ?? actNamePreview);
  const partiesFallback = metadata?.generated_parties ?? generatedPartiesPreview;
  const partiesConfigured = parties.trim() !== "" || !!partiesFallback;

  const requiredRows = [
    instrumentConfigured,
    authorizedAtConfigured,
    protocolBookConfigured,
    foliosConfigured,
    actNameConfigured,
    partiesConfigured,
  ];
  const configuredCount = requiredRows.filter(Boolean).length;
  const pendingCount = requiredRows.length - configuredCount;

  // Escritura excluida del Índice: nunca mostrar número de instrumento,
  // fecha/hora, tomo, folios, acto, partes, estado de confirmación ni
  // acciones Confirmar/Corregir — sea cual sea la ruta/estado que llevó a
  // renderizar este componente. Solo un estado compacto + la acción para
  // volver a incluirla (misma metadata y confirmación se conservan
  // intactas, sin importar cuánto tiempo permanezca excluida).
  if (!inclusion) {
    return (
      <section
        aria-labelledby={headingId}
        className="mt-8 rounded-xl border border-slate-200 bg-white shadow-ink-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-ink-100 bg-ink-100/40">
          <h2 id={headingId} className="text-sm font-semibold text-ink-900">
            Datos para índice
          </h2>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-sm font-medium text-ink-900">
            No pertenece al Índice Notarial
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Esta Escritura no está incluida en el Índice Notarial.
          </p>
          {canChangeInclusion && (
            <Button
              type="button"
              variant="accent"
              disabled={inclusionPending}
              onClick={() => setInclusionDialog("include")}
              className="mt-4"
            >
              Incluir en el Índice
            </Button>
          )}
        </div>
        {inclusionError && (
          <p role="alert" className="border-t border-ink-100 px-6 py-2 text-xs text-red-700">
            {inclusionError}
          </p>
        )}
        {inclusionDialog === "include" && (
          <ConfirmDialog
            title="¿Incluir esta Escritura en el Índice Notarial?"
            description="Volverá a aparecer en el Índice Notarial. Sus datos y su estado de confirmación se conservan tal como estaban."
            confirmLabel="Incluir"
            pending={inclusionPending}
            onConfirm={() => applyInclusionChange(true)}
            onClose={() => setInclusionDialog(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-ink-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-ink-100 bg-ink-100/40">
        <h2 id={headingId} className="text-sm font-semibold text-ink-900">
          Datos para índice
        </h2>
        <p className="text-xs text-ink-500">
          Metadata interna para organizar el índice notarial. «Completo»
          significa completo según los campos del sistema, no una validación
          legal.
        </p>
      </div>

      <div className="flex items-start gap-2 border-b border-ink-100 px-6 py-4">
        <input
          id="notarial-inclusion-toggle"
          type="checkbox"
          checked={inclusion}
          disabled={!canChangeInclusion || inclusionPending}
          onChange={(event) =>
            setInclusionDialog(event.target.checked ? "include" : "exclude")
          }
          className="mt-0.5 size-4 rounded accent-accent-600"
        />
        <label htmlFor="notarial-inclusion-toggle" className="text-sm text-ink-700">
          <span className="font-medium text-ink-900">
            Incluir en el Índice Notarial
          </span>
          <br />
          {inclusion
            ? "Esta escritura aparece en el Índice Notarial."
            : "Esta escritura está excluida del Índice Notarial. El contenido no se ve afectado."}
        </label>
      </div>
      {inclusionError && (
        <p role="alert" className="border-b border-ink-100 px-6 py-2 text-xs text-red-700">
          {inclusionError}
        </p>
      )}

      {/* ------------------------------------------------- estado de confirmación */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4 ${
          isConfirmed
            ? "bg-emerald-50/60"
            : confirmationState === "review_required"
              ? "bg-amber-50/60"
              : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Badge
            tone={
              isConfirmed
                ? "success"
                : confirmationState === "review_required"
                  ? "warning"
                  : confirmationState === "ready_to_confirm"
                    ? "accent"
                    : "neutral"
            }
          >
            {NOTARIAL_CONFIRMATION_STATE_LABEL[confirmationState]}
          </Badge>
          <div>
            <p className="text-sm font-medium text-ink-900">
              {isConfirmed
                ? "Datos del Índice confirmados"
                : "Estado de los datos del Índice"}
            </p>
            {isConfirmed && (
              <p className="mt-0.5 text-xs text-ink-600">
                {confirmedByName ? `Confirmado por ${confirmedByName}` : "Confirmado"}
                {confirmedAt && ` · ${formatDateTimeMeta(confirmedAt)}`}
              </p>
            )}
            {confirmationState === "review_required" && (
              <p className="mt-0.5 text-xs text-amber-800">
                Estos datos estuvieron confirmados; revísalos y confírmalos de
                nuevo.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canConfirmNow && (
            <Button
              type="button"
              variant="accent"
              disabled={confirmationBusy}
              onClick={() => setConfirmationDialog("confirm")}
            >
              Confirmar datos del Índice
            </Button>
          )}
          {canCorrectNow && (
            <Button
              type="button"
              variant="secondary"
              disabled={confirmationBusy}
              onClick={() => setConfirmationDialog("correct")}
            >
              Corregir datos
            </Button>
          )}
        </div>
      </div>
      {confirmationError && (
        <p role="alert" className="border-b border-ink-100 px-6 py-2 text-xs text-red-700">
          {confirmationError}
        </p>
      )}

      <form action={formAction} noValidate className="px-6 py-6">
        {state.message && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}
        {!canEdit && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-ink-100/60 border border-ink-200 px-4 py-3 text-sm text-ink-600"
          >
            Tu rol no permite editar los datos del índice. Los ves en modo
            lectura.
          </div>
        )}
        {canEdit && isConfirmed && (
          <div className="mb-6 rounded-lg bg-ink-100/60 border border-ink-200 px-4 py-3 text-sm text-ink-600">
            Estos datos están confirmados y de solo lectura.
            {canConfirmNow || canCorrectNow
              ? " Usa “Corregir datos” para editarlos."
              : " No tienes permiso para corregirlos."}
          </div>
        )}
        {canEdit && !isConfirmed && readOnly && (
          <div className="mb-6 rounded-lg bg-ink-100/60 border border-ink-200 px-4 py-3 text-sm text-ink-600">
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

        <IndexSummaryHeader
          configuredCount={configuredCount}
          pendingCount={pendingCount}
          helperText="Completo significa completo según los campos del sistema, no una validación legal."
          hasWarning={!complete}
          warningMessage={
            complete
              ? undefined
              : `Faltan datos para completar el Índice: ${joinMissingFieldLabels(missingFields)}.`
          }
        />

        <input type="hidden" name="version" value={metadata?.version ?? 1} />

        {/* Fuera de las filas colapsables a propósito: si vivieran dentro de
            `CollapsibleFieldRow`, dejarían de enviarse en el submit en
            cuanto la fila estuviera cerrada (su contenido no se monta
            mientras está colapsada) — incluso si nunca se abrió en esta
            sesión, como el valor precargado de un campo ya guardado. Los
            inputs visibles equivalentes dentro de cada fila ya no llevan
            `name`, solo editan este mismo estado. */}
        <input type="hidden" name="instrument_number" value={instrument} />
        <input type="hidden" name="authorized_at" value={authorizedAt} />
        <input type="hidden" name="act_name_override" value={actName} />
        <input type="hidden" name="protocol_book" value={protocolBook} />
        <input type="hidden" name="initial_folio" value={initialFolio} />
        <input type="hidden" name="final_folio" value={finalFolio} />
        <input type="hidden" name="parties_override" value={parties} />
        <input type="hidden" name="notes" value={notes} />
        {/* La derivación en vivo ya se calculó server-side una sola vez
            (`resolveNotarialMetadataPrefill`, misma fuente confiable que el
            resto del formulario) — viaja de vuelta como snapshot para que
            `saveNotarialMetadataAction` no tenga que recalcularla, y quede
            registrada para la próxima comparación (ver
            `derived-precedence.ts`). */}
        <input
          type="hidden"
          name="instrument_number_derived_snapshot"
          value={prefill.instrumentNumber.derivedNow ?? ""}
        />
        <input
          type="hidden"
          name="authorized_date_derived_snapshot"
          value={prefill.authorizedAt.date.derivedNow ?? ""}
        />
        <input
          type="hidden"
          name="authorized_time_derived_snapshot"
          value={prefill.authorizedAt.time.derivedNow ?? ""}
        />
        <input
          type="hidden"
          name="protocol_book_derived_snapshot"
          value={prefill.protocolBook.derivedNow ?? ""}
        />
        <input
          type="hidden"
          name="initial_folio_derived_snapshot"
          value={prefill.initialFolio.derivedNow ?? ""}
        />
        <input
          type="hidden"
          name="final_folio_derived_snapshot"
          value={prefill.finalFolio.derivedNow ?? ""}
        />

        <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 overflow-hidden">
          <CollapsibleFieldRow
            id="notarial-instrument"
            name="Número de instrumento"
            meta={instrument || "Sin configurar"}
            status={instrumentConfigured ? "configured" : "pending"}
            open={openRowId === "instrument_number"}
            onToggle={() => toggleRow("instrument_number")}
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
              onChange={(e) => setInstrument(e.target.value)}
              className={`${inputClass} font-mono tabular-figures`}
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
            <PrefillHelp
              field={prefill.instrumentNumber}
              onUseSuggestion={setInstrument}
            />
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-authorized-at"
            name="Fecha y hora de autorización"
            meta={
              authorizedAt
                ? formatDateTimeMeta(authorizedAt)
                : authorizedDate
                  ? `${authorizedDate} · hora pendiente`
                  : authorizedTime
                    ? `${authorizedTime} · fecha pendiente`
                    : "Fecha de autorización pendiente"
            }
            status={authorizedAtConfigured ? "configured" : "pending"}
            open={openRowId === "authorized_at"}
            onToggle={() => toggleRow("authorized_at")}
          >
            {/* Fecha y Hora se derivan (o quedan pendientes) de forma
                independiente — ver `prefill.ts` — así que son dos inputs
                separados en vez de uno solo `datetime-local`. Solo se
                combinan en `authorized_at` (arriba) cuando ambos están
                presentes; nunca se inventa la mitad que falta. */}
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
                  onChange={(e) => setAuthorizedDate(e.target.value)}
                  className={`${inputClass} font-mono tabular-figures`}
                  aria-invalid={!!state.errors?.authorized_at}
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
                  onChange={(e) => setAuthorizedTime(e.target.value)}
                  className={`${inputClass} font-mono tabular-figures`}
                  aria-invalid={!!state.errors?.authorized_at}
                  aria-describedby={
                    state.errors?.authorized_at ? "authorized_at-error" : undefined
                  }
                />
                {prefill.authorizedAt.optionBlockName ? (
                  <AuthorizedAtPrefillHelp field={prefill.authorizedAt} />
                ) : (
                  <PrefillHelp field={prefill.authorizedAt.time} />
                )}
              </div>
            </div>
            <FieldError
              id="authorized_at-error"
              message={state.errors?.authorized_at}
            />
            <p className="mt-1 text-xs text-ink-400">Hora de Costa Rica.</p>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-act-name"
            name="Acto o contrato"
            meta={actName || metadata?.act_name_snapshot || actNamePreview || "Sin configurar"}
            status={actNameConfigured ? "configured" : "pending"}
            open={openRowId === "act_name_override"}
            onToggle={() => toggleRow("act_name_override")}
          >
            <label htmlFor="act_name_override" className={labelClass}>
              Acto o contrato
            </label>
            <input
              id="act_name_override"
              type="text"
              disabled={fieldsDisabled}
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
            <p className="mt-1 text-xs text-ink-400">
              Si queda vacío, se usa el nombre guardado del machote.
            </p>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-protocol-book"
            name="Tomo"
            meta={protocolBook || "Sin configurar"}
            status={protocolBookConfigured ? "configured" : "pending"}
            open={openRowId === "protocol_book"}
            onToggle={() => toggleRow("protocol_book")}
          >
            <label htmlFor="protocol_book" className={labelClass}>
              Tomo
            </label>
            <input
              id="protocol_book"
              type="text"
              disabled={fieldsDisabled}
              value={protocolBook}
              onChange={(event) => setProtocolBook(event.target.value)}
              className={`${inputClass} font-mono tabular-figures`}
              aria-invalid={!!state.errors?.protocol_book}
              aria-describedby={
                state.errors?.protocol_book ? "protocol_book-error" : undefined
              }
            />
            <FieldError
              id="protocol_book-error"
              message={state.errors?.protocol_book}
            />
            <PrefillHelp
              field={prefill.protocolBook}
              onUseSuggestion={setProtocolBook}
            />
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-folios"
            name="Folios"
            meta={
              foliosConfigured
                ? `${initialFolio} – ${finalFolio}`
                : "Sin configurar"
            }
            status={foliosConfigured ? "configured" : "pending"}
            open={openRowId === "folios"}
            onToggle={() => toggleRow("folios")}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="initial_folio" className={labelClass}>
                  Folio inicial
                </label>
                <input
                  id="initial_folio"
                  type="text"
                  disabled={fieldsDisabled}
                  value={initialFolio}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (finalFolio === "" || finalFolio === initialFolio) {
                      setFinalFolio(next);
                    }
                    setInitialFolio(next);
                  }}
                  className={`${inputClass} font-mono tabular-figures`}
                  aria-invalid={!!state.errors?.initial_folio}
                  aria-describedby={
                    state.errors?.initial_folio ? "initial_folio-error" : undefined
                  }
                />
                <FieldError
                  id="initial_folio-error"
                  message={state.errors?.initial_folio}
                />
                <PrefillHelp
                  field={prefill.initialFolio}
                  onUseSuggestion={setInitialFolio}
                />
              </div>
              <div>
                <label htmlFor="final_folio" className={labelClass}>
                  Folio final
                </label>
                <input
                  id="final_folio"
                  type="text"
                  disabled={fieldsDisabled}
                  value={finalFolio}
                  onChange={(event) => setFinalFolio(event.target.value)}
                  className={`${inputClass} font-mono tabular-figures`}
                  aria-invalid={!!state.errors?.final_folio}
                  aria-describedby={
                    state.errors?.final_folio ? "final_folio-error" : undefined
                  }
                />
                <FieldError
                  id="final_folio-error"
                  message={state.errors?.final_folio}
                />
                <PrefillHelp
                  field={prefill.finalFolio}
                  onUseSuggestion={setFinalFolio}
                />
              </div>
            </div>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-parties"
            name="Partes"
            meta={
              parties.trim() !== ""
                ? "Corrección manual"
                : partiesFallback
                  ? "Generado desde el machote"
                  : "Sin configurar"
            }
            status={partiesConfigured ? "configured" : "pending"}
            open={openRowId === "parties_override"}
            onToggle={() => toggleRow("parties_override")}
          >
            <label htmlFor="parties_override" className={labelClass}>
              Partes
            </label>
            <textarea
              id="parties_override"
              rows={3}
              disabled={fieldsDisabled}
              value={parties}
              onChange={(event) => setParties(event.target.value)}
              placeholder={
                partiesFallback ?? "Se generará desde la configuración del machote"
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
            <p className="mt-1 text-xs text-ink-400">
              Una corrección manual tiene prioridad sobre el valor generado.
            </p>
            {canEdit && !isConfirmed && canResetParties && metadata && (
              <Button
                type="submit"
                variant="secondary"
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
                className="mt-3"
              >
                Restablecer desde el machote
              </Button>
            )}
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-notes"
            name="Notas internas"
            meta="Opcional"
            status="optional"
            open={openRowId === "notes"}
            onToggle={() => toggleRow("notes")}
          >
            <label htmlFor="notes" className={labelClass}>
              Notas internas{" "}
              <span className="text-ink-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              disabled={fieldsDisabled}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-xs text-ink-400">
              Uso interno; no se incluyen en la exportación del índice.
            </p>
          </CollapsibleFieldRow>
        </div>

        {canEdit && !isConfirmed && (
          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              variant="accent"
              name="intent"
              value="save"
              loading={pending}
            >
              Guardar datos del índice
            </Button>
          </div>
        )}
      </form>

      {inclusionDialog === "exclude" && (
        <ConfirmDialog
          title="¿Excluir esta Escritura del Índice Notarial?"
          description="Dejará de aparecer en el Índice, pero la Escritura y sus datos no se eliminarán. Podrás volver a incluirla posteriormente."
          confirmLabel="Excluir"
          tone="danger"
          pending={inclusionPending}
          onConfirm={() => applyInclusionChange(false)}
          onClose={() => setInclusionDialog(null)}
        />
      )}
      {inclusionDialog === "include" && (
        <ConfirmDialog
          title="¿Incluir esta Escritura en el Índice Notarial?"
          description="Volverá a aparecer en el Índice Notarial. Sus datos y su completitud no cambian."
          confirmLabel="Incluir"
          pending={inclusionPending}
          onConfirm={() => applyInclusionChange(true)}
          onClose={() => setInclusionDialog(null)}
        />
      )}

      {confirmationDialog === "confirm" && (
        <ConfirmDialog
          title="¿Confirmar datos del Índice?"
          description="Confirma que revisaste la información utilizada para el Índice Notarial. Después de confirmar, los datos quedarán bloqueados para edición normal. Si necesitas corregirlos posteriormente, el cambio quedará registrado."
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
    </section>
  );
}

const ROW_FOR_ERROR: Array<{ id: RowId; errorKey: string }> = [
  { id: "instrument_number", errorKey: "instrument_number" },
  { id: "authorized_at", errorKey: "authorized_at" },
  { id: "act_name_override", errorKey: "act_name_override" },
  { id: "protocol_book", errorKey: "protocol_book" },
  { id: "folios", errorKey: "initial_folio" },
  { id: "folios", errorKey: "final_folio" },
  { id: "parties_override", errorKey: "parties_override" },
];

function formatDateTimeMeta(value: string): string {
  return value.replace("T", " ");
}

function PrefillHelp({
  field,
  onUseSuggestion,
}: {
  field: NotarialPrefillField;
  /** Presente solo para campos con sugerencia (número/tomo/folios). */
  onUseSuggestion?: (value: string) => void;
}) {
  // Corrección manual preservada, pero la fuente ya no coincide con la
  // derivación que había cuando se hizo esa corrección — sugiere revisión
  // sin tocar el valor guardado (ver `resolveDerivedPrecedence`).
  const sourceChangedNotice = field.sourceChanged ? (
    <p className="mt-1 text-xs text-amber-700">
      La fuente cambió desde la última corrección manual — revisa si este
      valor sigue siendo correcto.
    </p>
  ) : null;

  if (!field.rawValue) {
    if (field.source === "suggestion" && field.value) {
      return (
        <p className="mt-1 text-xs text-ink-500">
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
      <p className="mt-1 text-xs text-ink-500">
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
    <div className="mt-2 rounded-lg bg-ink-100/50 px-3 py-2 text-xs text-ink-600">
      {sourceChangedNotice}
      <p>Original: “{field.rawValue}”</p>
      <p>Interpretado: {field.value}</p>
      <p>
        Estado: Listo{field.source === "saved" ? " · corrección guardada" : ""}
      </p>
    </div>
  );
}

/** Solo se usa para la parte de Hora cuando la fuente es un Bloque de
 * opciones — Fecha nunca viene de un Bloque de opciones. */
function AuthorizedAtPrefillHelp({
  field,
}: {
  field: NotarialAuthorizedAtPrefill;
}) {
  const { time, optionBlockName, optionVariantLabel } = field;
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
        time.compatible
          ? "border-ink-200 bg-ink-100/50 text-ink-600"
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
