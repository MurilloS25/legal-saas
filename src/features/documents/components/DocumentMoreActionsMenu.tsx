"use client";

/**
 * Agrupa las acciones secundarias del workspace de una Escritura (Descargar
 * Word, Duplicar, Historial) detrás de un único disclosure "Más acciones" —
 * reduce el ruido visual del encabezado sin tocar la lógica de cada acción:
 * mismos componentes autocontenidos de siempre (Server Actions, diálogos de
 * confirmación, actividad), solo con su variante visual "menu".
 *
 * Reutiliza `Popover` (único patrón de disclosure accesible del repo — no
 * hay librería headless de menús): trigger real con `aria-haspopup`/
 * `aria-expanded`, cierre con Escape/clic-afuera, ciclo de foco con Tab.
 * Deliberadamente no se le pasa `role="menu"`/`menuitem` a los hijos — cada
 * uno es un botón normal que abre su propio diálogo, no una navegación de
 * lista; el mismo patrón ya usado para "Cliente principal" en
 * `DocumentComposer`.
 */

import { Popover } from "@/components/document/Popover";
import { DocumentHistoryDialog } from "./DocumentHistoryDialog";
import { DownloadDocxButton } from "./DownloadDocxButton";
import { DuplicateDocumentButton } from "./DuplicateDocumentButton";
import type { DocumentActivityPage } from "../server/activity-queries";

type Props = {
  documentId: string;
  documentTitle: string;
  /** true cuando hay cambios locales sin guardar — bloquea Descargar Word. */
  dirty: boolean;
  persistedPendingVariableCount: number;
  canDuplicate: boolean;
  activity: DocumentActivityPage;
};

export function DocumentMoreActionsMenu({
  documentId,
  documentTitle,
  dirty,
  persistedPendingVariableCount,
  canDuplicate,
  activity,
}: Props) {
  return (
    <Popover
      triggerLabel={
        <>
          Más acciones
          <span aria-hidden="true"> ▾</span>
        </>
      }
      triggerClassName="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
      panelLabel="Más acciones de la escritura"
      align="end"
    >
      {() => (
        <div className="flex flex-col gap-0.5">
          <DownloadDocxButton
            documentId={documentId}
            disabled={dirty}
            pendingVariableCount={persistedPendingVariableCount}
            variant="menu"
          />
          {canDuplicate && (
            <DuplicateDocumentButton
              documentId={documentId}
              documentTitle={documentTitle}
              variant="menu"
            />
          )}
          <DocumentHistoryDialog
            documentId={documentId}
            activity={activity}
            variant="menu"
          />
        </div>
      )}
    </Popover>
  );
}
