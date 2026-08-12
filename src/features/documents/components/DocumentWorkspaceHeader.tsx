"use client";

/**
 * Encabezado del workspace de una Escritura: breadcrumb, título/estado en
 * vivo, y el stepper horizontal de navegación entre Completar / Revisar /
 * Cobro / Finalizar / Índice.
 *
 * A diferencia del stepper de Machotes, aquí sí hay una restricción real:
 * "Índice" permanece bloqueado hasta que la escritura esté finalizada
 * (misma regla que la pestaña deshabilitada que existía antes). El resto de
 * los pasos son siempre navegables.
 *
 * El compositor (valores, cliente, dirty) permanece montado en todo momento
 * — cambiar de sección solo cambia qué panel es visible — así que ir de
 * Completar a Revisar y de vuelta nunca reinicia el formulario ni descarta
 * cambios sin guardar. La URL se mantiene sincronizada (`history.pushState`)
 * igual que en el workspace de Machotes.
 *
 * Historial y Duplicar no son pasos del flujo — son acciones independientes
 * que se muestran junto al título, como ya ocurría antes.
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
  | "finalizar"
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
    label: "Revisar",
    description: "Vista de solo lectura del documento completo, tal como quedará.",
  },
  {
    id: "cobro",
    label: "Cobro",
    description: "Cuentas por cobrar asociadas a esta escritura.",
  },
  {
    id: "finalizar",
    label: "Finalizar",
    description: "Revisa el estado y finaliza la escritura cuando esté lista.",
  },
  {
    id: "notarial",
    label: "Índice",
    description: "Datos internos para el Índice Notarial.",
  },
];

type Props = {
  documentId: string;
  title: string;
  clientName: string | null;
  status: string;
  section: DocumentWorkspaceSection;
  saveStatusText: string;
  onSectionChange: (section: DocumentWorkspaceSection) => void;
  activity: DocumentActivityPage;
  canDuplicate: boolean;
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
  canDuplicate,
}: Props) {
  const notarialUnlocked = status === "final";
  const completion: Record<DocumentWorkspaceSection, boolean> = {
    completar: false,
    revisar: false,
    cobro: false,
    finalizar: status === "final",
    notarial: false,
  };

  const steps = STEP_META.map(({ id, label, description }) => {
    const locked = id === "notarial" && !notarialUnlocked;
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
      disabledReason: locked
        ? "Disponible después de finalizar la escritura"
        : undefined,
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
        <div className="flex items-center gap-2 shrink-0">
          {canDuplicate && (
            <DuplicateDocumentButton
              documentId={documentId}
              documentTitle={title}
              variant="full"
            />
          )}
          <DocumentHistoryDialog documentId={documentId} activity={activity} />
        </div>
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
