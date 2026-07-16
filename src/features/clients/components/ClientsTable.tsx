"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ClientRow } from "../model/types";
import { createClientsColumns } from "./clients-columns";

type Props = {
  rows: ClientRow[];
};

// Columna secundaria: se oculta en viewports angostos para evitar
// desbordamiento horizontal, en vez de forzar scroll para todas las columnas.
const RESPONSIVE_HIDDEN: Record<string, string> = {
  occupation: "hidden sm:table-cell",
};

export function ClientsTable({ rows }: Props) {
  "use no memo";

  const columns = useMemo(() => createClientsColumns(), []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div role="region" aria-label="Tabla de clientes" tabIndex={0} className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Directorio de clientes</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-slate-100 bg-slate-50 text-left"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    header.column.id === "actions" ? "text-right w-16" : ""
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
            <tr key={row.id} className="transition-colors hover:bg-slate-50">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-6 py-4 align-middle ${RESPONSIVE_HIDDEN[cell.column.id] ?? ""}`}
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
