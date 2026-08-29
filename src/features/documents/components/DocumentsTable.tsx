"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { WorkspaceDocumentRow } from "../server/workspace-queries";
import { createDocumentsColumns } from "./documents-columns";

type Props = {
  rows: WorkspaceDocumentRow[];
  canWrite: boolean;
};

// Columnas secundarias: se ocultan en viewports angostos para evitar
// desbordamiento horizontal, en vez de forzar scroll para todas las columnas.
const RESPONSIVE_HIDDEN: Record<string, string> = {
  template: "hidden md:table-cell",
  updated_at: "hidden md:table-cell",
};

export function DocumentsTable({ rows, canWrite }: Props) {
  "use no memo";

  const columns = useMemo(() => createDocumentsColumns(canWrite), [canWrite]);

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
    <div role="region" aria-label="Tabla de escrituras" tabIndex={0} className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Listado de escrituras</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-ink-100 bg-ink-100/40 text-left"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400 ${
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
        <tbody className="divide-y divide-ink-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="transition-colors duration-150 hover:bg-accent-50/40">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-6 py-4 align-middle ${
                    cell.column.id === "client" || cell.column.id === "template"
                      ? "max-w-[16rem] truncate text-ink-500"
                      : ""
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
