import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import type { ClientRow } from "../model/types";
import { ClientsTable } from "./ClientsTable";

// ------------------------------------------------------------------ page

type Props = {
  clients: ClientRow[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  pageHref: (page: number) => string;
  canWrite: boolean;
};

// `Button` no soporta un Link como raíz (no hay `asChild`/Slot instalado en
// el repo); estos CTAs navegan, así que replican las clases de la variante
// "accent" de `Button` directamente sobre `<Link>` en vez de forzar un
// `<button onClick>` con navegación imperativa.
const LINK_BUTTON_CLASS =
  "press-feedback inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1";

function NewClientButton({ size = "md" as const }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm";
  return (
    <Link href="/dashboard/clients/new" className={`${LINK_BUTTON_CLASS} ${sizeClass}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
      Nuevo cliente
    </Link>
  );
}

export function ClientsWorkspace({
  clients,
  page,
  pageCount,
  total,
  pageSize,
  pageHref,
  canWrite,
}: Props) {
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Directorio de clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona y reutiliza los datos de tus clientes en los machotes.
          </p>
        </div>
        {canWrite && total > 0 && (
          <div className="mt-1">
            <NewClientButton />
          </div>
        )}
      </div>

      {/* ---- empty state ---- */}
      {total === 0 ? (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="Aún no tienes clientes registrados"
          description="Agrega tu primer cliente para reutilizar sus datos en los machotes."
          action={canWrite ? <NewClientButton size="sm" /> : undefined}
          className="py-20"
        />
      ) : (
        /* ---- client table ---- */
        <Card padding="none" className="overflow-hidden">
          <ClientsTable rows={clients} />

          <TablePagination
            page={page}
            pageCount={pageCount}
            countLabel={`${rangeStart}–${rangeEnd} de ${total}`}
            pageHref={pageHref}
          />
        </Card>
      )}
    </PageContainer>
  );
}
