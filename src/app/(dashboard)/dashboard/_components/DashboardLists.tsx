import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, SparkIcon } from "@/components/icons";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
} from "@/features/documents";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
  type ReceivableEntry,
} from "@/features/receivables";
import {
  daysUntil,
  relativeTime,
} from "../_lib/dashboard-presenters";

type RecentDocument = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  clients: { full_name: string } | null;
  templates: { name: string } | null;
};

export function DashboardLists({
  attentionReceivables,
  recentDocuments,
  now,
  canCreateDocuments,
}: {
  attentionReceivables: ReceivableEntry[];
  recentDocuments: RecentDocument[];
  now: Date;
  canCreateDocuments: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AttentionReceivables receivables={attentionReceivables} now={now} />
      <RecentDocuments
        documents={recentDocuments}
        now={now}
        canCreateDocuments={canCreateDocuments}
      />
    </div>
  );
}

function AttentionReceivables({
  receivables,
  now,
}: {
  receivables: ReceivableEntry[];
  now: Date;
}) {
  return (
    <section
      aria-labelledby="attention-heading"
      className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-1"
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 id="attention-heading" className="text-sm font-semibold text-slate-900">
          Necesita tu atención
        </h2>
      </div>
      {receivables.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <CheckCircleIcon className="size-6 text-emerald-600" />
          <p className="text-sm text-slate-500">
            No hay cuentas vencidas ni próximas a vencer.
          </p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-slate-100">
          {receivables.map((receivable) => {
            const days = receivable.due_at
              ? daysUntil(receivable.due_at, now)
              : null;
            return (
              <li key={receivable.id}>
                <Link
                  href={`/receivables/${receivable.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {receivable.concept}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {receivable.client_name} · {" "}
                      {formatMoney(
                        receivable.balance_due,
                        receivable.currency,
                      )}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(receivable.status)}`}
                  >
                    {days !== null && days < 0
                      ? receivableStatusLabel(receivable.status)
                      : days === 0
                        ? "Hoy"
                        : days !== null
                          ? `${days} d`
                          : receivableStatusLabel(receivable.status)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-slate-100 px-5 py-3">
        <Link
          href="/receivables"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
        >
          Ver cuentas por cobrar <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

function RecentDocuments({
  documents,
  now,
  canCreateDocuments,
}: {
  documents: RecentDocument[];
  now: Date;
  canCreateDocuments: boolean;
}) {
  return (
    <section
      aria-labelledby="recent-heading"
      className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 id="recent-heading" className="text-sm font-semibold text-slate-900">
          Escrituras recientes
        </h2>
        <Link
          href="/documents"
          className="text-xs font-medium text-accent-700 hover:underline"
        >
          Ver todas
        </Link>
      </div>
      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <SparkIcon className="size-6 text-slate-300" />
          <p className="text-sm text-slate-500">
            Aún no has creado ninguna escritura.
          </p>
          {canCreateDocuments && (
            <Link
              href="/documents/new"
              className="text-xs font-medium text-accent-700 hover:underline"
            >
              Crear la primera →
            </Link>
          )}
        </div>
      ) : (
        <ul role="list" className="divide-y divide-slate-100">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                href={`/documents/${document.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {document.title}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {document.clients?.full_name ?? "Sin cliente"} · {" "}
                    {document.templates?.name ?? "Machote eliminado"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${documentStatusBadgeClass(document.status)}`}
                  >
                    {documentStatusLabel(document.status)}
                  </span>
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    {relativeTime(document.updated_at, now)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
