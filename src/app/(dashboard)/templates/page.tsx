import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import Link from "next/link";
import {
  getAiTemplateGenerationAvailability,
  listTemplatesPage,
} from "@/features/templates/server";
import {
  CreateWithAiButton,
  TemplatesTable,
  parseTemplatesQuery,
  templatesQueryToParams,
  type RawTemplatesQuery,
} from "@/features/templates";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { buildPageSizeOptions, type PageSizeOption } from "@/lib/pagination";

export const metadata = {
  title: "Machotes — LexCR",
};

// ------------------------------------------------------------------ page

type Props = {
  searchParams: Promise<RawTemplatesQuery>;
};

export default async function TemplatesPage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  const canWrite = hasPermission(role, "templates.write");
  const query = parseTemplatesQuery(await searchParams);
  const page = await listTemplatesPage(query);
  const aiLimits = canWrite ? getAiTemplateGenerationAvailability() : null;

  const pageHref = (targetPage: number) => {
    const params = templatesQueryToParams({ page: targetPage, pageSize: query.pageSize });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/templates?${qs}` : "/templates";
  };

  const pageSizeOptions = buildPageSizeOptions((pageSize: PageSizeOption) => {
    const params = templatesQueryToParams({ page: 1, pageSize });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/templates?${qs}` : "/templates";
  });

  if (page.total > 0 && query.page > page.pageCount) {
    redirect(pageHref(page.pageCount));
  }

  const rangeStart = page.total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const rangeEnd = Math.min(query.page * query.pageSize, page.total);

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
        {canWrite && (
          <div className="ml-4 flex shrink-0 flex-wrap justify-end gap-2">
          {aiLimits && <CreateWithAiButton limits={aiLimits} />}
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0"
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
        )}
      </div>

      {/* ---- empty state ---- */}
      {page.total === 0 ? (
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
          {canWrite && (
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/templates/new"
                className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
              >
                Crear machote
              </Link>
              {aiLimits && <CreateWithAiButton limits={aiLimits} />}
            </div>
          )}
        </div>
      ) : (
        /* ---- templates table ---- */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <TemplatesTable rows={page.rows} canDuplicate={canWrite} />

          <TablePagination
            page={query.page}
            pageCount={page.pageCount}
            countLabel={`${rangeStart}–${rangeEnd} de ${page.total}`}
            pageHref={pageHref}
            pageSize={query.pageSize}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </PageContainer>
  );
}
