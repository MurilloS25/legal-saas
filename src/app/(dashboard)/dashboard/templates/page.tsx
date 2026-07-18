import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { listTemplates } from "@/features/templates/server";
import { TemplatesTable } from "@/features/templates";

export const metadata = {
  title: "Machotes — LexCR",
};

// ------------------------------------------------------------------ page

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Machotes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra y organiza tus plantillas legales reutilizables.
          </p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0 ml-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo machote
        </Link>
      </div>

      {/* ---- empty state ---- */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no tienes machotes registrados
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Crea tu primer machote para empezar a gestionar tus plantillas legales.
          </p>
          <Link
            href="/dashboard/templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Crear machote
          </Link>
        </div>
      ) : (
        /* ---- templates table ---- */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <TemplatesTable rows={templates} />

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {templates.length === 1
                ? "1 machote registrado"
                : `${templates.length} machotes registrados`}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
