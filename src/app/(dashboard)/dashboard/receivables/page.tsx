import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listReceivablesWorkspace } from "@/features/receivables/server";
import { listClients } from "@/features/clients/server";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
  RECEIVABLE_STATUS_LABEL,
  RECEIVABLE_CURRENCIES,
} from "@/features/receivables";
import {
  parseReceivablesQuery,
  receivablesQueryToParams,
  RECEIVABLE_SORT_OPTIONS,
  type RawReceivablesQuery,
} from "@/features/receivables";
import { ReceivablesToolbar } from "@/features/receivables";

export const metadata = {
  title: "Cuentas por cobrar — LexCR",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
  "inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0 ml-4";

type Props = {
  searchParams: Promise<RawReceivablesQuery>;
};

export default async function ReceivablesPage({ searchParams }: Props) {
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
          <h1 className="text-2xl font-semibold text-slate-900">
            Cuentas por cobrar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla los cobros pendientes de tus clientes.
          </p>
        </div>
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
                  <dd className="font-semibold text-teal-700">
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
          {!query.hasActiveFilters && (
            <Link
              href="/dashboard/receivables/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Agregar cuenta
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ul role="list" className="divide-y divide-slate-100">
            {page.rows.map((r) => (
              <li key={r.id} className="group">
                <Link
                  href={`/dashboard/receivables/${r.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                      {r.concept}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {r.client_name}
                      {r.document_title ? ` · ${r.document_title}` : ""}
                      {r.due_at ? ` · Vence ${formatDate(r.due_at)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(r.balance_due, r.currency)}
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(r.status)}`}
                    >
                      {receivableStatusLabel(r.status)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {page.totalCount === 1
                ? "1 cuenta"
                : `${page.totalCount} cuentas`}
              {page.pageCount > 1
                ? ` · Página ${page.page} de ${page.pageCount}`
                : ""}
            </p>
            {page.pageCount > 1 && (
              <nav aria-label="Paginación" className="flex items-center gap-2">
                {page.page > 1 ? (
                  <Link
                    href={pageHref(page.page - 1)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
                    Anterior
                  </span>
                )}
                {page.page < page.pageCount ? (
                  <Link
                    href={pageHref(page.page + 1)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
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
