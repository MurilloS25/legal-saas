import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { MARITAL_STATUS_OPTIONS } from "../model/client-schema";

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

function maritalStatusLabel(value: string): string {
  return MARITAL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ------------------------------------------------------------------ page

type Props = {
  client: ClientRow;
  documents: ClientDocumentRow[];
  receivables: ReceivableEntry[];
  role: WorkspaceRole;
  /**
   * Afordancia "Volver a clientes", visible solo en viewports angostos
   * (donde lista y detalle no caben lado a lado — ver `ClientsWorkspace`).
   * En desktop la lista ya está visible al lado, así que no hace falta.
   */
  onBack?: () => void;
  /** Ver `ClientForm` — cierra la selección del panel en vez de navegar. */
  onCancelEdit?: () => void;
};

export function ClientDetail({
  client,
  documents,
  receivables,
  role,
  onBack,
  onCancelEdit,
}: Props) {
  const initials = getInitials(client.full_name);
  const avatarColor = getAvatarColor(client.full_name);
  const canWrite = hasPermission(role, "clients.write");
  const canCreateDocuments = hasPermission(role, "documents.create");
  const canManageReceivables = hasPermission(role, "receivables.manage");

  return (
    <div>
      {/* Volver a la lista — solo mobile/tablet angosto, ver ClientsWorkspace */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-accent-700 focus:outline-none focus-visible:underline lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Clientes
        </button>
      )}

      {/* Client header with avatar + quick facts */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <div
            className={`${avatarColor} flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white shadow-ink-sm select-none`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {client.full_name}
            </h1>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-slate-500">
              {client.identification_number}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{maritalStatusLabel(client.marital_status)}</Badge>
              <Badge tone="neutral">{client.nationality}</Badge>
              <Badge tone="accent">{client.occupation}</Badge>
            </div>
          </div>
        </div>

        {canCreateDocuments && (
          <Link
            href={`/dashboard/documents/new?client=${client.id}`}
            className="press-feedback inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
          >
            Nueva escritura
          </Link>
        )}
      </div>

      {/* Edit form (delete icon lives in the card header) — solo lectura si
          el rol no tiene clients.write (ver ClientForm) */}
      <ClientForm
        mode="edit"
        client={client}
        canWrite={canWrite}
        onCancel={onCancelEdit}
      />

      {/* Escrituras asociadas */}
      <section aria-labelledby="client-documents-heading" className="mt-8">
        <h2
          id="client-documents-heading"
          className="mb-3 text-sm font-semibold text-ink-900"
        >
          Escrituras
        </h2>

        {documents.length === 0 ? (
          <EmptyState title="Este cliente todavía no tiene escrituras asociadas." />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <ClientDocumentsTable rows={documents} />
          </Card>
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
    </div>
  );
}
