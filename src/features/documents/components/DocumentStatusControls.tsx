"use client";

/**
 * Controles del ciclo de vida visible de una escritura (Borrador ↔ Finalizada),
 * con compatibilidad para el estado histórico `ready` y confirmaciones
 * accesibles. No se puede cambiar de estado con cambios locales sin guardar.
 * Finalizar se valida en servidor (bloquea si hay variables pendientes).
 *
 * Un solo componente para las dos ramas de estado, ambas integradas al
 * mismo dock flotante (`DocumentSaveControls`) — nunca montadas a la vez,
 * porque son mutuamente excluyentes según `status`: "draft"/"ready"
 * (Finalizar/Volver a borrador) cuando es editable, "final" (Reabrir)
 * cuando no. Ya no ofrece un enlace directo al paso "Índice": el stepper
 * ya lo cubre, así que agregar uno aquí solo duplicaba navegación.
 *
 * El aviso "Finalizada es de solo lectura..." ya no vive aquí — es
 * información sobre el documento, no parte de un control de acción, así
 * que se movió al encabezado del workspace (`DocumentWorkspaceHeader`),
 * separada de cualquier botón. El motivo de un disabled por `dirty` se
 * explica con `title` (tooltip accesible nativo) en el propio botón, no
 * con una línea de texto permanente — esa línea hacía crecer el dock
 * flotante justo en el estado dirty, el más frecuente durante la edición.
 */

import { startTransition, useActionState, useRef, useState } from "react";
import {
  markDocumentFinalAction,
  reopenDocumentAction,
  returnDocumentToDraftAction,
} from "../server/lifecycle-actions";
import type { DocumentStatusState } from "../model/action-state";
import type { DocumentStatus } from "../model/lifecycle";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

const initialState: DocumentStatusState = {};

// ------------------------------------------------------------------ controls

type Props = {
  documentId: string;
  status: DocumentStatus;
  /** true si hay cambios locales sin guardar en el compositor. */
  dirty: boolean;
  /** documents.finalize — controla Finalizar/Reabrir/Volver a borrador. */
  canFinalize: boolean;
  /** true si los datos del Índice están actualmente Confirmados — el
   * diálogo de reabrir advierte que esa confirmación quedará invalidada. */
  notarialDataConfirmed: boolean;
  /** documents.include_in_notarial_index — heredado del Machote al crear
   * (o corregido individualmente desde el paso Índice). Finalizar ya no
   * decide este valor; solo lo muestra en su diálogo de confirmación
   * (rama draft/ready). Irrelevante para la rama final (Reabrir) — opcional
   * para esa llamada. */
  includeInNotarialIndex?: boolean;
};

type DialogKind = "final" | "reopen" | "draft" | null;

