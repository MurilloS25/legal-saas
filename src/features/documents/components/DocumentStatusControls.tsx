"use client";

/**
 * Controles del ciclo de vida de una escritura: acción guiada según el estado
 * (Borrador → Marcar como listo → Finalizar → Reabrir), con confirmaciones
 * accesibles. No se puede cambiar de estado con cambios locales sin guardar.
 * Finalizar se valida en servidor (bloquea si hay variables pendientes).
 */

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  markDocumentFinalAction,
  markDocumentReadyAction,
  reopenDocumentAction,
  returnDocumentToDraftAction,
  type DocumentStatusState,
} from "../server/status-actions";
import type { DocumentStatus } from "../model/lifecycle";

const initialState: DocumentStatusState = {};

// ------------------------------------------------------------------ confirm dialog

type ConfirmDialogProps = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={dialogRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled])",
            ) ?? [],
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="px-6 pt-6 pb-4">
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 mb-2"
            >
              {title}
            </h2>
            <p id={descId} className="text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="flex-1 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {pending ? "Aplicando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ controls

type Props = {
  documentId: string;
  status: DocumentStatus;
  /** true si hay cambios locales sin guardar en el compositor. */
  dirty: boolean;
};

type DialogKind = "final" | "reopen" | "draft" | null;

const secondaryButtonClass =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const primaryButtonClass =
  "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export function DocumentStatusControls({ documentId, status, dirty }: Props) {
  const [ready, readyAction, readyPending] = useActionState(
    markDocumentReadyAction.bind(null, documentId),
    initialState,
  );
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

  const anyPending =
    readyPending || toDraftPending || finalPending || reopenPending;

  // Los errores de acciones con diálogo se muestran DENTRO del diálogo;
  // mark_ready no tiene diálogo, así que su error va debajo de los controles.
  const inlineMessage = ready.message;

  // Un diálogo se oculta si su transición ya tuvo éxito (la revalidación
  // refresca el estado y los controles); así se evita setState en un efecto.
  const showFinalDialog = dialog === "final" && !final.success;
  const showReopenDialog = dialog === "reopen" && !reopened.success;
  const showDraftDialog = dialog === "draft" && !toDraft.success;

  function closeDialog() {
    setDialog(null);
    triggerRef.current?.focus();
  }

  function submitAction(formAction: (formData: FormData) => void) {
    // useActionState requiere que la acción se dispare dentro de una
    // transición para que el estado `pending` se actualice correctamente.
    startTransition(() => formAction(new FormData()));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-xs font-medium text-slate-600 mb-2">
        Estado de la escritura
      </p>

      {status === "draft" && (
        <button
          type="button"
          disabled={dirty || anyPending}
          onClick={() => submitAction(readyAction)}
          className={primaryButtonClass}
        >
          {readyPending ? "Aplicando…" : "Marcar como listo para revisar"}
        </button>
      )}

      {status === "ready" && (
        <div className="flex flex-wrap gap-2">
          <button
            ref={triggerRef}
            type="button"
            disabled={dirty || anyPending}
            onClick={() => setDialog("final")}
            className={primaryButtonClass}
          >
            Finalizar
          </button>
          <button
            type="button"
            disabled={dirty || anyPending}
            onClick={() => setDialog("draft")}
            className={secondaryButtonClass}
          >
            Volver a borrador
          </button>
        </div>
      )}

      {status === "final" && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            Finalizado es de solo lectura. No significa firmado, presentado ni
            enviado oficialmente.
          </p>
          <button
            ref={triggerRef}
            type="button"
            disabled={anyPending}
            onClick={() => setDialog("reopen")}
            className={secondaryButtonClass}
          >
            Reabrir para revisión
          </button>
        </div>
      )}

      {dirty && status !== "final" && (
        <p className="mt-2 text-xs text-amber-700">
          Guarda los cambios antes de cambiar el estado.
        </p>
      )}

      {inlineMessage && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {inlineMessage}
        </p>
      )}

      {showFinalDialog && (
        <ConfirmDialog
          title="¿Finalizar la escritura?"
          description="Quedará de solo lectura; podrás reabrirla para revisión más adelante. Finalizado no significa firmado, presentado ni enviado oficialmente."
          confirmLabel="Finalizar"
          pending={finalPending}
          error={final.message}
          onConfirm={() => submitAction(finalAction)}
          onClose={closeDialog}
        />
      )}

      {showReopenDialog && (
        <ConfirmDialog
          title="¿Reabrir para revisión?"
          description="La escritura volverá al estado “Listo para revisar” y podrá editarse de nuevo."
          confirmLabel="Reabrir"
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
