"use client";

/**
 * Encabezado del workspace de una Escritura — creación y edición: breadcrumb,
 * título/estado en vivo, cliente, acciones globales mínimas, y el stepper
 * horizontal de navegación entre Completar / Cobro / Índice.
 *
 * El stepper es la vista principal desde que se inicia una Escritura nueva:
 * no existe un flujo alternativo de una sola página para el modo creación.
 * "Completar" opera sobre estado local puro, es siempre navegable, y es
 * también donde vive la revisión completa del documento (vista previa en
 * vivo + expandir a pantalla completa) — ya no existe un paso "Revisar y
 * finalizar" separado: mostraba prácticamente el mismo documento que
 * Completar y solo agregaba navegación, sin una fase realmente distinta.
 * "Cobro" requiere que la Escritura ya exista (`documentId`) y queda
 * bloqueado hasta el primer guardado. "Índice" permanece SIEMPRE visible en
 * el stepper una vez persistida — a diferencia de antes, ya no desaparece
 * cuando la Escritura está excluida del Índice Notarial (`documents.
 * include_in_notarial_index = false`): esa exclusión decide si aparece en
 * el listado general del Índice, no si el usuario puede acceder al paso
 * para consultar/cambiar esa decisión. Sigue bloqueado hasta que la
 * Escritura esté finalizada, igual que siempre.
 *
 * Jerarquía de acciones (tercer refinamiento): el stepper ya cubre toda la
 * navegación entre secciones, así que este encabezado no repite botones
 * cuyo único propósito era llevar a un paso que ya es un tab — se retiró
 * el enlace "Ver Índice Notarial"/"Completar datos del índice" (ver
 * `DocumentStatusControls`). Un menú "Más acciones" agrupando Descargar
 * Word/Duplicar/Historial se probó y se descartó: Descargar Word e
 * Historial son acciones frecuentes/consistentes con el resto del sistema
 * y esconderlas detrás de un disclosure las hacía más difíciles de ubicar
 * — viven aquí directamente, con jerarquía visual secundaria/discreta
 * (nunca compiten con el CTA de lifecycle). Duplicar, menos frecuente,
 * también queda aquí como secundario — con solo 3-4 acciones utilitarias
 * en total un overflow ya no aportaba valor.
 *   - "Reabrir escritura" (`DocumentStatusControls`, rama `final`) — la
 *     única acción de lifecycle que tiene sentido fuera de "Completar"
 *     (una Escritura finalizada es de solo lectura en todos los pasos, no
 *     solo en ese), y la única con peso visual primario aquí.
 *   - Descargar Word, Historial, Duplicar — siempre visibles cuando la
 *     Escritura existe, sin importar el estado ni el paso activo.
 * Finalizar/Volver a borrador (rama `draft`/`ready`) NO vive aquí: vive en
 * la toolbar contextual de "Completar" (`DocumentSaveControls`, vía
 * `DocumentComposer`) junto a Guardar — ambas son acciones del documento
 * en edición y no le pertenecen a Cobro ni a Índice. Guardar en sí
 * tampoco vive aquí por el mismo motivo: es exclusivo de "Completar".
 *
 * El compositor (valores, cliente, dirty) permanece montado en todo momento
 * — cambiar de sección solo cambia qué panel es visible — así que ir de
 * Completar a Cobro y de vuelta nunca reinicia el formulario ni descarta
 * cambios sin guardar, tanto antes como después del primer guardado. La URL
 * se mantiene sincronizada (`history.pushState`) igual que en el workspace
 * de Machotes.
 */

import Link from "next/link";
import { HorizontalStepper, type StepStatus } from "@/components/document/HorizontalStepper";
import { documentStatusBadgeClass, documentStatusLabel } from "../model/status";
import type { DocumentStatus } from "../model/lifecycle";
import type { DocumentActivityPage } from "../server/activity-queries";
import { DocumentHistoryDialog } from "./DocumentHistoryDialog";
import { DocumentStatusControls } from "./DocumentStatusControls";
import { DownloadDocxButton } from "./DownloadDocxButton";
import { DuplicateDocumentButton } from "./DuplicateDocumentButton";

export type DocumentWorkspaceSection = "completar" | "cobro" | "notarial";

const STEP_META: Array<{
  id: DocumentWorkspaceSection;
  label: string;
  description: string;
}> = [
  {
    id: "completar",
    label: "Completar",
    description: "Escribe los datos de la escritura; se reflejan de inmediato en el documento.",
  },
  {
    id: "cobro",
    label: "Cobro",
    description: "Cuentas por cobrar asociadas a esta escritura.",
  },
  {
    id: "notarial",
    label: "Índice",
    description: "Datos internos para el Índice Notarial.",
  },
];

const EMPTY_ACTIVITY: DocumentActivityPage = {
  items: [],
  hasMore: false,
  nextOffset: 0,
};

