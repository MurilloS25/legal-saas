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
 * Jerarquía de acciones (segundo refinamiento tras el retiro de "Revisar y
 * finalizar"): el stepper ya cubre toda la navegación entre secciones, así
 * que este encabezado deja de repetir botones cuyo único propósito era
 * llevar a un paso que ya es un tab — se retiró el enlace "Ver Índice
 * Notarial"/"Completar datos del índice" (ver `DocumentStatusControls`).
 * Lo que queda aquí es deliberadamente mínimo:
 *   - "Reabrir escritura" (`DocumentStatusControls`, rama `final`) — la
 *     única acción de lifecycle que tiene sentido fuera de "Completar",
 *     porque una Escritura finalizada es de solo lectura en todos los
 *     pasos, no solo en ese.
 *   - "Más acciones" (`DocumentMoreActionsMenu`) — Descargar Word, Duplicar
 *     e Historial, agrupadas detrás de un disclosure para no competir
 *     visualmente con las acciones primarias del documento.
 * Finalizar/Volver a borrador (rama `draft`/`ready`) YA NO vive aquí: se
 * integró a la barra de Guardar dentro de "Completar"
 * (`DocumentSaveControls`, vía `DocumentComposer`) porque ambas son
 * acciones del documento en edición y no le pertenecen a Cobro ni a
 * Índice — repetir el control global ahí solo porque el componente existe
 * llenaba esos pasos de acciones ajenas a su contenido. Guardar en sí
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
import { DocumentMoreActionsMenu } from "./DocumentMoreActionsMenu";
import { DocumentStatusControls } from "./DocumentStatusControls";

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
   * aviso de Descargar Word dentro de "Más acciones". */
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
            <DocumentMoreActionsMenu
              documentId={documentId}
              documentTitle={title}
              dirty={dirty}
              persistedPendingVariableCount={persistedPendingVariableCount}
              canDuplicate={canDuplicate}
              activity={activity ?? EMPTY_ACTIVITY}
            />
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
