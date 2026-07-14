import Link from "next/link";
import type { ReceivableEntry } from "../queries";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
} from "@/lib/receivables/status";

/**
 * Listado compacto de cuentas por cobrar para incrustar en el detalle de un
 * cliente o de una escritura. Server component (sin estado). El enlace de
 * "nueva cuenta" prellena el contexto vía query params.
 */

type Props = {
  receivables: ReceivableEntry[];
  newHref: string;
  emptyText: string;
};

export function ReceivableMiniList({ receivables, newHref, emptyText }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Cuentas por cobrar
        </h2>
        <Link
          href={newHref}
          className="text-sm font-medium text-teal-700 hover:text-teal-800 focus:outline-none focus:underline"
        >
          Nueva cuenta
        </Link>
      </div>

      {receivables.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <ul
          role="list"
          className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
        >
          {receivables.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/receivables/${r.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {r.concept}
                  </p>
                  <p className="text-xs text-slate-500">
                    Saldo {formatMoney(r.balance_due, r.currency)} de{" "}
                    {formatMoney(r.amount_total, r.currency)}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(r.status)}`}
                >
                  {receivableStatusLabel(r.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
