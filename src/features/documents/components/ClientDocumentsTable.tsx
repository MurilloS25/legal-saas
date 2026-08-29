"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ClientDocumentRow } from "../server/detail-queries";
import { createClientDocumentsColumns } from "./client-documents-columns";

type Props = {
  rows: ClientDocumentRow[];
};

export function ClientDocumentsTable({ rows }: Props) {
  "use no memo";

  const columns = useMemo(() => createClientDocumentsColumns(), []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      role="region"
      aria-label="Tabla de escrituras del cliente"
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Escrituras asociadas al cliente</caption>
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
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400 ${
                    header.column.id === "actions" ? "text-right" : ""
                  }`}
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
                <td key={cell.id} className="px-5 py-4 align-middle">
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
