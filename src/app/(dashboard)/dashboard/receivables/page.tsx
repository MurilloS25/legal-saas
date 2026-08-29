import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TablePagination } from "@/components/ui/TablePagination";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WalletIcon } from "@/app/(dashboard)/_components/icons";
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

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">
            Cuentas por cobrar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla los cobros pendientes de tus clientes.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/dashboard/receivables/new"
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
            Nueva cuenta
          </Link>
        )}
      </div>

      {/* Totales por moneda (sobre todos los resultados filtrados) — el
          saldo pendiente es la cifra jerárquicamente dominante: es la que
          más le importa a un notario al abrir esta pantalla. */}
      {page.totals.length > 0 && (
        <section
          aria-label="Totales por moneda"
          className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {page.totals.map((t) => (
            <Card key={t.currency} padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                    <WalletIcon className="size-4" />
                  </div>
                  <p className="text-sm font-semibold text-ink-900">
                    {t.currency === "CRC" ? "Colones" : "Dólares"}{" "}
                    <span className="font-mono text-xs font-normal text-slate-400">
                      ({t.currency})
                    </span>
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {t.count === 1 ? "1 cuenta" : `${t.count} cuentas`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-5 py-4">
                <div>
                  <dt className="text-xs text-slate-500">Total</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular-nums text-slate-700">
                    {formatMoney(t.total, t.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pagado</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular-nums text-emerald-700">
                    {formatMoney(t.paid, t.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Saldo</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink-900">
                    {formatMoney(t.balance, t.currency)}
                  </dd>
                </div>
              </div>
            </Card>
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
        }}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        statusOptions={STATUS_OPTIONS}
        currencyOptions={CURRENCY_OPTIONS}
        sortOptions={SORT_OPTIONS}
        hasActiveFilters={query.hasActiveFilters}
      />

      {page.rows.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="size-5" />}
          title={
            query.hasActiveFilters
              ? "Ninguna cuenta coincide con los filtros"
              : "Aún no hay cuentas por cobrar"
          }
          description={
            query.hasActiveFilters
              ? "Ajusta o limpia los filtros para ver más resultados."
              : "Registra un cobro pendiente asociado a un cliente."
          }
          className="py-16"
          action={
            !query.hasActiveFilters && canWrite ? (
              <Link
                href="/dashboard/receivables/new"
                className="press-feedback inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
              >
                Agregar cuenta
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ReceivablesTable rows={page.rows} />

          <TablePagination
            page={page.page}
            pageCount={page.pageCount}
            countLabel={
              page.totalCount === 1 ? "1 cuenta" : `${page.totalCount} cuentas`
            }
            pageHref={pageHref}
          />
        </Card>
      )}
    </PageContainer>
  );
}
