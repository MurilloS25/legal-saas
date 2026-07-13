import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { listDocumentsPage } from "./queries";
import { listClients } from "../clients/queries";
import { listTemplates } from "../templates/queries";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
  DOCUMENT_STATUS_LABEL,
} from "@/lib/documents/status";
import {
  DOCUMENT_SORT_OPTIONS,
  DOCUMENTS_PAGE_SIZE,
  documentsQueryToParams,
  parseDocumentsQuery,
  type RawDocumentsQuery,
} from "@/lib/documents/workspace-query";
import { DocumentsToolbar } from "./_components/DocumentsToolbar";
import { DeleteDocumentButton } from "./_components/DeleteDocumentButton";
import { DownloadDocxButton } from "./_components/DownloadDocxButton";

export const metadata = {
  title: "Escrituras — LexCR",
};

// ------------------------------------------------------------------ helpers

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const newDocumentButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors";

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
    listTemplates(),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, full_name: c.full_name }));
  const templateOptions = templates.map((t) => ({ id: t.id, name: t.name }));

  const pageHref = (targetPage: number) => {
    const params = documentsQueryToParams({ ...query, page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/documents?${qs}` : "/dashboard/documents";
  };

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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
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
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Escritura
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Cliente
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Machote
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Estado
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actualizada
            </span>
            <span className="w-40" />
          </div>

          <ul role="list" className="divide-y divide-slate-100">
            {page.rows.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 px-6 py-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3 hover:bg-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 truncate">
                  {doc.title}
                </p>

                <p className="text-sm text-slate-500 truncate">
                  {doc.clients?.full_name ?? (
                    <span className="text-slate-400">Sin cliente</span>
                  )}
                </p>

                <p className="text-sm text-slate-500 truncate">
                  {doc.templates?.name ?? "—"}
                </p>

                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${documentStatusBadgeClass(doc.status)}`}
                >
                  {documentStatusLabel(doc.status)}
                </span>

                <p className="text-sm text-slate-500">
                  {formatDate(doc.updated_at)}
                </p>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  >
                    {doc.status === "final" ? "Ver" : "Continuar"}
                  </Link>
                  <DownloadDocxButton
                    documentId={doc.id}
                    disabled={false}
                    pendingVariableCount={doc.pendingVariableCount}
                    variant="compact"
                    ariaLabel={`Descargar Word de ${doc.title}`}
                  />
                  <DeleteDocumentButton
                    documentId={doc.id}
                    documentTitle={doc.title}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {`${rangeStart}–${rangeEnd} de ${page.total}`}
            </p>
            {page.pageCount > 1 && (
              <nav aria-label="Paginación" className="flex items-center gap-2">
                {query.page > 1 ? (
                  <Link
                    href={pageHref(query.page - 1)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">
                    Anterior
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Página {query.page} de {page.pageCount}
                </span>
                {query.page < page.pageCount ? (
                  <Link
                    href={pageHref(query.page + 1)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">
                    Siguiente
                  </span>
                )}
              </nav>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
