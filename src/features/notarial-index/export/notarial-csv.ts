/**
 * Construcción del CSV del índice notarial interno.
 *
 * Columnas sin datos internos ni identificadores técnicos: no se exportan
 * UUIDs, owner_id, actor_user_id, JSON ni las notas internas.
 */

import { toCsv } from "./csv";
import {
  formatCostaRicaDate,
  formatCostaRicaTime,
} from "../model/datetime";

export type NotarialExportRow = {
  title: string;
  instrument_number: string | null;
  authorized_at: string | null;
  act_type: string | null;
  book_reference: string | null;
  folio_reference: string | null;
  appearing_parties_summary: string | null;
  has_metadata: boolean;
  is_complete: boolean;
};

export const NOTARIAL_CSV_HEADERS = [
  "Número",
  "Fecha",
  "Hora",
  "Tipo de acto",
  "Comparecientes",
  "Libro/Tomo",
  "Folio",
  "Completitud",
  "Escritura",
] as const;

function completenessLabel(row: NotarialExportRow): string {
  if (!row.has_metadata) return "Sin datos";
  return row.is_complete ? "Completo" : "Incompleto";
}

export function notarialRowToCsvCells(row: NotarialExportRow): string[] {
  return [
    row.instrument_number ?? "",
    formatCostaRicaDate(row.authorized_at),
    formatCostaRicaTime(row.authorized_at),
    row.act_type ?? "",
    row.appearing_parties_summary ?? "",
    row.book_reference ?? "",
    row.folio_reference ?? "",
    completenessLabel(row),
    row.title,
  ];
}

/** CSV completo (con BOM UTF-8) del índice para las filas dadas. */
export function buildNotarialCsv(rows: readonly NotarialExportRow[]): string {
  return toCsv(
    [[...NOTARIAL_CSV_HEADERS], ...rows.map(notarialRowToCsvCells)],
    { bom: true },
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Nombre de archivo seguro derivado del rango de fechas del filtro. */
export function notarialExportFilename(
  from: string | null,
  to: string | null,
): string {
  const safeFrom = from && DATE_RE.test(from) ? from : null;
  const safeTo = to && DATE_RE.test(to) ? to : null;
  if (safeFrom && safeTo) return `indice-notarial-${safeFrom}-a-${safeTo}.csv`;
  if (safeFrom) return `indice-notarial-desde-${safeFrom}.csv`;
  if (safeTo) return `indice-notarial-hasta-${safeTo}.csv`;
  return "indice-notarial.csv";
}
