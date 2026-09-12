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
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { useToast } from "@/components/feedback/Toast";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useUnsavedChanges } from "@/components/navigation/NavigationGuard";
import { matchesPersistedNotarialSnapshot } from "../model/confirmation-snapshot";
import {
  formatNotarialDateTime,
  NotarialMetadataFields,
  type NotarialMetadataRowId,
} from "./metadata/NotarialMetadataFields";

const initialState: NotarialMetadataState = {};

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
  const metadataVersion = metadata?.version ?? 1;
  const [confirmationVersionState, setConfirmationVersionState] = useState(() => ({
    source: metadataVersion,
    value: metadataVersion,
  }));
  if (confirmationVersionState.source !== metadataVersion) {
    setConfirmationVersionState({ source: metadataVersion, value: metadataVersion });
  }
  const confirmationVersion = confirmationVersionState.value;
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
    if (!metadata || !matchesPersistedNotarialSnapshot(liveMetadata, metadata) || pending || confirmationBusy) return;
    setConfirmationDialog(null);
    setConfirmationError(null);
    setConfirmationBusy(true);
    const result = await confirmNotarialMetadataAction(documentId, confirmationVersion);
    setConfirmationBusy(false);
    if (result.success) {
      const confirmedNow = new Date().toISOString();
      lastSyncedConfirmedAt.current = confirmedNow;
      lastSyncedReviewRequired.current = false;
      setConfirmedAt(confirmedNow);
      if (result.version) {
        setConfirmationVersionState((current) => ({ ...current, value: result.version! }));
      }
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
    const result = await startNotarialCorrectionAction(documentId, confirmationVersion);
    setConfirmationBusy(false);
    if (result.success) {
      lastSyncedConfirmedAt.current = null;
      lastSyncedReviewRequired.current = true;
      setConfirmedAt(null);
      if (result.version) {
        setConfirmationVersionState((current) => ({ ...current, value: result.version! }));
      }
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
  const [openRowId, setOpenRowId] = useState<NotarialMetadataRowId | null>(null);
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
    notes,
    authorizedDate,
    authorizedTime,
    instrument_number: instrument === "" ? null : Number(instrument),
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
  const matchesPersisted = matchesPersistedNotarialSnapshot(liveMetadata, metadata);
  const [initialInput] = useState(JSON.stringify(liveMetadata));
  const metadataDirty = metadata ? !matchesPersisted : JSON.stringify(liveMetadata) !== initialInput;
  useUnsavedChanges(metadataDirty);
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
  const fieldsDisabled = !canEdit || isConfirmed || pending || confirmationBusy;
  const canConfirmNow = canConfirm && canConfirmNotarialIndex(confirmationState, complete);
  const canCorrectNow = canConfirm && isConfirmed;

  function toggleRow(id: NotarialMetadataRowId) {
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
        className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 id={headingId} className="text-sm font-semibold text-slate-900">
            Datos para índice
          </h2>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No pertenece al Índice Notarial
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Esta Escritura no está incluida en el Índice Notarial.
          </p>
          {canChangeInclusion && (
            <button
              type="button"
              disabled={inclusionPending}
              onClick={() => setInclusionDialog("include")}
              className="mt-4 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Incluir en el Índice
            </button>
          )}
        </div>
        {inclusionError && (
          <p role="alert" className="border-t border-slate-100 px-6 py-2 text-xs text-red-700">
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
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 id={headingId} className="text-sm font-semibold text-slate-900">
          Datos para índice
        </h2>
        <p className="text-xs text-slate-500">
          Metadata interna para organizar el índice notarial. «Completo»
          significa completo según los campos del sistema, no una validación
          legal.
        </p>
      </div>

      <div className="flex items-start gap-2 border-b border-slate-100 px-6 py-4">
        <input
          id="notarial-inclusion-toggle"
          type="checkbox"
          checked={inclusion}
          disabled={!canChangeInclusion || inclusionPending}
          onChange={(event) =>
            setInclusionDialog(event.target.checked ? "include" : "exclude")
          }
          className="mt-0.5 size-4 accent-accent-700"
        />
        <label htmlFor="notarial-inclusion-toggle" className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">
            Incluir en el Índice Notarial
          </span>
          <br />
          {inclusion
            ? "Esta escritura aparece en el Índice Notarial."
            : "Esta escritura está excluida del Índice Notarial. El contenido no se ve afectado."}
        </label>
      </div>
      {inclusionError && (
        <p role="alert" className="border-b border-slate-100 px-6 py-2 text-xs text-red-700">
          {inclusionError}
        </p>
      )}

      {/* ------------------------------------------------- estado de confirmación */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 ${
          isConfirmed
            ? "bg-emerald-50/60"
            : confirmationState === "review_required"
              ? "bg-amber-50/60"
              : ""
        }`}
      >
        <div>
          <p className="text-sm font-medium text-slate-900">
            {isConfirmed
              ? "Datos del Índice confirmados"
              : `Estado de los datos del Índice: ${NOTARIAL_CONFIRMATION_STATE_LABEL[confirmationState]}`}
          </p>
          {isConfirmed && (
            <p className="mt-0.5 text-xs text-slate-600">
              {confirmedByName ? `Confirmado por ${confirmedByName}` : "Confirmado"}
              {confirmedAt && ` · ${formatNotarialDateTime(confirmedAt)}`}
            </p>
          )}
          {confirmationState === "review_required" && (
            <p className="mt-0.5 text-xs text-amber-800">
              Estos datos estuvieron confirmados; revísalos y confírmalos de
              nuevo.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canConfirmNow && (
            <button
              type="button"
              disabled={confirmationBusy || pending || !matchesPersisted}
              onClick={() => setConfirmationDialog("confirm")}
              className="rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Confirmar datos del Índice
            </button>
          )}
          {canCorrectNow && (
            <button
              type="button"
              disabled={confirmationBusy}
              onClick={() => setConfirmationDialog("correct")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Corregir datos
            </button>
          )}
        </div>
      </div>
      {canConfirm && !isConfirmed && !matchesPersisted && (
        <p role="status" className="px-6 py-2 text-sm text-amber-800">
          Guarda los cambios del índice antes de confirmar los datos visibles.
        </p>
      )}
      {confirmationError && (
        <p role="alert" className="border-b border-slate-100 px-6 py-2 text-xs text-red-700">
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
            className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
          >
            Tu rol no permite editar los datos del índice. Los ves en modo
            lectura.
          </div>
        )}
        {canEdit && isConfirmed && (
          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            Estos datos están confirmados y de solo lectura.
            {canConfirmNow || canCorrectNow
              ? " Usa “Corregir datos” para editarlos."
              : " No tienes permiso para corregirlos."}
          </div>
        )}
        {canEdit && !isConfirmed && readOnly && (
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

        <input type="hidden" name="version" value={confirmationVersion} />

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

        <NotarialMetadataFields
          openRowId={openRowId}
          onToggle={toggleRow}
          fieldsDisabled={fieldsDisabled}
          errors={state.errors}
          metadata={metadata}
          prefill={prefill}
          actNamePreview={actNamePreview}
          instrument={instrument}
          setInstrument={setInstrument}
          instrumentConfigured={instrumentConfigured}
          authorizedAt={authorizedAt}
          authorizedDate={authorizedDate}
          setAuthorizedDate={setAuthorizedDate}
          authorizedTime={authorizedTime}
          setAuthorizedTime={setAuthorizedTime}
          authorizedAtConfigured={authorizedAtConfigured}
          actName={actName}
          setActName={setActName}
          actNameConfigured={actNameConfigured}
          protocolBook={protocolBook}
          setProtocolBook={setProtocolBook}
          protocolBookConfigured={protocolBookConfigured}
          initialFolio={initialFolio}
          setInitialFolio={setInitialFolio}
          finalFolio={finalFolio}
          setFinalFolio={setFinalFolio}
          foliosConfigured={foliosConfigured}
          parties={parties}
          setParties={setParties}
          partiesFallback={partiesFallback}
          partiesConfigured={partiesConfigured}
          notes={notes}
          setNotes={setNotes}
          canEdit={canEdit}
          isConfirmed={isConfirmed}
          canResetParties={canResetParties}
          pending={pending}
        />

        {canEdit && !isConfirmed && (
          <div className="mt-5 flex justify-end">
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
          pending={confirmationBusy || pending || !matchesPersisted}
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

const ROW_FOR_ERROR: Array<{ id: NotarialMetadataRowId; errorKey: string }> = [
  { id: "instrument_number", errorKey: "instrument_number" },
  { id: "authorized_at", errorKey: "authorized_at" },
  { id: "act_name_override", errorKey: "act_name_override" },
  { id: "protocol_book", errorKey: "protocol_book" },
  { id: "folios", errorKey: "initial_folio" },
  { id: "folios", errorKey: "final_folio" },
  { id: "parties_override", errorKey: "parties_override" },
];
