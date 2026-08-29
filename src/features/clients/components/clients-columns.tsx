import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { ClientRow } from "../model/types";

export const CLIENTS_COLUMN_LABELS = {
  full_name: "Cliente",
  identification_number: "Cédula",
  occupation: "Ocupación",
  actions: "Acciones",
} as const;

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
  const code = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function createClientsColumns(): ColumnDef<ClientRow>[] {
  return [
    {
      id: "full_name",
      header: CLIENTS_COLUMN_LABELS.full_name,
      accessorFn: (row) => row.full_name,
      cell: ({ row }) => {
        const client = row.original;
        const initials = getInitials(client.full_name);
        const avatarColor = getAvatarColor(client.full_name);
        return (
          <Link
            href={`/dashboard/clients/${client.id}`}
            className="group flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <div
              className={`${avatarColor} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white select-none shadow-ink-sm transition-transform duration-150 ease-out group-hover:scale-105`}
              aria-hidden="true"
            >
              {initials}
            </div>
            <span className="min-w-0 truncate text-sm font-medium text-ink-900 transition-colors group-hover:text-accent-700">
              {client.full_name}
            </span>
          </Link>
        );
      },
    },
    {
      id: "identification_number",
      header: CLIENTS_COLUMN_LABELS.identification_number,
      accessorFn: (row) => row.identification_number,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-slate-600">
          {row.original.identification_number}
        </span>
      ),
    },
    {
      id: "occupation",
      header: CLIENTS_COLUMN_LABELS.occupation,
      accessorFn: (row) => row.occupation,
      cell: ({ row }) => (
        <span className="truncate text-sm text-slate-600">{row.original.occupation}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const client = row.original;
        return (
          <div className="flex items-center justify-end">
            <Link
              href={`/dashboard/clients/${client.id}`}
              aria-label={`Ver detalle de ${client.full_name}`}
              className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-accent-50 hover:text-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
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
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        );
      },
    },
  ];
}
