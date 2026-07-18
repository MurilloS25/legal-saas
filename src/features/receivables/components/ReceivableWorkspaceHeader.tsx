"use client";

/**
 * Encabezado del detalle de una cuenta por cobrar: breadcrumb, concepto +
 * estado, cliente/escritura, acciones (Historial, Eliminar) y navegación
 * entre Datos de la cuenta / Pagos.
 *
 * Igual que `TemplateWorkspaceHeader`: las pestañas cambian de sección con
 * estado de cliente puro (la URL se sincroniza vía `history.pushState`),
 * así que cambiar de pestaña nunca reinicia el formulario ni la tabla de
 * pagos.
 */

import Link from "next/link";

export type ReceivableWorkspaceSection = "account" | "payments";

const TABS: Array<{ id: ReceivableWorkspaceSection; label: string }> = [
  { id: "account", label: "Datos de la cuenta" },
  { id: "payments", label: "Pagos" },
];

type Props = {
  concept: string;
  statusBadge: React.ReactNode;
  clientName: string;
  /** Solo existe para un Cliente registrado; nombre libre no navega a nada. */
  clientId: string | null;
  documentTitle: string | null;
  documentId: string | null;
  section: ReceivableWorkspaceSection;
  onSectionChange: (section: ReceivableWorkspaceSection) => void;
  actions?: React.ReactNode;
};

export function ReceivableWorkspaceHeader({
  concept,
  statusBadge,
  clientName,
  clientId,
  documentTitle,
  documentId,
  section,
  onSectionChange,
  actions,
}: Props) {
  return (
    <header className="mb-6">
      <Link
        href="/dashboard/receivables"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Cuentas por cobrar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900 truncate">
              {concept}
            </h1>
            {statusBadge}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {clientId ? (
              <Link
                href={`/dashboard/clients/${clientId}`}
                className="text-accent-700 hover:underline"
              >
                {clientName}
              </Link>
            ) : (
              <span>{clientName}</span>
            )}
            {documentTitle && documentId && (
              <>
                {" · "}
                <Link
                  href={`/dashboard/documents/${documentId}`}
                  className="text-accent-700 hover:underline"
                >
                  {documentTitle}
                </Link>
              </>
            )}
          </p>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      <nav
        aria-label="Secciones de la cuenta"
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
                id={`receivable-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`receivable-panel-${tab.id}`}
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
                  document.getElementById(`receivable-tab-${next.id}`)?.focus();
                }}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500 ${
                  active
                    ? "border-accent-700 text-accent-800"
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
