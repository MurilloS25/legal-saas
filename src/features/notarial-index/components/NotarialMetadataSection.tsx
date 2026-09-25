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
 * permiso pulse "Corregir datos". La UI muestra UNA acción principal por
 * estado en la barra al pie (`notarialNextStep`) y el encabezado explica
 * qué falta hacer. El estado se deriva (nunca se infiere
 * localmente): `notarialConfirmationState()` a partir de
 * `notarial_confirmed_at`/`notarial_review_required` (servidor) +
 * completitud en vivo (cliente).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveNotarialMetadataAction,
} from "../server/metadata-actions";
import type { NotarialMetadataState } from "../model/action-state";
import type { NotarialMetadata } from "../model/notarial";
import type { NotarialMetadataPrefill } from "../model/prefill";
import { joinMissingFieldLabels } from "../model/notarial";
import { notarialNextStep } from "../model/next-step";
import type { NotarialDockState } from "../model/dock-state";
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { useToast } from "@/components/feedback/Toast";
import {
  NotarialMetadataFields,
  type NotarialMetadataRowId,
} from "./metadata/NotarialMetadataFields";
import { useNotarialMetadataDraft } from "./metadata/useNotarialMetadataDraft";
import {
  NotarialConfirmationSection,
  useNotarialConfirmationController,
} from "./metadata/NotarialConfirmationController";

const initialState: NotarialMetadataState = {};

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
  /** notarial_index.generate — confirmar/corregir datos del Índice; sin
   * este permiso el estado se ve pero los botones no aparecen. */
  canConfirm: boolean;
  /** Nombre del actor de la confirmación más reciente, o null si nunca se
   * confirmó. */
  confirmedByName: string | null;
  /**
   * Con dock (workspace de la Escritura): la sección no dibuja sus propios
   * botones de Guardar/Confirmar — el dock es el único lugar de Guardar y
   * ofrece "Confirmar Índice" como acción de ciclo de vida. Sin dock
   * (Escritura sin machote), la sección conserva su barra de acciones.
   */
  onDockStateChange?: (state: NotarialDockState | null) => void;
};

