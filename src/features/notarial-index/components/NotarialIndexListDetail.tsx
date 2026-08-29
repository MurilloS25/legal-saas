"use client";

/**
 * Contenedor list+detail del Índice notarial (iteración 3): coordina la
 * selección de fila entre `NotarialIndexTable` y
 * `NotarialRecordDetailPanel`. Seleccionar una fila abre su detalle sin
 * navegar — reemplaza el patrón anterior de "tabla + link a Ver
 * escritura" (dos navegaciones para ver un registro).
 *
 * La selección es estado de UI puro (useState), no se persiste en la URL
 * a propósito: es una lectura rápida sobre los filtros/página ya
 * codificados en la URL, no una vista independiente que valga la pena
 * enlazar. Cambiar de página/filtro (NotarialToolbar, TablePagination)
 * sigue funcionando exactamente igual — ninguno vive dentro de este
 * componente.
 */

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { TablePagination } from "@/components/ui/TablePagination";
import { NotarialIndexTable } from "./NotarialIndexTable";
import { NotarialRecordDetailPanel } from "./NotarialRecordDetailPanel";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import type { NotarialQuery } from "../model/query";

type Props = {
  rows: NotarialIndexRow[];
  query: Pick<NotarialQuery, "page">;
  pageCount: number;
  total: number;
  rangeLabel: string;
  pageHref: (targetPage: number) => string;
};

export function NotarialIndexListDetail({
  rows,
  query,
  pageCount,
  total,
  rangeLabel,
  pageHref,
}: Props) {
  const [selected, setSelected] = useState<NotarialIndexRow | null>(null);

  // Si la fila seleccionada desaparece de la página actual (cambio de
  // filtro/página), no dejamos un panel huérfano abierto.
  const selectedStillVisible =
    selected != null && rows.some((row) => row.document_id === selected.document_id);
  const visibleSelected = selectedStillVisible ? selected : null;

  return (
    <div className="flex flex-col items-start gap-0 lg:flex-row">
      <Card padding="none" className="min-w-0 flex-1 overflow-hidden">
        <NotarialIndexTable
          rows={rows}
          query={query}
          pageCount={pageCount}
          total={total}
          selectedId={visibleSelected?.document_id ?? null}
          onSelectRow={(row) =>
            setSelected((current) =>
              current?.document_id === row.document_id ? null : row,
            )
          }
        />

        <TablePagination
          page={query.page}
          pageCount={pageCount}
          countLabel={rangeLabel}
          pageHref={pageHref}
        />
      </Card>

      <NotarialRecordDetailPanel
        row={visibleSelected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
