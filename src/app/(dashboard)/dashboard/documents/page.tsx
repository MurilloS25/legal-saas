import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollIcon } from "@/app/(dashboard)/_components/icons";
import { listDocumentsPage } from "@/features/documents/server";
import { listClients } from "@/features/clients/server";
import { listTemplateOptions } from "@/features/templates/server";
import { DOCUMENT_STATUS_LABEL } from "@/features/documents";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import {
  DOCUMENT_SORT_OPTIONS,
  DOCUMENTS_PAGE_SIZE,
  documentsQueryToParams,
  parseDocumentsQuery,
  type RawDocumentsQuery,
  DocumentsTable,
  DocumentsToolbar,
} from "@/features/documents";

export const metadata = {
  title: "Escrituras — LexCR",
};

// ------------------------------------------------------------------ helpers

const STATUS_OPTIONS = Object.entries(DOCUMENT_STATUS_LABEL).map(
  ([value, label]) => ({ value, label }),
);

const SORT_OPTIONS = DOCUMENT_SORT_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

// ------------------------------------------------------------------ page

type Props = {
  searchParams: Promise<RawDocumentsQuery>;
};

export default async function DocumentsPage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  const canCreate = hasPermission(role, "documents.create");
  const query = parseDocumentsQuery(await searchParams);

  const [page, clients, templates] = await Promise.all([
    listDocumentsPage(query),
    listClients(),
    listTemplateOptions(),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, full_name: c.full_name }));
  const templateOptions = templates.map((t) => ({ id: t.id, name: t.name }));

  const pageHref = (targetPage: number) => {
    const params = documentsQueryToParams({ ...query, page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/documents?${qs}` : "/dashboard/documents";
  };

  if (page.total > 0 && query.page > page.pageCount) {
    redirect(pageHref(page.pageCount));
  }

  const rangeStart =
    page.total === 0 ? 0 : (query.page - 1) * DOCUMENTS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(query.page * DOCUMENTS_PAGE_SIZE, page.total);

  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Escrituras</h1>
          <p className="mt-1 text-sm text-ink-500">
            Busca, filtra y continúa tus escrituras, o crea una nueva a partir
            de un machote.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/documents/new"
            className="press-feedback inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
          >
            Nueva escritura
          </Link>
        )}
      </div>

      {/* ---- toolbar ---- */}
      <DocumentsToolbar
        initial={{
          search: query.search,
          status: query.status,
          clientId: query.clientId,
          templateId: query.templateId,
          sort: query.sort,
        }}
        clients={clientOptions}
        templates={templateOptions}
        statusOptions={STATUS_OPTIONS}
        sortOptions={SORT_OPTIONS}
        hasActiveFilters={query.hasActiveFilters}
      />

      {/* ---- results ---- */}
      {page.total === 0 ? (
        query.hasActiveFilters ? (
          <EmptyState
            icon={<ScrollIcon className="size-5" />}
            title="No encontramos escrituras con esos filtros"
            description="Prueba con otros términos de búsqueda o quita algunos filtros."
            action={
              <Link
                href="/dashboard/documents"
                className="press-feedback inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
                Limpiar filtros
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<ScrollIcon className="size-5" />}
            title="Todavía no has creado escrituras"
            description="Crea tu primera escritura seleccionando un machote y llenando sus datos. El borrador quedará guardado para continuar después."
            action={
              canCreate && (
                <Link
                  href="/dashboard/documents/new"
                  className="press-feedback inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
                >
                  Crear primera escritura
                </Link>
              )
            }
          />
        )
      ) : (
        <Card padding="none" className="overflow-hidden">
          <DocumentsTable rows={page.rows} canWrite={canCreate} />

          <TablePagination
            page={query.page}
            pageCount={page.pageCount}
            countLabel={`${rangeStart}–${rangeEnd} de ${page.total}`}
            pageHref={pageHref}
          />
        </Card>
      )}
    </PageContainer>
  );
}
