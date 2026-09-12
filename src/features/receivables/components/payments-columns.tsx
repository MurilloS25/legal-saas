import type { ColumnDef } from "@tanstack/react-table";
import type { ReceivablePayment } from "../model/types";
import { formatMoney } from "../model/status";
import { paymentMethodLabel } from "../model/payments";
import { VoidPaymentButton } from "./VoidPaymentButton";

export const PAYMENTS_COLUMN_LABELS = {
  paid_at: "Fecha",
  amount: "Monto",
  currency: "Moneda",
  method: "Método",
  reference: "Referencia",
  status: "Estado",
  actions: "Acciones",
} as const;

export function formatPaymentDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function createPaymentsColumns(
  receivableId: string,
  canVoid: boolean,
  returnTo?: string | null,
): ColumnDef<ReceivablePayment>[] {
  return [
    {
      id: "paid_at",
      header: PAYMENTS_COLUMN_LABELS.paid_at,
      accessorFn: (row) => row.paid_at,
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">
          {formatPaymentDate(row.original.paid_at)}
        </span>
      ),
    },
    {
      id: "amount",
      header: PAYMENTS_COLUMN_LABELS.amount,
      accessorFn: (row) => Number(row.amount),
      cell: ({ row }) => {
        const voided = row.original.status === "voided";
        return (
          <span
            className={`text-sm font-medium ${voided ? "text-slate-400 line-through" : "text-slate-900"}`}
          >
            {formatMoney(row.original.amount, row.original.currency)}
          </span>
        );
      },
    },
    {
      id: "currency",
      header: PAYMENTS_COLUMN_LABELS.currency,
      accessorFn: (row) => row.currency,
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">{row.original.currency}</span>
      ),
    },
    {
      id: "method",
      header: PAYMENTS_COLUMN_LABELS.method,
      accessorFn: (row) => row.method,
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">
          {paymentMethodLabel(row.original.method)}
        </span>
      ),
    },
    {
      id: "reference",
      header: PAYMENTS_COLUMN_LABELS.reference,
      accessorFn: (row) => row.reference ?? "",
      cell: ({ row }) =>
        row.original.reference ?? <span className="text-slate-400">—</span>,
    },
    {
      id: "status",
      header: PAYMENTS_COLUMN_LABELS.status,
      accessorFn: (row) => row.status,
      cell: ({ row }) => {
        const p = row.original;
        if (p.status !== "voided") {
          return <span className="text-slate-400">—</span>;
        }
        return (
          <div>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              Anulado
            </span>
            {p.void_reason && (
              <p className="mt-1 text-xs text-red-600">Anulado: {p.void_reason}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const p = row.original;
        if (p.status === "voided" || !canVoid) return null;
        return (
          <div className="flex items-center justify-end">
            <VoidPaymentButton
              receivableId={receivableId}
              paymentId={p.id}
              amountLabel={formatMoney(p.amount, p.currency)}
              returnTo={returnTo}
            />
          </div>
        );
      },
    },
  ];
}
