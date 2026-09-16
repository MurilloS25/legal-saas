import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { TemplateListRow } from "../server/workspace-queries";
import { templateStatusBadgeClass, templateStatusLabel } from "../model/templates";

export const TEMPLATES_COLUMN_LABELS = {
  name: "Machote",
  status: "Estado",
  updated_at: "Actualizado",
  actions: "Acciones",
} as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${templateStatusBadgeClass(status)}`}
    >
      {templateStatusLabel(status)}
    </span>
  );
}

export function formatTemplateDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function createTemplatesColumns(): ColumnDef<TemplateListRow>[] {
  return [
    {
      id: "name",
      header: TEMPLATES_COLUMN_LABELS.name,
      accessorFn: (row) => row.name,
      cell: ({ row }) => {
        const template = row.original;
        return (
          <Link
            href={`/templates/${template.id}`}
            className="flex min-w-0 flex-col focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500 rounded"
          >
            <span className="text-sm font-medium text-slate-900 truncate hover:text-accent-700 transition-colors">
              {template.name}
            </span>
            {template.description && (
              <span className="text-xs text-slate-500 truncate">
                {template.description}
              </span>
            )}
          </Link>
        );
      },
    },
    {
      id: "status",
      header: TEMPLATES_COLUMN_LABELS.status,
      accessorFn: (row) => row.status,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "updated_at",
      header: TEMPLATES_COLUMN_LABELS.updated_at,
      accessorFn: (row) => row.updated_at,
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">
          {formatTemplateDate(row.original.updated_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const template = row.original;
        return (
          <div className="flex items-center justify-end">
            <Link
              href={`/templates/${template.id}`}
              aria-label={`Abrir machote ${template.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 transition-colors"
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
        );
      },
    },
  ];
}
