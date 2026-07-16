import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import type { ClientRow } from "../model/types";
import { ClientsTable } from "./ClientsTable";

// ------------------------------------------------------------------ page

export function ClientsWorkspace({ clients }: { clients: ClientRow[] }) {
  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Directorio de clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona y reutiliza los datos de tus clientes en los machotes.
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Nuevo cliente
        </Link>
      </div>

      {/* ---- empty state ---- */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no tienes clientes registrados
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Agrega tu primer cliente para reutilizar sus datos en los machotes.
          </p>
          <Link
            href="/dashboard/clients/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Agregar cliente
          </Link>
        </div>
      ) : (
        /* ---- client table ---- */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ClientsTable rows={clients} />

          {/* Row count footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {clients.length === 1
                ? "1 cliente registrado"
                : `${clients.length} clientes registrados`}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
