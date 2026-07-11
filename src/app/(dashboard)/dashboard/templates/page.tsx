import Link from "next/link";
import { listTemplates } from "./queries";

export const metadata = {
  title: "Machotes — LexCR",
};

// ------------------------------------------------------------------ status badge

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600",
  },
  active: {
    label: "Activo",
    className: "bg-teal-50 text-teal-700",
  },
  archived: {
    label: "Archivado",
    className: "bg-amber-50 text-amber-700",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ------------------------------------------------------------------ date formatter

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ------------------------------------------------------------------ page

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
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
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0 ml-4"
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
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Crear machote
          </Link>
        </div>
      ) : (
        /* ---- templates table ---- */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Column headers — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] px-6 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Machote
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Estado
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actualizado
            </span>
            <span className="w-10" />
          </div>

          <ul role="list" className="divide-y divide-slate-100">
            {templates.map((template) => (
              <li key={template.id} className="group">
                <div className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  {/* Name (link to detail) */}
                  <Link
                    href={`/dashboard/templates/${template.id}`}
                    className="flex min-w-0 flex-1 flex-col focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 rounded"
                  >
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                      {template.name}
                    </p>
                    {template.description && (
                      <p className="text-xs text-slate-500 truncate">
                        {template.description}
                      </p>
                    )}
                    {/* Mobile: sub-info */}
                    <p className="text-xs text-slate-400 sm:hidden mt-0.5">
                      {STATUS_CONFIG[template.status]?.label ?? template.status} ·{" "}
                      {formatDate(template.updated_at)}
                    </p>
                  </Link>

                  {/* Status — desktop */}
                  <span className="hidden sm:flex items-center">
                    <StatusBadge status={template.status} />
                  </span>

                  {/* Updated at — desktop */}
                  <span className="hidden sm:block text-sm text-slate-500">
                    {formatDate(template.updated_at)}
                  </span>

                  {/* Chevron */}
                  <div className="flex items-center shrink-0">
                    <Link
                      href={`/dashboard/templates/${template.id}`}
                      aria-label={`Abrir machote ${template.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>

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
    </div>
  );
}