const secondaryButtonClass =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const primaryButtonClass =
  "rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export function DocumentStatusControls({
  documentId,
  status,
  dirty,
  canFinalize,
  notarialDataConfirmed,
  includeInNotarialIndex = true,
}: Props) {
  const [toDraft, toDraftAction, toDraftPending] = useActionState(
    returnDocumentToDraftAction.bind(null, documentId),
    initialState,
  );
  const [final, finalAction, finalPending] = useActionState(
    markDocumentFinalAction.bind(null, documentId),
    initialState,
  );
  const [reopened, reopenAction, reopenPending] = useActionState(
    reopenDocumentAction.bind(null, documentId),
    initialState,
  );

  const [dialog, setDialog] = useState<DialogKind>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const anyPending = toDraftPending || finalPending || reopenPending;

  // Un diálogo se oculta si su transición ya tuvo éxito (la revalidación
  // refresca el estado y los controles); así se evita setState en un efecto.
  const showFinalDialog = dialog === "final" && !final.success;
  const showReopenDialog = dialog === "reopen" && !reopened.success;
  const showDraftDialog = dialog === "draft" && !toDraft.success;

  function closeDialog() {
    setDialog(null);
    triggerRef.current?.focus();
  }

  function submitAction(
    formAction: (formData: FormData) => void,
    formData: FormData = new FormData(),
  ) {
    // useActionState requiere que la acción se dispare dentro de una
    // transición para que el estado `pending` se actualice correctamente.
    startTransition(() => formAction(formData));
  }

  function submitFinal() {
    if (dirty || anyPending) return;
    submitAction(finalAction);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Antes un <p> visible dentro de una card propia; ahora la franja de
          estado compacta (DocumentComposer) ya da ese contexto. Se conserva
          como encabezado accesible sin ocupar espacio visual. */}
      <h2 className="sr-only">Estado de la escritura</h2>

      {status === "draft" && canFinalize && (
        <button
          ref={triggerRef}
          type="button"
          disabled={dirty || anyPending}
          onClick={() => setDialog("final")}
          title={dirty ? "Guarda los cambios antes de finalizar." : undefined}
          className={primaryButtonClass}
        >
          Finalizar escritura
        </button>
      )}

      {status === "ready" && (
        <>
          <p className="w-full text-right text-xs text-amber-800">
            Esta escritura conserva un estado histórico.
            {canFinalize && " Puedes finalizarla o devolverla a borrador."}
          </p>
          {canFinalize && (
            <>
              <button
                ref={triggerRef}
                type="button"
                disabled={dirty || anyPending}
                onClick={() => setDialog("final")}
                title={dirty ? "Guarda los cambios antes de finalizar." : undefined}
                className={primaryButtonClass}
              >
                Finalizar escritura
              </button>
              <button
                type="button"
                disabled={dirty || anyPending}
                onClick={() => setDialog("draft")}
                title={dirty ? "Guarda los cambios antes de continuar." : undefined}
                className={secondaryButtonClass}
              >
                Volver a borrador
              </button>
            </>
          )}
        </>
      )}

      {status === "final" && canFinalize && (
        <button
          ref={triggerRef}
          type="button"
          disabled={anyPending}
          onClick={() => setDialog("reopen")}
          className={primaryButtonClass}
        >
          Reabrir escritura
        </button>
      )}

      {showFinalDialog && (
        <ConfirmDialog
          title="Finalizar escritura"
          description={
            <>
              La escritura quedará bloqueada para edición. Podrás reabrirla
              posteriormente. Antes de continuar, revisa el contenido y los
              datos ingresados.
              <br />
              <br />
              {includeInNotarialIndex
                ? "Esta Escritura se incluirá en el Índice Notarial según su configuración actual."
                : "Esta Escritura no se incluirá en el Índice Notarial según su configuración actual."}
            </>
          }
          confirmLabel="Finalizar escritura"
          pending={finalPending || dirty}
          error={final.message}
          onConfirm={submitFinal}
          onClose={closeDialog}
        />
      )}

      {showReopenDialog && (
        <ConfirmDialog
          title="¿Reabrir la escritura?"
          description={
            notarialDataConfirmed ? (
              <>
                La Escritura volverá a estar editable. Podrás finalizarla
                nuevamente después.
                <br />
                <br />
                Al reabrir esta Escritura, la confirmación de sus datos del
                Índice quedará invalidada y deberás revisarlos nuevamente al
                finalizar.
              </>
            ) : (
              "La Escritura volverá a estar editable. Podrás finalizarla nuevamente después."
            )
          }
          confirmLabel="Reabrir escritura"
          pending={reopenPending}
          error={reopened.message}
          onConfirm={() => submitAction(reopenAction)}
          onClose={closeDialog}
        />
      )}

      {showDraftDialog && (
        <ConfirmDialog
          title="¿Volver a borrador?"
          description="La escritura perderá la marca de “Listo para revisar” y volverá a Borrador."
          confirmLabel="Volver a borrador"
          pending={toDraftPending}
          error={toDraft.message}
          onConfirm={() => submitAction(toDraftAction)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
