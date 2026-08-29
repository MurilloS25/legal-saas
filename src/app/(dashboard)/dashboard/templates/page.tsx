import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollIcon } from "@/app/(dashboard)/_components/icons";
import Link from "next/link";
import { listTemplatesPage } from "@/features/templates/server";
import {
  TemplatesTable,
  parseTemplatesQuery,
  templatesQueryToParams,
  TEMPLATES_PAGE_SIZE,
  type RawTemplatesQuery,
} from "@/features/templates";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

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

  const pageHref = (targetPage: number) => {
    const params = templatesQueryToParams({ page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/templates?${qs}` : "/dashboard/templates";
  };

  if (page.total > 0 && query.page > page.pageCount) {
    redirect(pageHref(page.pageCount));
  }

  const rangeStart = page.total === 0 ? 0 : (query.page - 1) * TEMPLATES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(query.page * TEMPLATES_PAGE_SIZE, page.total);

  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Machotes</h1>
          <p className="mt-1 text-sm text-ink-400">
            Administra y organiza tus plantillas legales reutilizables.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/dashboard/templates/new"
            className="press-feedback ml-4 inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
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
        )}
      </div>

      {/* ---- empty state ---- */}
      {page.total === 0 ? (
        <EmptyState
          icon={<ScrollIcon className="size-6" />}
          title="Aún no tienes machotes registrados"
          description="Crea tu primer machote para empezar a gestionar tus plantillas legales."
          action={
            canWrite ? (
              <Link
                href="/dashboard/templates/new"
                className="press-feedback inline-flex h-9 items-center justify-center rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
              >
                Crear machote
              </Link>
            ) : undefined
          }
        />
      ) : (
        /* ---- templates table ---- */
        <div className="animate-fade-in rounded-xl border border-ink-100 bg-white shadow-ink-sm overflow-hidden">
          <TemplatesTable rows={page.rows} />

          <TablePagination
            page={query.page}
            pageCount={page.pageCount}
            countLabel={`${rangeStart}–${rangeEnd} de ${page.total}`}
            pageHref={pageHref}
          />
        </div>
      )}
    </PageContainer>
  );
}
