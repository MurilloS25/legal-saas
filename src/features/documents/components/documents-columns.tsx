import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { WorkspaceDocumentRow } from "../server/workspace-queries";
import { documentStatusLabel } from "../model/status";
import { Badge } from "@/components/ui/Badge";
import { DownloadDocxButton } from "./DownloadDocxButton";
import { DeleteDocumentButton } from "./DeleteDocumentButton";
import { DuplicateDocumentButton } from "./DuplicateDocumentButton";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  ready: "warning",
  final: "success",
};

export const DOCUMENTS_COLUMN_IDS = [
  "title",
  "client",
  "template",
  "status",
  "updated_at",
  "actions",
] as const;

export const DOCUMENTS_COLUMN_LABELS: Record<
  (typeof DOCUMENTS_COLUMN_IDS)[number],
  string
> = {
  title: "Escritura",
  client: "Cliente",
  template: "Machote",
  status: "Estado",
  updated_at: "Actualizada",
  actions: "Acciones",
};

export function formatDocumentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function createDocumentsColumns(
  canWrite: boolean,
): ColumnDef<WorkspaceDocumentRow>[] {
  return [
    {
      id: "title",
      header: DOCUMENTS_COLUMN_LABELS.title,
      accessorFn: (row) => row.title,
      cell: ({ row }) => (
        <p className="text-sm font-medium text-ink-900">
          {row.original.title}
        </p>
      ),
    },
    {
      id: "client",
      header: DOCUMENTS_COLUMN_LABELS.client,
      accessorFn: (row) => row.clients?.full_name ?? "",
      cell: ({ row }) =>
        row.original.clients?.full_name ?? (
          <span className="text-ink-400">Sin cliente</span>
        ),
    },
    {
      id: "template",
      header: DOCUMENTS_COLUMN_LABELS.template,
      accessorFn: (row) => row.templates?.name ?? "",
      cell: ({ row }) => row.original.templates?.name ?? "—",
    },
    {
      id: "status",
      header: DOCUMENTS_COLUMN_LABELS.status,
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <Badge tone={STATUS_TONE[row.original.status] ?? "neutral"} className="w-fit">
          {documentStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "updated_at",
      header: DOCUMENTS_COLUMN_LABELS.updated_at,
      accessorFn: (row) => row.updated_at,
      cell: ({ row }) => formatDocumentDate(row.original.updated_at),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/dashboard/documents/${doc.id}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              {doc.status === "final" ? "Ver" : "Continuar"}
            </Link>
            <DownloadDocxButton
              documentId={doc.id}
              disabled={false}
              pendingVariableCount={doc.pendingVariableCount}
              variant="compact"
              ariaLabel={`Descargar Word de ${doc.title}`}
            />
            {canWrite && (
              <DuplicateDocumentButton documentId={doc.id} documentTitle={doc.title} />
            )}
            {canWrite && doc.status !== "final" && (
              <DeleteDocumentButton documentId={doc.id} documentTitle={doc.title} />
            )}
          </div>
        );
      },
    },
  ];
}
