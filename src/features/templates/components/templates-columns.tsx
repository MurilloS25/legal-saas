import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { TemplateListRow } from "../server/workspace-queries";
import { Badge } from "@/components/ui/Badge";
import { templateStatusBadgeTone, templateStatusLabel } from "../model/templates";

export const TEMPLATES_COLUMN_LABELS = {
  name: "Machote",
  status: "Estado",
  updated_at: "Actualizado",
  actions: "Acciones",
} as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={templateStatusBadgeTone(status)}>{templateStatusLabel(status)}</Badge>
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
            href={`/dashboard/templates/${template.id}`}
            className="flex min-w-0 flex-col rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
          >
            <span className="text-sm font-medium text-ink-900 truncate transition-colors hover:text-accent-700">
              {template.name}
            </span>
            {template.description && (
              <span className="text-xs text-ink-400 truncate">
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
        <span className="font-mono text-sm tabular-nums text-ink-400">
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
              href={`/dashboard/templates/${template.id}`}
              aria-label={`Abrir machote ${template.name}`}
              className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
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
