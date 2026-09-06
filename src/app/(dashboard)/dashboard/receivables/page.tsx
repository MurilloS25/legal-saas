import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TablePagination } from "@/components/ui/TablePagination";
import { listReceivablesWorkspace } from "@/features/receivables/server";
import { listClients } from "@/features/clients/server";
import {
  formatMoney,
  RECEIVABLE_STATUS_LABEL,
  RECEIVABLE_CURRENCIES,
} from "@/features/receivables";
import {
  parseReceivablesQuery,
  receivablesQueryToParams,
  RECEIVABLE_SORT_OPTIONS,
  type RawReceivablesQuery,
} from "@/features/receivables";
import { ReceivablesToolbar, ReceivablesTable } from "@/features/receivables";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { buildPageSizeOptions, type PageSizeOption } from "@/lib/pagination";

export const metadata = {
  title: "Cuentas por cobrar — LexCR",
};

const STATUS_OPTIONS = Object.entries(RECEIVABLE_STATUS_LABEL).map(
  ([value, label]) => ({ value, label }),
);

const CURRENCY_OPTIONS = RECEIVABLE_CURRENCIES.map((c) => ({
  value: c,
  label: c === "CRC" ? "Colones (CRC)" : "Dólares (USD)",
}));

const SORT_OPTIONS = RECEIVABLE_SORT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const newButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0 ml-4";

type Props = {
  searchParams: Promise<RawReceivablesQuery>;
};

export default async function ReceivablesPage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  const canWrite = hasPermission(role, "receivables.manage");
  const query = parseReceivablesQuery(await searchParams);

  const [page, clients] = await Promise.all([
    listReceivablesWorkspace(query),
    listClients(),
  ]);

  if (page.totalCount > 0 && query.page > page.pageCount) {
    const params = receivablesQueryToParams({ ...query, page: page.pageCount });
    const qs = new URLSearchParams(params).toString();
    redirect(qs ? `/dashboard/receivables?${qs}` : "/dashboard/receivables");
  }

  function pageHref(n: number): string {
    const params = receivablesQueryToParams({ ...query, page: n });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/receivables?${qs}` : "/dashboard/receivables";
  }

  const pageSizeOptions = buildPageSizeOptions((pageSize: PageSizeOption) => {
    const params = receivablesQueryToParams({ ...query, page: 1, pageSize });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/receivables?${qs}` : "/dashboard/receivables";
  });

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Cuentas por cobrar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla los cobros pendientes de tus clientes.
          </p>
        </div>
        {canWrite && (
          <Link href="/dashboard/receivables/new" className={newButtonClass}>
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
            Nueva cuenta
          </Link>
        )}
      </div>

      {/* Totales por moneda (sobre todos los resultados filtrados) */}
      {page.totals.length > 0 && (
        <section
          aria-label="Totales por moneda"
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {page.totals.map((t) => (
            <div
              key={t.currency}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {t.currency === "CRC" ? "Colones" : "Dólares"} ({t.currency})
                </p>
                <span className="text-xs text-slate-500">
                  {t.count === 1 ? "1 cuenta" : `${t.count} cuentas`}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Total</dt>
                  <dd className="font-medium text-slate-900">
                    {formatMoney(t.total, t.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pagado</dt>
                  <dd className="font-medium text-slate-900">
                    {formatMoney(t.paid, t.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Saldo</dt>
                  <dd className="font-semibold text-accent-700">
                    {formatMoney(t.balance, t.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </section>
      )}

      <ReceivablesToolbar
        initial={{
          search: query.search,
          status: query.status,
          currency: query.currency,
          docPresence: query.docPresence,
          clientId: query.clientId,
          issuedFrom: query.issuedFrom,
          issuedTo: query.issuedTo,
          dueFrom: query.dueFrom,
          dueTo: query.dueTo,
          sort: query.sort,
          pageSize: query.pageSize,
        }}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        statusOptions={STATUS_OPTIONS}
        currencyOptions={CURRENCY_OPTIONS}
        sortOptions={SORT_OPTIONS}
        hasActiveFilters={query.hasActiveFilters}
      />

      {page.rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            {query.hasActiveFilters
              ? "Ninguna cuenta coincide con los filtros"
              : "Aún no hay cuentas por cobrar"}
          </p>
          <p className="text-xs text-slate-500 mb-6">
            {query.hasActiveFilters
              ? "Ajusta o limpia los filtros para ver más resultados."
              : "Registra un cobro pendiente asociado a un cliente."}
          </p>
          {!query.hasActiveFilters && canWrite && (
            <Link
              href="/dashboard/receivables/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
            >
              Agregar cuenta
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ReceivablesTable rows={page.rows} />

          <TablePagination
            page={page.page}
            pageCount={page.pageCount}
            countLabel={
              page.totalCount === 1 ? "1 cuenta" : `${page.totalCount} cuentas`
            }
            pageHref={pageHref}
            pageSize={query.pageSize}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </PageContainer>
  );
}
