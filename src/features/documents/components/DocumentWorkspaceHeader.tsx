"use client";

/**
 * Encabezado del workspace de una Escritura — creación y edición: breadcrumb,
 * título/estado en vivo, y el stepper horizontal de navegación entre
 * Completar / Revisar y finalizar / Cobro / Índice.
 *
 * El stepper es la vista principal desde que se inicia una Escritura nueva:
 * no existe un flujo alternativo de una sola página para el modo creación.
 * "Completar" y "Revisar y finalizar" operan sobre estado local puro para
 * su parte de revisión y son siempre navegables — la finalización en sí
 * (dentro de ese mismo paso) requiere que la Escritura ya exista. "Cobro"
 * requiere que la Escritura ya exista (`documentId`) y queda bloqueado
 * hasta el primer guardado. "Índice" tiene además su restricción de
 * siempre: permanece bloqueado hasta que la escritura esté finalizada, aun
 * después de existir.
 *
 * El compositor (valores, cliente, dirty) permanece montado en todo momento
 * — cambiar de sección solo cambia qué panel es visible — así que ir de
 * Completar a Revisar y de vuelta nunca reinicia el formulario ni descarta
 * cambios sin guardar, tanto antes como después del primer guardado. La URL
 * se mantiene sincronizada (`history.pushState`) igual que en el workspace
 * de Machotes.
 *
 * Historial y Duplicar no son pasos del flujo — son acciones independientes
 * que se muestran junto al título, y solo tienen sentido una vez que la
 * Escritura existe.
 */

import Link from "next/link";
import { HorizontalStepper, type StepStatus } from "@/components/document/HorizontalStepper";
import { documentStatusBadgeClass, documentStatusLabel } from "../model/status";
import type { DocumentActivityPage } from "../server/activity-queries";
import { DocumentHistoryDialog } from "./DocumentHistoryDialog";
import { DuplicateDocumentButton } from "./DuplicateDocumentButton";

export type DocumentWorkspaceSection =
  | "completar"
  | "revisar"
  | "cobro"
  | "notarial";

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
    id: "revisar",
    label: "Revisar y finalizar",
    description: "Revisa el documento completo y finaliza la escritura cuando esté lista.",
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
  status: string;
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
   * "Índice" mantiene su comportamiento actual (sin check) — no forma
   * parte de este ajuste.
   */
  completarComplete?: boolean;
  cobroComplete?: boolean;
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
}: Props) {
  const persisted = !!documentId;
  const notarialUnlocked = persisted && status === "final";
  const completion: Record<DocumentWorkspaceSection, boolean> = {
    completar: completarComplete,
    revisar: status === "final",
    cobro: cobroComplete,
    notarial: false,
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
          <div className="flex items-center gap-2 shrink-0">
            {canDuplicate && (
              <DuplicateDocumentButton
                documentId={documentId}
                documentTitle={title}
                variant="full"
              />
            )}
            <DocumentHistoryDialog
              documentId={documentId}
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
