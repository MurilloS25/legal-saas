"use client";

/**
 * Encabezado del workspace de machotes — creación y edición: breadcrumb,
 * nombre/estado en vivo, y el stepper horizontal de navegación entre
 * Información / Documento / Variables / Índice notarial / Publicar.
 *
 * El stepper es la vista principal desde que se presiona "Nuevo machote":
 * no existe un flujo alternativo de una sola página para el modo creación.
 * El único paso con una restricción real es "Índice", que requiere que el
 * machote ya exista (`indexLocked`, controlado por `TemplateWorkspace` según
 * si hay un `template.id` persistido) — el resto de los pasos operan sobre
 * estado local y son siempre navegables, tanto antes como después del primer
 * guardado.
 *
 * El editor Tiptap y el formulario de variables permanecen montados en todo
 * momento, así que cambiar de paso nunca reinicia el editor ni descarta
 * cambios sin guardar. La URL se mantiene sincronizada
 * (`history.pushState`) para que atrás/adelante y los enlaces compartidos
 * funcionen igual que en el resto de la app.
 */

import Link from "next/link";
import { HorizontalStepper, type StepStatus } from "@/components/document/HorizontalStepper";
import { templateStatusBadgeClass, templateStatusLabel } from "../model/templates";

export type TemplateWorkspaceSection =
  | "information"
  | "document"
  | "variables"
  | "notarial"
  | "publish";

const STEP_META: Array<{
  id: TemplateWorkspaceSection;
  label: string;
  description: string;
}> = [
  {
    id: "information",
    label: "Información",
    description: "Define el nombre y la descripción del machote.",
  },
  {
    id: "document",
    label: "Documento",
    description: "Redacta el documento e inserta variables donde va la información de cada escritura.",
  },
  {
    id: "variables",
    label: "Variables",
    description: "Revisa que las variables detectadas en el documento estén correctamente configuradas.",
  },
  {
    id: "notarial",
    label: "Índice",
    description: "Opcional: precarga los datos del Índice Notarial para las escrituras que usen este machote.",
  },
  {
    id: "publish",
    label: "Publicar",
    description: "Revisa el resumen y activa el machote cuando esté listo.",
  },
];

type Props = {
  name: string;
  status: string;
  section: TemplateWorkspaceSection;
  statusText: string;
  onSectionChange: (section: TemplateWorkspaceSection) => void;
  /**
   * Señales de completitud reales, calculadas por `TemplateWorkspace` —
   * regla única: cada una es `true` solo cuando ese paso fue confirmado por
   * un guardado exitoso Y su condición propia sigue cumpliéndose ahora
   * mismo (nunca por datos parciales, ni por haber sido simplemente
   * visitado).
   */
  informationComplete: boolean;
  documentComplete: boolean;
  /** true solo cuando hay al menos una variable detectada y ninguna queda
   * "Pendiente de configurar" — un machote sin variables (texto fijo) no
   * cuenta como "completo" aquí: no hay nada que evaluar todavía, así que
   * el paso se ve como cualquier otro paso no visitado, en vez de mostrar
   * un check que no refleja ninguna revisión real. */
  variablesComplete: boolean;
  indexComplete: boolean;
  publishComplete: boolean;
  /** true antes del primer guardado — el machote todavía no existe, así
   * que el Índice (que depende de `template_id`) no puede configurarse. */
  indexLocked: boolean;
  actions?: React.ReactNode;
  /** Intercepta el click en "‹ Machotes" — con cambios sin guardar,
   * `TemplateWorkspace` cancela la navegación y pide confirmación en vez de
   * dejar salir directo del machote. */
  onBackClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function TemplateWorkspaceHeader({
  name,
  status,
  section,
  statusText,
  onSectionChange,
  informationComplete,
  documentComplete,
  variablesComplete,
  indexComplete,
  publishComplete,
  indexLocked,
  actions,
  onBackClick,
}: Props) {
  const completion: Record<TemplateWorkspaceSection, boolean> = {
    information: informationComplete,
    document: documentComplete,
    variables: variablesComplete,
    notarial: indexComplete,
    publish: publishComplete,
  };

  const steps = STEP_META.map(({ id, label, description }) => {
    const locked = id === "notarial" && indexLocked;
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
        ? "Disponible después de guardar el machote por primera vez."
        : undefined,
    };
  });

  return (
    <header className="mb-6">
      <Link
        href="/dashboard/templates"
        onClick={onBackClick}
        className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:underline"
      >
        ‹ Machotes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 truncate">
            {name || "Machote sin nombre"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${templateStatusBadgeClass(status)}`}
            >
              {templateStatusLabel(status)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{statusText}</span>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-6">
        <HorizontalStepper
          steps={steps}
          currentId={section}
          onStepChange={onSectionChange}
          navigationLabel="Pasos del machote"
          idPrefix="template"
        />
      </div>
    </header>
  );
}
