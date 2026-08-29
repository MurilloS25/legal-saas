"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ReceivableEntry } from "../model/types";
import { createReceivableMiniColumns } from "./receivable-mini-columns";

type Props = {
  rows: ReceivableEntry[];
  returnTo?: string;
};

// Columna secundaria: se oculta en viewports angostos para evitar
// desbordamiento horizontal, en vez de forzar scroll para todas las columnas.
const RESPONSIVE_HIDDEN: Record<string, string> = {
  amount_total: "hidden sm:table-cell",
};

export function ReceivableMiniTable({ rows, returnTo }: Props) {
  "use no memo";

  const columns = useMemo(
    () => createReceivableMiniColumns(returnTo),
    [returnTo],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      role="region"
      aria-label="Tabla de cuentas por cobrar del cliente"
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Cuentas por cobrar asociadas</caption>
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
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400 whitespace-nowrap ${
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
                  className={`px-5 py-4 align-middle whitespace-nowrap ${RESPONSIVE_HIDDEN[cell.column.id] ?? ""}`}
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
