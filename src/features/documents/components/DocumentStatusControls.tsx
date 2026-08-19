"use client";

/**
 * Controles del ciclo de vida visible de una escritura (Borrador ↔ Finalizada),
 * con compatibilidad para el estado histórico `ready` y confirmaciones
 * accesibles. No se puede cambiar de estado con cambios locales sin guardar.
 * Finalizar se valida en servidor (bloquea si hay variables pendientes).
 */

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  markDocumentFinalAction,
  reopenDocumentAction,
  returnDocumentToDraftAction,
  type DocumentStatusState,
} from "../server/lifecycle-actions";
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
  // Default activado: preserva el comportamiento previo a este cambio (toda
  // Escritura finalizada entraba al Índice) para quien no toca la casilla.
  const [includeInIndex, setIncludeInIndex] = useState(true);

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
    const formData = new FormData();
    if (includeInIndex) formData.set("include_in_notarial_index", "1");
    submitAction(finalAction, formData);
  }

  function openFinalDialog() {
    setIncludeInIndex(true);
    setDialog("final");
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
          onClick={openFinalDialog}
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
                onClick={openFinalDialog}
                className={primaryButtonClass}
              >
                Finalizar escritura
              </button>
              <button
                type="button"
                disabled={dirty || anyPending}
                onClick={() => setDialog("draft")}
                className={secondaryButtonClass}
              >
                Volver a borrador
              </button>
            </>
          )}
        </>
      )}

      {status === "final" && (
        <>
          <p className="w-full text-right text-xs text-slate-500">
            Finalizada es de solo lectura. No significa firmada, presentada ni
            enviada oficialmente.
          </p>
          {canFinalize && (
            <button
              ref={triggerRef}
              type="button"
              disabled={anyPending}
              onClick={() => setDialog("reopen")}
              className={secondaryButtonClass}
            >
              Reabrir escritura
            </button>
          )}
          <Link
            href={`/dashboard/documents/${documentId}?section=notarial`}
            className="inline-flex rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          >
            Completar datos del índice
          </Link>
        </>
      )}

      {dirty && status !== "final" && (
        <p className="w-full text-right text-xs text-amber-700">
          Guarda los cambios antes de cambiar el estado.
        </p>
      )}

      {showFinalDialog && (
        <ConfirmDialog
          title="Finalizar escritura"
          description={
            <>
              La escritura quedará bloqueada para edición. Podrás reabrirla
              posteriormente. Antes de continuar, revisa el contenido y los
              datos ingresados.
              <label className="mt-4 flex items-start gap-2 text-left text-sm font-normal text-slate-700">
                <input
                  type="checkbox"
                  checked={includeInIndex}
                  onChange={(event) => setIncludeInIndex(event.target.checked)}
                  disabled={finalPending}
                  className="mt-0.5 size-4 accent-accent-700"
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Incluir en el Índice Notarial
                  </span>
                  <br />
                  Si la incluyes, la Escritura aparecerá en el Índice
                  Notarial al finalizar. Después deberás revisar y, cuando
                  estén completos, confirmar sus datos del Índice.
                </span>
              </label>
            </>
          }
          confirmLabel="Finalizar escritura"
          pending={finalPending}
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
