"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import type { NotarialQuery } from "../model/query";
import {
  createNotarialIndexColumns,
  DEFAULT_NOTARIAL_COLUMN_VISIBILITY,
  NOTARIAL_COLUMN_LABELS,
  NOTARIAL_MANUAL_TABLE_OPTIONS,
  notarialTableState,
  type NotarialColumnId,
} from "./notarial-index-columns";

type Props = {
  rows: NotarialIndexRow[];
  query: Pick<NotarialQuery, "page">;
  pageCount: number;
  total: number;
};

export function NotarialIndexTable({ rows, query, pageCount, total }: Props) {
  "use no memo";

  const columns = useMemo(() => createNotarialIndexColumns(), []);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    DEFAULT_NOTARIAL_COLUMN_VISIBILITY,
  );
  const { pagination, sorting } = notarialTableState(query.page);

  // TanStack Table intentionally exposes mutable-style callbacks that React
  // Compiler cannot safely memoize; this component is opted out above.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...NOTARIAL_MANUAL_TABLE_OPTIONS,
    pageCount,
    rowCount: total,
    state: { columnVisibility, pagination, sorting },
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <>
      <div className="flex justify-end border-b border-slate-100 bg-white px-4 py-2">
        <div className="relative">
          <button
            type="button"
            aria-expanded={isColumnMenuOpen}
            aria-controls="notarial-column-visibility"
            disabled={!hydrated}
            onClick={() => setIsColumnMenuOpen((open) => !open)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-wait disabled:opacity-60"
          >
            Columnas
          </button>
          {isColumnMenuOpen && (
            <fieldset
              id="notarial-column-visibility"
              className="absolute right-0 z-10 mt-2 min-w-48 rounded-lg border border-slate-200 bg-white p-3 shadow-md"
            >
              <legend className="sr-only">Columnas visibles</legend>
              <div className="space-y-2">
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="size-4 accent-teal-700"
                      />
                      {NOTARIAL_COLUMN_LABELS[column.id as NotarialColumnId]}
                    </label>
                  ))}
              </div>
            </fieldset>
          )}
        </div>
      </div>

      <div
        role="region"
        aria-label="Tabla del índice notarial"
        tabIndex={0}
        className="overflow-x-auto"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">
            Escrituras finalizadas incluidas en el índice notarial interno
          </caption>
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
                    aria-sort={
                      header.column.id === "instrument_number"
                        ? "ascending"
                        : undefined
                    }
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.original.document_id}
                className="transition-colors hover:bg-slate-50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-4 py-3 ${
                      cell.column.id === "instrument_number"
                        ? "text-slate-900"
                        : "text-slate-600"
                    } ${
                      cell.column.id === "instrument_number" ||
                      cell.column.id === "authorized_at" ||
                      cell.column.id === "actions"
                        ? "whitespace-nowrap"
                        : ""
                    } ${
                      cell.column.id === "actions" ? "text-right" : ""
                    } ${
                      cell.column.id === "parties"
                        ? "max-w-[16rem] truncate"
                        : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
