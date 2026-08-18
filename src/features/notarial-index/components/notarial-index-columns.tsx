import Link from "next/link";
import type {
  ColumnDef,
  PaginationState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { NOTARIAL_PAGE_SIZE } from "../model/query";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { formatCostaRicaDate, formatCostaRicaTime } from "../model/datetime";

export const NOTARIAL_COLUMN_IDS = [
  "instrument_number",
  "authorized_at",
  "act_name",
  "parties",
  "client_name",
  "title",
  "completeness",
  "actions",
] as const;

export type NotarialColumnId = (typeof NOTARIAL_COLUMN_IDS)[number];

export const NOTARIAL_COLUMN_LABELS: Record<NotarialColumnId, string> = {
  instrument_number: "Número",
  authorized_at: "Fecha y hora",
  act_name: "Tipo de acto",
  parties: "Comparecientes",
  client_name: "Cliente",
  title: "Escritura",
  completeness: "Completitud",
  actions: "Acciones",
};

export const DEFAULT_NOTARIAL_COLUMN_VISIBILITY: VisibilityState = {
  client_name: false,
  title: false,
};

export const NOTARIAL_SORTABLE_COLUMN_IDS = ["instrument_number"] as const;

export const NOTARIAL_MANUAL_TABLE_OPTIONS = {
  manualFiltering: true,
  manualPagination: true,
  manualSorting: true,
} as const;

export function notarialTableState(
  page: number,
): { pagination: PaginationState; sorting: SortingState } {
  return {
    pagination: {
      pageIndex: Math.max(0, page - 1),
      pageSize: NOTARIAL_PAGE_SIZE,
    },
    sorting: [{ id: "instrument_number", desc: false }],
  };
}

function EmptyValue() {
  return <span className="text-slate-400">—</span>;
}

function completenessBadge(row: NotarialIndexRow) {
  if (!row.has_metadata) {
    return { label: "Sin datos", className: "bg-slate-100 text-slate-500" };
  }
  // "Completo" es un estado positivo real (el registro tiene todos los
  // datos) → verde semántico, no el acento decorativo.
  return row.is_complete
    ? {
        label: "Completo",
        className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    : {
        label: "Incompleto",
        className: "border border-amber-300 bg-amber-50 text-amber-800",
      };
}

export function createNotarialIndexColumns(): ColumnDef<NotarialIndexRow>[] {
  return [
    {
      accessorKey: "instrument_number",
      header: NOTARIAL_COLUMN_LABELS.instrument_number,
      enableSorting: true,
      enableHiding: false,
      cell: ({ getValue }) => getValue<string | null>() ?? <EmptyValue />,
    },
    {
      accessorKey: "authorized_at",
      header: NOTARIAL_COLUMN_LABELS.authorized_at,
      enableSorting: false,
      enableHiding: true,
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        // La fila puede estar ubicada en este período por
        // effective_index_date (created_at de resguardo) sin tener todavía
        // una fecha de autorización real — nunca se inventa ni se muestra
        // como si lo fuera; se declara explícitamente pendiente.
        return value ? (
          <>
            {formatCostaRicaDate(value)}
            <span className="text-slate-400">
              {" · "}
              {formatCostaRicaTime(value)}
            </span>
          </>
        ) : (
          <span className="text-amber-700">Fecha de autorización pendiente</span>
        );
      },
    },
    {
      accessorKey: "act_name",
      header: NOTARIAL_COLUMN_LABELS.act_name,
      enableSorting: false,
      cell: ({ getValue }) => getValue<string | null>() ?? <EmptyValue />,
    },
    {
      accessorKey: "parties",
      header: NOTARIAL_COLUMN_LABELS.parties,
      enableSorting: false,
      cell: ({ getValue }) => getValue<string | null>() ?? <EmptyValue />,
    },
    {
      accessorKey: "client_name",
      header: NOTARIAL_COLUMN_LABELS.client_name,
      enableSorting: false,
      cell: ({ getValue }) => getValue<string | null>() ?? <EmptyValue />,
    },
    {
      accessorKey: "title",
      header: NOTARIAL_COLUMN_LABELS.title,
      enableSorting: false,
    },
    {
      id: "completeness",
      header: NOTARIAL_COLUMN_LABELS.completeness,
      enableSorting: false,
      cell: ({ row }) => {
        const badge = completenessBadge(row.original);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/documents/${row.original.document_id}`}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          Ver escritura
        </Link>
      ),
    },
  ];
}
