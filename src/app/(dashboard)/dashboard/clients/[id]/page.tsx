import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "../queries";
import { listDocumentsByClient } from "@/features/documents/server";
import { listReceivablesByClient } from "@/features/receivables/server";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
} from "@/features/documents";
import { ClientForm } from "../_components/ClientForm";
import { ReceivableMiniList } from "@/features/receivables";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const metadata = {
  title: "Cliente — LexCR",
};

// ------------------------------------------------------------------ avatar helpers

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-600",
  "bg-sky-600",
  "bg-slate-600",
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const code = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ------------------------------------------------------------------ page

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  const [documents, receivables] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
  ]);
  const initials = getInitials(client.full_name);
  const avatarColor = getAvatarColor(client.full_name);

  return (
    <PageContainer width="form">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/clients"
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
          Clientes
        </Link>
      </nav>

      {/* Client header with avatar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={`${avatarColor} flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white select-none`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {client.full_name}
            </h1>
            <p className="text-sm text-slate-500">
              {client.identification_number}
            </p>
          </div>
        </div>

        <Link
          href={`/dashboard/documents/new?client=${client.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0"
        >
          Nueva escritura
        </Link>
      </div>

      {/* Edit form (delete icon lives in the card header) */}
      <ClientForm mode="edit" client={client} />

      {/* Escrituras asociadas */}
      <section aria-labelledby="client-documents-heading" className="mt-8">
        <h2
          id="client-documents-heading"
          className="text-sm font-semibold text-slate-900 mb-3"
        >
          Escrituras
        </h2>

        {documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              Este cliente todavía no tiene escrituras asociadas.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
          >
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {doc.templates?.name ?? "—"} · Actualizada el{" "}
                    {formatDate(doc.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${documentStatusBadgeClass(doc.status)}`}
                  >
                    {documentStatusLabel(doc.status)}
                  </span>
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  >
                    {doc.status === "final" ? "Ver" : "Continuar"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cuentas por cobrar del cliente */}
      <section aria-label="Cuentas por cobrar del cliente" className="mt-8">
        <ReceivableMiniList
          receivables={receivables}
          newHref={`/dashboard/receivables/new?client=${client.id}`}
          emptyText="Este cliente todavía no tiene cuentas por cobrar."
        />
      </section>
    </PageContainer>
  );
}
