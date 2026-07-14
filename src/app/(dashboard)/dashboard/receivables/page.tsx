import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { listReceivables } from "./queries";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
} from "@/lib/receivables/status";

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

export default async function ReceivablesPage() {
  const receivables = await listReceivables();

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Cuentas por cobrar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla los cobros pendientes de tus clientes.
          </p>
        </div>
        <Link
          href="/dashboard/receivables/new"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0 ml-4"
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
      </div>

      {receivables.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no hay cuentas por cobrar
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Registra un cobro pendiente asociado a un cliente.
          </p>
          <Link
            href="/dashboard/receivables/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Agregar cuenta
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ul role="list" className="divide-y divide-slate-100">
            {receivables.map((r) => (
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
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {receivables.length === 1
                ? "1 cuenta"
                : `${receivables.length} cuentas`}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
