import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import type { ClientRow } from "../model/types";

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
          {/* Column headers — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] px-6 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Cliente
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Cédula
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Ocupación
            </span>
            <span className="w-20" />
          </div>

          <ul role="list" className="divide-y divide-slate-100">
            {clients.map((client) => {
              const initials = getInitials(client.full_name);
              const avatarColor = getAvatarColor(client.full_name);

              return (
                <li key={client.id} className="group">
                  {/*
                   * Row: flex on mobile, grid on desktop.
                   * The client-name column is a <Link> for navigation;
                   * the actions column holds the delete button separately —
                   * this avoids nesting interactive elements inside <a>.
                   */}
                  <div className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    {/* Client name (link to detail) */}
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 rounded"
                    >
                      <div
                        className={`${avatarColor} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white select-none`}
                        aria-hidden="true"
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                          {client.full_name}
                        </p>
                        {/* Sub-line on mobile */}
                        <p className="text-xs text-slate-500 truncate sm:hidden">
                          {client.identification_number} · {client.occupation}
                        </p>
                      </div>
                    </Link>

                    {/* Cédula — desktop */}
                    <span className="hidden sm:block text-sm text-slate-600 truncate">
                      {client.identification_number}
                    </span>

                    {/* Ocupación — desktop */}
                    <span className="hidden sm:block text-sm text-slate-600 truncate">
                      {client.occupation}
                    </span>

                    {/* Secondary visual affordance */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        aria-label={`Ver detalle de ${client.full_name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

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
