"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type Row } from "@tanstack/react-table";
import type { ReceivableEntry } from "../model/types";
import { createReceivablesColumns } from "./receivables-columns";
import {
  classifyReceivableUrgency,
  URGENCY_GROUP_ORDER,
  URGENCY_GROUP_META,
  type UrgencyGroup,
} from "./receivable-urgency";

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

  const headerGroups = table.getHeaderGroups();
  const columnCount = headerGroups[0]?.headers.length ?? 1;

  // Reagrupa las filas ya cargadas por urgencia real (vencidas primero, luego
  // próximas a vencer, luego el resto) en vez de dejarlas en una sola tabla
  // plana ordenada solo por fecha — la urgencia es lo que un notario necesita
  // escanear primero, no un detalle que exige leer cada badge fila por fila.
  const grouped = useMemo(() => {
    const buckets: Record<UrgencyGroup, Row<ReceivableEntry>[]> = {
      overdue: [],
      due_soon: [],
      rest: [],
    };
    for (const row of table.getRowModel().rows) {
      buckets[classifyReceivableUrgency(row.original)].push(row);
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const visibleGroups = URGENCY_GROUP_ORDER.filter(
    (group) => grouped[group].length > 0,
  );
  const showGroupHeaders = visibleGroups.length > 1;

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
          {headerGroups.map((headerGroup) => (
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
        {visibleGroups.map((group) => {
          const meta = URGENCY_GROUP_META[group];
          const groupRows = grouped[group];
          return (
            <tbody key={group} className="divide-y divide-slate-100">
              {showGroupHeaders && (
                <tr className={`border-y border-slate-100 ${meta.headerClass}`}>
                  <td colSpan={columnCount} className="px-6 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${meta.dotClass}`}
                      />
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${meta.textClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({groupRows.length})
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {groupRows.map((row) => (
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
          );
        })}
      </table>
    </div>
  );
}
