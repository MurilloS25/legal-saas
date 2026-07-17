"use client";

/**
 * Encabezado del workspace de machotes (solo modo edición): breadcrumb,
 * nombre/estado en vivo, y navegación entre Documento / Variables / Índice
 * notarial.
 *
 * A diferencia de `DocumentWorkspaceHeader` (que navega con `<Link>` y
 * recarga la sección desde el servidor), las pestañas aquí cambian de
 * sección con estado de cliente puro: el editor Tiptap y el formulario de
 * variables permanecen montados en todo momento, así que cambiar de
 * pestaña nunca reinicia el editor ni descarta cambios sin guardar. La URL
 * se mantiene sincronizada (`history.pushState`) para que atrás/adelante y
 * los enlaces compartidos funcionen igual que en el resto de la app.
 */

import Link from "next/link";
import { templateStatusBadgeClass, templateStatusLabel } from "../model/templates";

export type TemplateWorkspaceSection = "document" | "variables" | "notarial";

const TABS: Array<{ id: TemplateWorkspaceSection; label: string }> = [
  { id: "document", label: "Documento" },
  { id: "variables", label: "Variables" },
  { id: "notarial", label: "Índice notarial" },
];

type Props = {
  name: string;
  status: string;
  section: TemplateWorkspaceSection;
  statusText: string;
  onSectionChange: (section: TemplateWorkspaceSection) => void;
  actions?: React.ReactNode;
};

export function TemplateWorkspaceHeader({
  name,
  status,
  section,
  statusText,
  onSectionChange,
  actions,
}: Props) {
  return (
    <header className="mb-6">
      <Link
        href="/dashboard/templates"
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
      <nav
        aria-label="Secciones del machote"
        className="mt-6 border-b border-slate-200"
      >
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`template-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`template-panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onSectionChange(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                    return;
                  }
                  event.preventDefault();
                  const currentIndex = TABS.findIndex((t) => t.id === tab.id);
                  const delta = event.key === "ArrowRight" ? 1 : -1;
                  const next =
                    TABS[(currentIndex + delta + TABS.length) % TABS.length];
                  onSectionChange(next.id);
                  document.getElementById(`template-tab-${next.id}`)?.focus();
                }}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 ${
                  active
                    ? "border-teal-700 text-teal-800"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