const FORM_ID = "notarial-metadata-form";

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
  canConfirm,
  confirmedByName,
  onDockStateChange,
}: Props) {
  const dockMode = onDockStateChange !== undefined;
  const action = saveNotarialMetadataAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { showToast } = useToast();
  const lastSuccessState = useRef<NotarialMetadataState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast(state.successMessage ?? "Cambios del índice guardados.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const draft = useNotarialMetadataDraft({
    metadata,
    prefill,
    actNamePreview,
    generatedPartiesPreview,
  });
  const confirmation = useNotarialConfirmationController({
    documentId,
    metadata,
    complete: draft.complete,
    matchesPersisted: draft.matchesPersisted,
    savePending: pending,
    canConfirm,
  });
  const [openRowId, setOpenRowId] = useState<NotarialMetadataRowId | null>(null);
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.resetParties) draft.setters.setParties("");
    if (state.errors && Object.keys(state.errors).length > 0) {
      const firstErrorRow = ROW_FOR_ERROR.find((row) => state.errors?.[row.errorKey]);
      if (firstErrorRow) setOpenRowId(firstErrorRow.id);
    }
  }

  const nextStep = notarialNextStep({
    state: confirmation.state,
    dirty: !draft.matchesPersisted,
    complete: draft.complete,
    missingFields: draft.missingFields,
    canEdit,
    canConfirm,
    contentChanged: reviewRequired,
    // El resumen (`IndexSummaryHeader`) ya lista los datos faltantes.
    listMissing: false,
  });

  // "Sin guardar" para el dock = ediciones reales del usuario en esta
  // sesión (`draft.dirty`), NO `!matchesPersisted`: una Escritura cuyo
  // Índice nunca se guardó (o con valores precargados) no tiene cambios del
  // usuario y no debe bloquear Reabrir. Guardar/Confirmar siguen usando
  // `matchesPersisted` vía `notarialNextStep`.
  const dirty = draft.dirty;
  const canSave = canEdit && !confirmation.isConfirmed;
  const busy = pending || confirmation.busy;
  const requestConfirm = confirmation.setDialog;
  useEffect(() => {
    onDockStateChange?.({
      formId: FORM_ID,
      canSave,
      saveEnabled: nextStep.saveEnabled,
      unsaved: dirty,
      saving: pending,
      confirming: confirmation.busy,
      errorMessage: state.message,
      confirmAvailable: nextStep.confirmAvailable && !busy,
      requestConfirm: () => requestConfirm("confirm"),
    });
  }, [
    onDockStateChange,
    canSave,
    nextStep.saveEnabled,
    nextStep.confirmAvailable,
    dirty,
    busy,
    pending,
    confirmation.busy,
    state.message,
    requestConfirm,
  ]);
  useEffect(() => () => onDockStateChange?.(null), [onDockStateChange]);

  const fieldsDisabled =
    !canEdit || confirmation.isConfirmed || pending || confirmation.busy;
  const { values } = draft;

  function toggleRow(id: NotarialMetadataRowId) {
    setOpenRowId((current) => (current === id ? null : id));
  }

  return (
    <NotarialConfirmationSection
      controller={confirmation}
      confirmedByName={confirmedByName}
      guidance={nextStep.guidance}
      correctAvailable={nextStep.correctAvailable}
    >
      <form id={FORM_ID} action={formAction} noValidate className="px-6 py-6">
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
        {canEdit && !confirmation.isConfirmed && readOnly && (
          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            La escritura ya está finalizada. Estos datos del Índice se
            guardan y se confirman aparte, sin modificar el contenido de la
            escritura.
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
          configuredCount={draft.configuredCount}
          pendingCount={draft.pendingCount}
          helperText="Completo significa completo según los campos del sistema, no una validación legal."
          hasWarning={!draft.complete}
          warningMessage={
            draft.complete
              ? undefined
              : `Faltan datos para completar el Índice: ${joinMissingFieldLabels(draft.missingFields)}.`
          }
        />

        <input type="hidden" name="version" value={confirmation.version} />

        {/* Fuera de las filas colapsables a propósito: si vivieran dentro de
            `CollapsibleFieldRow`, dejarían de enviarse en el submit en
            cuanto la fila estuviera cerrada (su contenido no se monta
            mientras está colapsada) — incluso si nunca se abrió en esta
            sesión, como el valor precargado de un campo ya guardado. Los
            inputs visibles equivalentes dentro de cada fila ya no llevan
            `name`, solo editan este mismo estado. */}
        <input type="hidden" name="instrument_number" value={values.instrument} />
        <input type="hidden" name="authorized_at" value={draft.authorizedAt} />
        <input type="hidden" name="act_name_override" value={values.actName} />
        <input type="hidden" name="protocol_book" value={values.protocolBook} />
        <input type="hidden" name="initial_folio" value={values.initialFolio} />
        <input type="hidden" name="final_folio" value={values.finalFolio} />
        <input type="hidden" name="parties_override" value={values.parties} />
        <input type="hidden" name="notes" value={values.notes} />
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
          draft={draft}
          canEdit={canEdit}
          isConfirmed={confirmation.isConfirmed}
          canResetParties={canResetParties}
          pending={pending}
        />

        {/* Una sola barra de acción, con una acción principal por estado
            (`notarialNextStep`): Guardar mientras haya cambios o falten
            datos; Confirmar solo con todo completo y guardado; Corregir
            cuando ya está confirmado. Nunca Guardar y Confirmar compitiendo
            a la vez. */}
        {!dockMode && (nextStep.primary === "save" || nextStep.primary === "confirm") && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
            {nextStep.primary === "save" && (
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={pending || confirmation.busy}
                className={PRIMARY_BUTTON}
              >
                {pending ? "Guardando…" : "Guardar datos del índice"}
              </button>
            )}
            {nextStep.primary === "confirm" && (
              <button
                type="button"
                disabled={pending || confirmation.busy}
                onClick={() => confirmation.setDialog("confirm")}
                className={PRIMARY_BUTTON}
              >
                Confirmar Índice
              </button>
            )}
          </div>
        )}
      </form>
    </NotarialConfirmationSection>
  );
}

const PRIMARY_BUTTON =
  "rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const ROW_FOR_ERROR: Array<{ id: NotarialMetadataRowId; errorKey: string }> = [
  { id: "instrument_number", errorKey: "instrument_number" },
  { id: "authorized_at", errorKey: "authorized_at" },
  { id: "act_name_override", errorKey: "act_name_override" },
  { id: "protocol_book", errorKey: "protocol_book" },
  { id: "folios", errorKey: "initial_folio" },
  { id: "folios", errorKey: "final_folio" },
  { id: "parties_override", errorKey: "parties_override" },
];
