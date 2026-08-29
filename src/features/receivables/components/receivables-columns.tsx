import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReceivableEntry } from "../model/types";
import { formatMoney, receivableStatusLabel } from "../model/status";
import { Badge } from "@/components/ui/Badge";

/** Mapea el estado derivado de la cuenta al tono semántico del Badge
 * compartido. Vive aquí (capa de UI) porque `model/status.ts` solo expone
 * clases de color crudas pensadas para el sistema visual anterior. */
export function receivableStatusTone(
  status: string,
): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
      return "error";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
}

export const RECEIVABLES_COLUMN_LABELS = {
  concept: "Concepto",
  client_name: "Cliente",
  document_title: "Escritura",
  amount_total: "Monto",
  balance_due: "Saldo",
  status: "Estado",
  due_at: "Vencimiento",
  actions: "Acciones",
} as const;

export function formatReceivableDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function createReceivablesColumns(): ColumnDef<ReceivableEntry>[] {
  return [
    {
      id: "concept",
      header: RECEIVABLES_COLUMN_LABELS.concept,
      accessorFn: (row) => row.concept,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/receivables/${row.original.id}`}
          className="text-sm font-medium text-ink-900 hover:text-accent-700 focus:outline-none focus:underline transition-colors"
        >
          {row.original.concept}
        </Link>
      ),
    },
    {
      id: "client_name",
      header: RECEIVABLES_COLUMN_LABELS.client_name,
      accessorFn: (row) => row.client_name,
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.client_name}</span>
      ),
    },
    {
      id: "document_title",
      header: RECEIVABLES_COLUMN_LABELS.document_title,
      accessorFn: (row) => row.document_title ?? "",
      cell: ({ row }) =>
        row.original.document_title ?? <span className="text-slate-400">—</span>,
    },
    {
      id: "amount_total",
      header: RECEIVABLES_COLUMN_LABELS.amount_total,
      accessorFn: (row) => Number(row.amount_total),
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums text-slate-700">
          {formatMoney(row.original.amount_total, row.original.currency)}
        </span>
      ),
    },
    {
      id: "balance_due",
      header: RECEIVABLES_COLUMN_LABELS.balance_due,
      accessorFn: (row) => Number(row.balance_due),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold tabular-nums text-ink-900">
          {formatMoney(row.original.balance_due, row.original.currency)}
        </span>
      ),
    },
    {
      id: "status",
      header: RECEIVABLES_COLUMN_LABELS.status,
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <Badge tone={receivableStatusTone(row.original.status)}>
          {receivableStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "due_at",
      header: RECEIVABLES_COLUMN_LABELS.due_at,
      accessorFn: (row) => row.due_at ?? "",
      cell: ({ row }) =>
        row.original.due_at ? (
          <span className="font-mono text-sm tabular-nums text-slate-500">
            {formatReceivableDate(row.original.due_at)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <Link
            href={`/dashboard/receivables/${row.original.id}`}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
          >
            Ver
          </Link>
        </div>
      ),
    },
  ];
}
