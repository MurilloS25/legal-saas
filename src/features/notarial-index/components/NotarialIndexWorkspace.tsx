import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { NotarialToolbar } from "./NotarialToolbar";
import { NotarialIndexTable } from "./NotarialIndexTable";
import { NotarialExportButton } from "./NotarialExportButton";
import {
  NOTARIAL_PAGE_SIZE,
  notarialQueryToParams,
  type NotarialQuery,
} from "../model/query";
import { formatCostaRicaDate } from "../model/datetime";
import type { NotarialIndexPage } from "../server/workspace-queries";

type Props = {
  query: NotarialQuery;
  page: NotarialIndexPage;
  actTypes: string[];
  lastExportAt: string | null;
  warnings: { incompleteCount: number; missingFields: string[] };
  canGenerate: boolean;
};

export function NotarialIndexWorkspace({
  query,
  page,
  actTypes,
  lastExportAt,
  warnings,
  canGenerate,
}: Props) {
  const periodParams = {
    year: String(query.selection.year),
    month: String(query.selection.month),
    half: query.selection.half,
  };
  const exportParams = notarialQueryToParams({ ...query, page: 1 });
  const exportQs = new URLSearchParams(exportParams).toString();
  const periodQs = new URLSearchParams(periodParams).toString();
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
        {canGenerate && <NotarialExportButton href={exportHref} />}
      </div>

      {!canGenerate && (
        <div
          role="status"
          className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
        >
          Tu rol no permite generar el índice notarial. Solo el propietario o
          un administrador puede exportarlo.
        </div>
      )}

      <div
        role="note"
        className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
      >
        Vista interna para organización y revisión. No sustituye el índice
        oficial ni su presentación ante autoridades.
      </div>

      <NotarialToolbar
        key={query.search}
        initial={{
          search: query.search,
          completeness: query.completeness,
          actType: query.actType,
          selection: query.selection,
        }}
        actTypes={actTypes}
        hasActiveFilters={query.hasActiveFilters}
      />

      {warnings.incompleteCount > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">
            {warnings.incompleteCount} registro
            {warnings.incompleteCount === 1 ? " incompleto" : "s incompletos"}
          </p>
          <p className="mt-1">
            Faltan: {warnings.missingFields.join(", ")}. El Word se puede
            generar, pero puede requerir edición posterior.
          </p>
        </div>
      )}

      {page.total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          {query.hasActiveFilters ? (
            <>
              <p className="text-sm font-medium text-slate-900 mb-1">
                No hay escrituras finalizadas con esos filtros
              </p>
              <Link
                href={`/dashboard/notarial-index?${periodQs}`}
                className="mt-4 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
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
          <NotarialIndexTable
            rows={page.rows}
            query={query}
            pageCount={page.pageCount}
            total={page.total}
          />

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
