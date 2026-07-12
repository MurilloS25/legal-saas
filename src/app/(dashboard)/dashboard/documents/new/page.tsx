import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { listTemplates } from "../../templates/queries";

export const metadata = {
  title: "Nueva escritura — LexCR",
};

// ------------------------------------------------------------------ helpers

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ------------------------------------------------------------------ page

export default async function NewDocumentTemplatePickerPage() {
  const templates = await listTemplates();

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
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
          Escrituras
        </Link>
      </nav>

      {/* ---- header ---- */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Nueva escritura
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona el machote que servirá de base para la escritura.
        </p>
      </div>

      {/* ---- empty state ---- */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no tienes machotes disponibles
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Para crear una escritura primero necesitas un machote con sus
            campos configurados.
          </p>
          <Link
            href="/dashboard/templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Crear machote
          </Link>
        </div>
      ) : (
        /* ---- available templates ---- */
        <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {template.name}
                </h2>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 shrink-0">
                  {STATUS_LABEL[template.status] ?? template.status}
                </span>
              </div>

              {template.description && (
                <p className="text-xs text-slate-500 leading-relaxed mb-2">
                  {template.description}
                </p>
              )}

              <p className="text-xs text-slate-400 mb-4">
                Actualizado el {formatDate(template.updated_at)}
              </p>

              <div className="mt-auto">
                <Link
                  href={`/dashboard/documents/new/${template.id}`}
                  className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
                >
                  Usar este machote
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
