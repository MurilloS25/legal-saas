import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { listDocumentsPage } from "@/features/documents/server";
import { listClients } from "@/features/clients/server";
import { listTemplateOptions } from "@/features/templates/server";
import { DOCUMENT_STATUS_LABEL } from "@/features/documents";
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

const newDocumentButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors";

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
          <h1 className="text-2xl font-semibold text-slate-900">Escrituras</h1>
          <p className="mt-1 text-sm text-slate-500">
            Busca, filtra y continúa tus escrituras, o crea una nueva a partir
            de un machote.
          </p>
        </div>
        <Link href="/dashboard/documents/new" className={newDocumentButtonClass}>
          Nueva escritura
        </Link>
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
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900 mb-1">
              No encontramos escrituras con esos filtros
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Prueba con otros términos de búsqueda o quita algunos filtros.
            </p>
            <Link
              href="/dashboard/documents"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
            >
              Limpiar filtros
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900 mb-1">
              Todavía no has creado escrituras
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Crea tu primera escritura seleccionando un machote y llenando sus
              datos. El borrador quedará guardado para continuar después.
            </p>
            <Link href="/dashboard/documents/new" className={newDocumentButtonClass}>
              Crear primera escritura
            </Link>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <DocumentsTable rows={page.rows} />

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
