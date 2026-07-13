import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  listNotarialIndex,
  listNotarialActTypes,
  getLatestNotarialExportAt,
} from "./queries";
import { NotarialToolbar } from "./_components/NotarialToolbar";
import {
  NOTARIAL_PAGE_SIZE,
  NOTARIAL_SORT_OPTIONS,
  notarialQueryToParams,
  parseNotarialQuery,
  type RawNotarialQuery,
} from "@/lib/documents/notarial-query";
import {
  formatCostaRicaDate,
  formatCostaRicaTime,
} from "@/lib/documents/notarial-datetime";

export const metadata = {
  title: "Índice notarial — LexCR",
};

const SORT_OPTIONS = NOTARIAL_SORT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function completenessBadge(row: {
  has_metadata: boolean;
  is_complete: boolean;
}) {
  if (!row.has_metadata) {
    return { label: "Sin datos", className: "bg-slate-100 text-slate-500" };
  }
  return row.is_complete
    ? { label: "Completo", className: "bg-teal-50 text-teal-700 border border-teal-200" }
    : { label: "Incompleto", className: "bg-amber-50 text-amber-800 border border-amber-300" };
}

type Props = {
  searchParams: Promise<RawNotarialQuery>;
};

export default async function NotarialIndexPage({ searchParams }: Props) {
  const query = parseNotarialQuery(await searchParams);
  const [page, actTypes, lastExportAt] = await Promise.all([
    listNotarialIndex(query),
    listNotarialActTypes(),
    getLatestNotarialExportAt(),
  ]);

  if (page.total > 0 && query.page > page.pageCount) {
    const params = notarialQueryToParams({ ...query, page: page.pageCount });
    const qs = new URLSearchParams(params).toString();
    redirect(qs ? `/dashboard/notarial-index?${qs}` : "/dashboard/notarial-index");
  }

  const exportParams = notarialQueryToParams({ ...query, page: 1 });
  const exportQs = new URLSearchParams(exportParams).toString();
  const exportHref = exportQs
    ? `/api/notarial-index/export?${exportQs}`
    : "/api/notarial-index/export";

  const pageHref = (targetPage: number) => {
    const params = notarialQueryToParams({ ...query, page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/notarial-index?${qs}` : "/dashboard/notarial-index";
  };

  const rangeStart = page.total === 0 ? 0 : (query.page - 1) * NOTARIAL_PAGE_SIZE + 1;
  const rangeEnd = Math.min(query.page * NOTARIAL_PAGE_SIZE, page.total);

  return (
    <PageContainer>
      <div className="mb-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Índice notarial
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Escrituras finalizadas y sus datos para el índice.
          </p>
          {lastExportAt && (
            <p className="mt-1 text-xs text-slate-400">
              Última exportación: {formatCostaRicaDate(lastExportAt)}
            </p>
          )}
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0"
        >
          Exportar CSV
        </a>
      </div>

      <div
        role="note"
        className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
      >
        Vista interna para organización y revisión. No sustituye el índice
        oficial ni su presentación ante autoridades.
      </div>

      <NotarialToolbar
        initial={{
          search: query.search,
          completeness: query.completeness,
          actType: query.actType,
          from: query.from,
          to: query.to,
          sort: query.sort,
        }}
        actTypes={actTypes}
        sortOptions={SORT_OPTIONS}
        hasActiveFilters={query.hasActiveFilters}
      />

      {page.total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          {query.hasActiveFilters ? (
            <>
              <p className="text-sm font-medium text-slate-900 mb-1">
                No hay escrituras finalizadas con esos filtros
              </p>
              <Link
                href="/dashboard/notarial-index"
                className="mt-4 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
              >
                Limpiar filtros
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Todavía no hay escrituras finalizadas. Finaliza una escritura para
              que aparezca en el índice.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha y hora</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo de acto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comparecientes</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Completitud</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.rows.map((row) => {
                  const badge = completenessBadge(row);
                  return (
                    <tr key={row.document_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-900 whitespace-nowrap">
                        {row.instrument_number ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {row.authorized_at ? (
                          <>
                            {formatCostaRicaDate(row.authorized_at)}
                            <span className="text-slate-400">
                              {" · "}
                              {formatCostaRicaTime(row.authorized_at)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.act_type ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[16rem] truncate">
                        {row.appearing_parties_summary ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/documents/${row.document_id}`}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                        >
                          Ver escritura
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">{`${rangeStart}–${rangeEnd} de ${page.total}`}</p>
            {page.pageCount > 1 && (
              <nav aria-label="Paginación" className="flex items-center gap-2">
                {query.page > 1 ? (
                  <Link href={pageHref(query.page - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors">
                    Anterior
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">Anterior</span>
                )}
                <span className="text-xs text-slate-500">Página {query.page} de {page.pageCount}</span>
                {query.page < page.pageCount ? (
                  <Link href={pageHref(query.page + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors">
                    Siguiente
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">Siguiente</span>
                )}
              </nav>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
