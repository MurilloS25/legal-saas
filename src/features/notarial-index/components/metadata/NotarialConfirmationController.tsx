"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/Toast";
import {
  canConfirmNotarialIndex,
  NOTARIAL_CONFIRMATION_STATE_LABEL,
  notarialConfirmationState,
  type NotarialMetadata,
} from "../../model/notarial";
import {
  confirmNotarialMetadataAction,
  startNotarialCorrectionAction,
} from "../../server/confirmation-actions";
import { formatNotarialDateTime } from "./NotarialMetadataFields";

type Options = {
  documentId: string;
  metadata: NotarialMetadata | null;
  complete: boolean;
  matchesPersisted: boolean;
  savePending: boolean;
  canConfirm: boolean;
};

export function useNotarialConfirmationController({
  documentId,
  metadata,
  complete,
  matchesPersisted,
  savePending,
  canConfirm,
}: Options) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"confirm" | "correct" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState(
    metadata?.notarial_confirmed_at ?? null,
  );
  const metadataVersion = metadata?.version ?? 1;
  const [versionState, setVersionState] = useState(() => ({
    source: metadataVersion,
    value: metadataVersion,
  }));
  if (versionState.source !== metadataVersion) {
    setVersionState({ source: metadataVersion, value: metadataVersion });
  }
  const version = versionState.value;
  const [reviewRequired, setReviewRequired] = useState(
    metadata?.notarial_review_required ?? false,
  );
  const lastSyncedConfirmedAt = useRef(metadata?.notarial_confirmed_at ?? null);
  const lastSyncedReviewRequired = useRef(
    metadata?.notarial_review_required ?? false,
  );

  useEffect(() => {
    const serverConfirmedAt = metadata?.notarial_confirmed_at ?? null;
    const serverReviewRequired = metadata?.notarial_review_required ?? false;
    if (lastSyncedConfirmedAt.current !== serverConfirmedAt) {
      lastSyncedConfirmedAt.current = serverConfirmedAt;
      setConfirmedAt(serverConfirmedAt);
    }
    if (lastSyncedReviewRequired.current !== serverReviewRequired) {
      lastSyncedReviewRequired.current = serverReviewRequired;
      setReviewRequired(serverReviewRequired);
    }
  }, [metadata?.notarial_confirmed_at, metadata?.notarial_review_required]);

  const state = notarialConfirmationState(
    {
      notarial_confirmed_at: confirmedAt,
      notarial_review_required: reviewRequired,
    },
    complete,
  );
  const isConfirmed = state === "confirmed";
  const canConfirmNow =
    canConfirm && canConfirmNotarialIndex(state, complete);
  const canCorrectNow = canConfirm && isConfirmed;

  async function confirm() {
    if (!metadata || !matchesPersisted || savePending || busy) return;
    setDialog(null);
    setError(null);
    setBusy(true);
    const result = await confirmNotarialMetadataAction(documentId, version);
    setBusy(false);
    if (result.success) {
      const confirmedNow = new Date().toISOString();
      lastSyncedConfirmedAt.current = confirmedNow;
      lastSyncedReviewRequired.current = false;
      setConfirmedAt(confirmedNow);
      if (result.version) {
        setVersionState((current) => ({ ...current, value: result.version! }));
      }
      setReviewRequired(false);
      showToast("Datos del Índice confirmados.");
      return;
    }
    setError(result.message ?? "No fue posible confirmar los datos del índice.");
  }

  async function startCorrection() {
    if (!metadata) return;
    setDialog(null);
    setError(null);
    setBusy(true);
    const result = await startNotarialCorrectionAction(documentId, version);
    setBusy(false);
    if (result.success) {
      lastSyncedConfirmedAt.current = null;
      lastSyncedReviewRequired.current = true;
      setConfirmedAt(null);
      if (result.version) {
        setVersionState((current) => ({ ...current, value: result.version! }));
      }
      setReviewRequired(true);
      showToast("Corrección de datos del Índice iniciada.");
      return;
    }
    setError(result.message ?? "No fue posible iniciar la corrección.");
  }

  return {
    state,
    isConfirmed,
    canConfirm,
    canConfirmNow,
    canCorrectNow,
    matchesPersisted,
    confirmedAt,
    version,
    busy,
    savePending,
    error,
    dialog,
    setDialog,
    confirm,
    startCorrection,
  };
}

export type NotarialConfirmationController = ReturnType<
  typeof useNotarialConfirmationController
>;

/**
 * Encabezado de estado de los datos del Índice + diálogos de Confirmar /
 * Corregir. Las acciones en sí viven en una sola barra al pie del
 * formulario (`NotarialActionBar`), con una acción principal por estado;
 * aquí solo se muestra el estado y qué falta hacer (`guidance`).
 */
export function NotarialConfirmationSection({
  controller,
  confirmedByName,
  guidance,
  correctAvailable,
  children,
}: {
  controller: NotarialConfirmationController;
  confirmedByName: string | null;
  /** Qué falta hacer ahora (`notarialNextStep`). */
  guidance: string;
  /** Datos confirmados y con permiso: "Corregir datos" contextual aquí. */
  correctAvailable: boolean;
  children: ReactNode;
}) {
  const {
    state,
    isConfirmed,
    matchesPersisted,
    confirmedAt,
    busy,
    savePending,
    error,
    dialog,
    setDialog,
    confirm,
    startCorrection,
  } = controller;

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 ${
          isConfirmed
            ? "bg-emerald-50/60"
            : state === "review_required"
              ? "bg-amber-50/60"
              : ""
        }`}
      >
        <div>
          <p className="text-sm font-medium text-slate-900">
            {isConfirmed
              ? "Datos del Índice confirmados"
              : `Estado de los datos del Índice: ${NOTARIAL_CONFIRMATION_STATE_LABEL[state]}`}
          </p>
          {isConfirmed && (
            <p className="mt-0.5 text-xs text-slate-600">
              {confirmedByName
                ? `Confirmado por ${confirmedByName}`
                : "Confirmado"}
              {confirmedAt && ` · ${formatNotarialDateTime(confirmedAt)}`}
            </p>
          )}
          <p
            className={`mt-0.5 text-xs ${
              state === "review_required" ? "text-amber-800" : "text-slate-600"
            }`}
          >
            {guidance}
          </p>
        </div>
        {correctAvailable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setDialog("correct")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Corregir datos
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="border-b border-slate-100 px-6 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {children}
      {dialog === "confirm" && (
        <ConfirmDialog
          title="¿Confirmar Índice?"
          description="Confirma que revisaste la información utilizada para el Índice Notarial. Después de confirmar, los datos quedarán bloqueados para edición normal. Si necesitas corregirlos posteriormente, el cambio quedará registrado."
          confirmLabel="Confirmar Índice"
          pending={busy || savePending || !matchesPersisted}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "correct" && (
        <ConfirmDialog
          title="¿Corregir datos del Índice?"
          description="Estos datos ya habían sido confirmados. Las modificaciones quedarán registradas en el historial y deberás confirmarlos nuevamente al terminar."
          confirmLabel="Corregir datos"
          tone="danger"
          pending={busy}
          onConfirm={startCorrection}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
