import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { ClientDocumentsTable } from "@/features/documents";
import type { ClientDocumentRow } from "@/features/documents/server";
import {
  ReceivableMiniList,
  type ReceivableEntry,
} from "@/features/receivables";
import type { ClientRow } from "../model/types";
import { ClientForm } from "./ClientForm";
import { hasPermission, type WorkspaceRole } from "@/lib/server/permissions";

// ------------------------------------------------------------------ avatar helpers

const AVATAR_COLORS = [
  "bg-accent-600",
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
  client: ClientRow;
  documents: ClientDocumentRow[];
  receivables: ReceivableEntry[];
  role: WorkspaceRole;
};

export function ClientDetail({ client, documents, receivables, role }: Props) {
  const initials = getInitials(client.full_name);
  const avatarColor = getAvatarColor(client.full_name);
  const canWrite = hasPermission(role, "clients.write");
  const canCreateDocuments = hasPermission(role, "documents.create");
  const canManageReceivables = hasPermission(role, "receivables.manage");

  return (
    <PageContainer>
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

        {canCreateDocuments && (
          <Link
            href={`/dashboard/documents/new?client=${client.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0"
          >
            Nueva escritura
          </Link>
        )}
      </div>

      {/* Edit form (delete icon lives in the card header) — solo lectura si
          el rol no tiene clients.write (ver ClientForm) */}
      <ClientForm mode="edit" client={client} canWrite={canWrite} />

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
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <ClientDocumentsTable rows={documents} />
          </div>
        )}
      </section>

      {/* Cuentas por cobrar del cliente */}
      <section aria-label="Cuentas por cobrar del cliente" className="mt-8">
        <ReceivableMiniList
          receivables={receivables}
          newHref={
            canManageReceivables
              ? `/dashboard/receivables/new?client=${client.id}`
              : undefined
          }
          emptyText="Este cliente todavía no tiene cuentas por cobrar."
        />
      </section>
    </PageContainer>
  );
}
