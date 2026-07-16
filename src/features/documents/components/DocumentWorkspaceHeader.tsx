import Link from "next/link";
import type { DocumentActivityPage } from "../server/activity-queries";
import { documentStatusBadgeClass, documentStatusLabel } from "../model/status";
import { DocumentHistoryDialog } from "./DocumentHistoryDialog";

export type DocumentWorkspaceSection = "document" | "receivables" | "notarial";

type Props = {
  documentId: string;
  title: string;
  clientName: string | null;
  status: string;
  section: DocumentWorkspaceSection;
  savedJustNow: boolean;
  activity: DocumentActivityPage;
};

export function DocumentWorkspaceHeader({
  documentId,
  title,
  clientName,
  status,
  section,
  savedJustNow,
  activity,
}: Props) {
  const base = `/dashboard/documents/${documentId}`;
  const tabs: Array<{ id: DocumentWorkspaceSection; label: string; enabled: boolean }> = [
    { id: "document", label: "Documento", enabled: true },
    { id: "receivables", label: "Cuentas por cobrar", enabled: true },
    { id: "notarial", label: "Índice notarial", enabled: status === "final" },
  ];

  return (
    <header className="mb-6">
      <Link
        href="/dashboard/documents"
        className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:underline"
      >
        ‹ Volver a Escrituras
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${documentStatusBadgeClass(status)}`}
            >
              {documentStatusLabel(status)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{savedJustNow ? "Guardado hace unos segundos" : "Guardado"}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Cliente: {clientName ?? "Sin cliente"}
          </p>
        </div>
        <DocumentHistoryDialog documentId={documentId} activity={activity} />
      </div>
      <nav aria-label="Secciones de la escritura" className="mt-6 border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) =>
            tab.enabled ? (
              <Link
                key={tab.id}
                href={tab.id === "document" ? base : `${base}?section=${tab.id}`}
                aria-current={section === tab.id ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 ${
                  section === tab.id
                    ? "border-teal-700 text-teal-800"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </Link>
            ) : (
              <span
                key={tab.id}
                aria-disabled="true"
                title="Disponible después de finalizar la escritura"
                className="cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-400"
              >
                {tab.label}
              </span>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}
