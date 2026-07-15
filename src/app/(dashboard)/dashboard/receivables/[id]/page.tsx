import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReceivableEntry,
  getReceivableForEdit,
  listReceivableActivity,
  listPaymentsByReceivable,
  listClientOptions,
  listDocumentOptions,
} from "@/features/receivables/server";
import {
  DeleteReceivableButton,
  PaymentsSection,
  ReceivableForm,
} from "@/features/receivables";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
} from "@/features/receivables";
import {
  formatReceivableActivityEvent,
  formatReceivableActivityTimestamp,
} from "@/features/receivables";

export const metadata = {
  title: "Cuenta por cobrar — LexCR",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReceivableDetailPage({ params }: Props) {
  const { id } = await params;

  const [entry, editable] = await Promise.all([
    getReceivableEntry(id),
    getReceivableForEdit(id),
  ]);

  if (!entry || !editable) notFound();

  const [clients, documents, activity, payments] = await Promise.all([
    listClientOptions(),
    listDocumentOptions(),
    listReceivableActivity(id),
    listPaymentsByReceivable(id),
  ]);

  return (
    <PageContainer width="form">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/receivables"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Cuentas por cobrar
        </Link>
      </nav>

      {/* Header con estado y saldo */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">
              {entry.concept}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(entry.status)}`}
            >
              {receivableStatusLabel(entry.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/dashboard/clients/${entry.client_id}`}
              className="text-teal-700 hover:underline"
            >
              {entry.client_name}
            </Link>
            {entry.document_title && (
              <>
                {" · "}
                <Link
                  href={`/dashboard/documents/${entry.document_id}`}
                  className="text-teal-700 hover:underline"
                >
                  {entry.document_title}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0">
          <DeleteReceivableButton
            receivableId={entry.id}
            concept={entry.concept}
          />
        </div>
      </div>

      {/* Resumen de montos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Monto total</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.amount_total, entry.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pagado</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.paid_amount, entry.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Saldo pendiente</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.balance_due, entry.currency)}
          </p>
        </div>
      </div>

      {/* Pagos */}
      <PaymentsSection
        receivableId={entry.id}
        currency={entry.currency}
        balanceDue={entry.balance_due}
        status={entry.status}
        payments={payments}
      />

      {/* Formulario de edición */}
      <section aria-labelledby="receivable-edit-heading" className="mt-8">
        <h2
          id="receivable-edit-heading"
          className="text-sm font-semibold text-slate-900 mb-3"
        >
          Editar cuenta
        </h2>
        <ReceivableForm
          mode="edit"
          receivable={editable}
          clients={clients}
          documents={documents}
        />
      </section>

      {/* Historial */}
      <section aria-labelledby="receivable-activity-heading" className="mt-8">
        <h2
          id="receivable-activity-heading"
          className="text-sm font-semibold text-slate-900 mb-3"
        >
          Historial
        </h2>

        {activity.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">Todavía no hay actividad.</p>
          </div>
        ) : (
          <ol
            role="list"
            className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
          >
            {activity.map((event) => {
              const formatted = formatReceivableActivityEvent(
                event,
                entry.currency,
              );
              return (
                <li key={event.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {formatted.title}
                      </p>
                      {formatted.lines.map((line, i) => (
                        <p key={i} className="text-xs text-slate-500">
                          {line}
                        </p>
                      ))}
                    </div>
                    <time
                      dateTime={event.created_at}
                      className="shrink-0 text-xs text-slate-400"
                    >
                      {formatReceivableActivityTimestamp(event.created_at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Metadatos */}
      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Emitida</dt>
          <dd className="text-slate-900">{formatDate(entry.issued_at)}</dd>
        </div>
        {entry.due_at && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Vence</dt>
            <dd className="text-slate-900">{formatDate(entry.due_at)}</dd>
          </div>
        )}
      </dl>
    </PageContainer>
  );
}
