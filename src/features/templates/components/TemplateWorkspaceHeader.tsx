"use client";

/**
 * Encabezado del workspace de machotes — creación y edición: breadcrumb,
 * nombre/estado en vivo, y las acciones de cabecera (ej. "Crear escritura").
 *
 * REDISEÑO ESTRUCTURAL (iteración 3): antes este componente también incluía
 * el stepper horizontal de pantalla completa. Ese stepper desapareció — el
 * workspace ahora es de una sola pantalla, con el editor como lienzo
 * persistente y un riel de navegación contextual (`TemplateSectionRail`)
 * junto al panel lateral, no en el encabezado. Este componente queda
 * reducido a identidad + estado, igual que el resto de los encabezados de
 * detalle de la app.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { templateStatusBadgeTone, templateStatusLabel } from "../model/templates";

export type TemplateWorkspaceSection =
  | "information"
  | "document"
  | "variables"
  | "notarial"
  | "publish";

type Props = {
  name: string;
  status: string;
  statusText: string;
  actions?: React.ReactNode;
};

export function TemplateWorkspaceHeader({ name, status, statusText, actions }: Props) {
  return (
    <header className="mb-6">
      <Link
        href="/dashboard/templates"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900 focus:outline-none focus-visible:underline"
      >
        <span aria-hidden="true">‹</span> Machotes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 truncate">
            {name || "Machote sin nombre"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-400">
            <Badge tone={templateStatusBadgeTone(status)}>
              {templateStatusLabel(status)}
            </Badge>
            <span aria-hidden="true">·</span>
            <span>{statusText}</span>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