type Props = {
  /** undefined antes del primer guardado — la Escritura todavía no existe. */
  documentId?: string;
  title: string;
  clientName: string | null;
  status: DocumentStatus;
  section: DocumentWorkspaceSection;
  saveStatusText: string;
  onSectionChange: (section: DocumentWorkspaceSection) => void;
  activity?: DocumentActivityPage;
  canDuplicate?: boolean;
  /**
   * Señales de completitud reales, calculadas por `DocumentComposer` —
   * regla única: cada una es `true` solo cuando ese paso fue confirmado por
   * su propia acción (guardar, finalizar, resolver Cobro explícitamente),
   * nunca por datos parciales ni por haber sido simplemente visitado.
   * "Índice" usa la misma condición de completitud que determina si la
   * Escritura aparece sin advertencia en el Índice Notarial
   * (`isNotarialComplete`/`notarial_index_entries.is_complete`) — nunca por
   * haber guardado parcialmente ni por haber visitado el paso.
   */
  completarComplete?: boolean;
  cobroComplete?: boolean;
  notarialComplete?: boolean;
  /** true si hay cambios locales sin guardar en el compositor — bloquea
   * Descargar Word (Finalizar/Reabrir/Volver a borrador tienen su propio
   * bloqueo por dirty donde viven: Finalizar en `DocumentSaveControls`
   * dentro de "Completar"; Reabrir nunca puede ocurrir con dirty porque una
   * Escritura finalizada no es editable). */
  dirty: boolean;
  /** documents.finalize — controla "Reabrir escritura" aquí. */
  canFinalize: boolean;
  /** true si los datos del Índice están actualmente Confirmados — el
   * diálogo de reabrir advierte que esa confirmación quedará invalidada. */
  notarialDataConfirmed: boolean;
  /** Variables sin valor del estado PERSISTIDO (no del local) — para el
   * aviso de "Descargar Word" cuando hay variables pendientes. */
  persistedPendingVariableCount: number;
};

export function DocumentWorkspaceHeader({
  documentId,
  title,
  clientName,
  status,
  section,
  saveStatusText,
  onSectionChange,
  activity,
  canDuplicate = false,
  completarComplete = false,
  cobroComplete = false,
  notarialComplete = false,
  dirty,
  canFinalize,
  notarialDataConfirmed,
  persistedPendingVariableCount,
}: Props) {
  const persisted = !!documentId;
  const notarialUnlocked = persisted && status === "final";
  const completion: Record<DocumentWorkspaceSection, boolean> = {
    completar: completarComplete,
    cobro: cobroComplete,
    notarial: notarialComplete,
  };

  const steps = STEP_META.map(({ id, label, description }) => {
    const needsPersistence = id === "cobro" || id === "notarial";
    const locked =
      (needsPersistence && !persisted) || (id === "notarial" && persisted && !notarialUnlocked);
    const disabledReason = !persisted
      ? "Disponible después de guardar la escritura por primera vez."
      : "Disponible después de finalizar la escritura.";
    const stepStatus: StepStatus = locked
      ? "locked"
      : id === section
        ? "current"
        : completion[id]
          ? "complete"
          : "upcoming";
    return {
      id,
      label,
      description,
      status: stepStatus,
      disabledReason: locked ? disabledReason : undefined,
    };
  });

  return (
    <header className="mb-6">
      <Link
        href="/dashboard/documents"
        className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:underline"
      >
        ‹ Volver a Escrituras
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 truncate">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${documentStatusBadgeClass(status)}`}
            >
              {documentStatusLabel(status)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{saveStatusText}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Cliente: {clientName ?? "Sin cliente"}
          </p>
        </div>
        {documentId && (
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {/* Solo la rama "final" (Reabrir) se monta aquí — draft/ready
                (Finalizar/Volver a borrador) vive en "Completar", junto a
                Guardar (ver DocumentSaveControls vía DocumentComposer). */}
            {status === "final" && (
              <DocumentStatusControls
                key={status}
                documentId={documentId}
                status={status}
                dirty={dirty}
                canFinalize={canFinalize}
                notarialDataConfirmed={notarialDataConfirmed}
              />
            )}
            {/* Utilitarias, siempre visibles, jerarquía secundaria/discreta
                — nunca compiten visualmente con Reabrir ni con Guardar/
                Finalizar en "Completar". */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DownloadDocxButton
                documentId={documentId}
                disabled={dirty}
                pendingVariableCount={persistedPendingVariableCount}
                variant="compact"
              />
              <DocumentHistoryDialog
                documentId={documentId}
                activity={activity ?? EMPTY_ACTIVITY}
              />
              {canDuplicate && (
                <DuplicateDocumentButton
                  documentId={documentId}
                  documentTitle={title}
                  variant="full"
                />
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-6">
        <HorizontalStepper
          steps={steps}
          currentId={section}
          onStepChange={onSectionChange}
          navigationLabel="Pasos de la escritura"
          idPrefix="document"
        />
      </div>
    </header>
  );
}
