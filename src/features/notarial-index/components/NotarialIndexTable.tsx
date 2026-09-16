"use client";

import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from "react";
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
import { NotarialInlineReview } from "./NotarialInlineReview";

type Props = {
  rows: NotarialIndexRow[];
  query: Pick<NotarialQuery, "page" | "pageSize">;
  pageCount: number;
  total: number;
  canManage: boolean;
};

export function NotarialIndexTable({
  rows,
  query,
  pageCount,
  total,
  canManage,
}: Props) {
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
  const { pagination, sorting } = notarialTableState(
    query.page,
    query.pageSize,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dirtyId, setDirtyId] = useState<string | null>(null);
  const handleDirtyChange = useCallback(
    (documentId: string, dirty: boolean) => {
      setDirtyId((current) => {
        if (dirty) return documentId;
        return current === documentId ? null : current;
      });
    },
    [],
  );

  function toggleRow(documentId: string) {
    if (
      expandedId &&
      dirtyId === expandedId &&
      !window.confirm("Hay cambios del Índice sin guardar. ¿Deseas descartarlos?")
    ) {
      return;
    }
    setExpandedId((current) => (current === documentId ? null : documentId));
  }

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
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-wait disabled:opacity-60"
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
                        className="size-4 accent-accent-700"
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
                <th scope="col" className="w-10 px-2 py-3">
                  <span className="sr-only">Revisión</span>
                </th>
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
            {table.getRowModel().rows.map((row) => {
              const documentId = row.original.document_id;
              const expanded = expandedId === documentId;
              const panelId = `notarial-row-detail-${documentId}`;
              return (
                <Fragment key={documentId}>
                  <tr
                    className={`transition-colors hover:bg-slate-50 ${expanded ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-2 py-3 align-top">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        aria-label={`${expanded ? "Cerrar" : "Abrir"} revisión de ${row.original.title}`}
                        onClick={() => toggleRow(documentId)}
                        className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                        >
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                      </button>
                    </td>
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
                        } ${cell.column.id === "actions" ? "text-right" : ""} ${
                          cell.column.id === "parties"
                            ? "max-w-[16rem] truncate"
                            : ""
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expanded && (
                    <tr id={panelId}>
                      <td colSpan={row.getVisibleCells().length + 1} className="p-0">
                        <NotarialInlineReview
                          key={`${documentId}:${row.original.version ?? 0}`}
                          row={row.original}
                          canManage={canManage}
                          onDirtyChange={handleDirtyChange}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
