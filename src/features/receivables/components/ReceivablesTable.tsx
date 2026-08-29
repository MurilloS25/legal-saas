"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ReceivableEntry } from "../model/types";
import { createReceivablesColumns } from "./receivables-columns";

type Props = {
  rows: ReceivableEntry[];
};

// Columnas secundarias: se ocultan en viewports angostos para evitar
// desbordamiento horizontal, en vez de forzar scroll para todas las columnas.
const RESPONSIVE_HIDDEN: Record<string, string> = {
  document_title: "hidden lg:table-cell",
  amount_total: "hidden md:table-cell",
  due_at: "hidden md:table-cell",
};

export function ReceivablesTable({ rows }: Props) {
  "use no memo";

  const columns = useMemo(() => createReceivablesColumns(), []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
  });

  return (
    <div
      role="region"
      aria-label="Tabla de cuentas por cobrar"
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Listado de cuentas por cobrar</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-slate-200 bg-slate-50/60 text-left"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400 whitespace-nowrap ${
                    header.column.id === "actions" ? "text-right" : ""
                  } ${RESPONSIVE_HIDDEN[header.column.id] ?? ""}`}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-accent-50/40">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-6 py-4 align-middle ${
                    cell.column.id === "concept" || cell.column.id === "client_name"
                      ? "max-w-[14rem] truncate"
                      : "whitespace-nowrap"
                  } ${RESPONSIVE_HIDDEN[cell.column.id] ?? ""}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
