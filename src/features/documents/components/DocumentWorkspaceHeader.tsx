"use client";

/**
 * Encabezado del workspace de una Escritura — creación y edición: breadcrumb,
 * título/estado en vivo, cliente, acciones utilitarias fijas, y el stepper
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
 * Jerarquía de acciones (quinto refinamiento): este encabezado ya NO aloja
 * ningún control de lifecycle (ni Finalizar/Volver a borrador ni Reabrir) —
 * los tres viven en el dock flotante (`DocumentSaveControls`, vía
 * `DocumentComposer`), que reutiliza la misma posición/composición sin
 * importar el `status`. Antes Reabrir vivía aquí junto a las utilitarias,
 * pero eso hacía que Borrador → Finalizada reorganizara visualmente la
 * cabecera entera (el resto de acciones "saltaban" a una fila distinta) —
 * moverlo también al dock resuelve esa inconsistencia: el cambio de estado
 * ahora solo se nota en el dock, nunca aquí arriba. Lo que sí queda fijo
 * aquí, siempre en la misma posición sin importar `status` ni el paso
 * activo, es:
 *   - Descargar Word, Historial, Duplicar — jerarquía visual secundaria/
 *     discreta (nunca compiten con el dock). Un menú "Más acciones"
 *     agrupándolas se probó y se descartó: Descargar Word e Historial son
 *     demasiado frecuentes para esconder, y sin ellas el menú no aportaba
 *     valor. Duplicar, menos frecuente, igual queda aquí como secundario —
 *     con solo 3 acciones utilitarias un overflow no aporta nada.
 *   - El aviso "Finalizada es de solo lectura..." cuando corresponde —
 *     información sobre el documento, no una acción, así que vive junto al
 *     badge de estado, nunca dentro de un contenedor de botones.
 * El stepper ya cubre toda la navegación entre secciones, así que tampoco
 * repite botones cuyo único propósito sería llevar a un paso que ya es un
 * tab — por eso no existe un enlace "Ver Índice Notarial".
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
   * Descargar Word. */
  dirty: boolean;
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
          {/* Información sobre el documento, no una acción — separada a
              propósito de cualquier contenedor de botones (ni aquí ni en
              el dock, que solo aloja el propio Reabrir). */}
          {status === "final" && (
            <p className="mt-2 text-xs text-slate-500">
              Finalizada es de solo lectura. No significa firmada,
              presentada ni enviada oficialmente.
            </p>
          )}
        </div>
        {documentId && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
