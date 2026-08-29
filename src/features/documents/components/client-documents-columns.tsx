import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { ClientDocumentRow } from "../server/detail-queries";
import { documentStatusLabel } from "../model/status";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  ready: "warning",
  final: "success",
};

export const CLIENT_DOCUMENTS_COLUMN_LABELS = {
  title: "Escritura",
  status: "Estado",
  updated_at: "Actualizada",
  actions: "Acciones",
} as const;

export function formatClientDocumentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function createClientDocumentsColumns(): ColumnDef<ClientDocumentRow>[] {
  return [
    {
      id: "title",
      header: CLIENT_DOCUMENTS_COLUMN_LABELS.title,
      accessorFn: (row) => row.title,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div>
            <p className="text-sm font-medium text-ink-900">{doc.title}</p>
            <p className="text-xs text-ink-500">{doc.templates?.name ?? "—"}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: CLIENT_DOCUMENTS_COLUMN_LABELS.status,
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <Badge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
          {documentStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "updated_at",
      header: CLIENT_DOCUMENTS_COLUMN_LABELS.updated_at,
      accessorFn: (row) => row.updated_at,
      cell: ({ row }) => formatClientDocumentDate(row.original.updated_at),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center justify-end">
            <Link
              href={`/dashboard/documents/${doc.id}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              {doc.status === "final" ? "Ver" : "Continuar"}
            </Link>
          </div>
        );
      },
    },
  ];
}
