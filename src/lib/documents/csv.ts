/**
 * Construcción de CSV seguro.
 *
 * - Escapa comillas, comas y saltos de línea (RFC 4180: se entrecomilla y se
 *   duplican las comillas internas).
 * - Mitiga CSV injection: una celda que empieza por `= + - @` (o tab/CR/LF)
 *   podría ejecutarse como fórmula al abrir en una hoja de cálculo; se le
 *   antepone un apóstrofo para neutralizarla.
 * - Se puede anteponer BOM UTF-8 para que Excel muestre tildes correctamente.
 */

export const CSV_BOM = "﻿";

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_PREFIX = /^(?:[ \t\r\n]*[=+\-@]|[\t\r\n])/;

/** Escapa una celda: neutraliza fórmulas y entrecomilla si es necesario. */
export function escapeCsvCell(value: string): string {
  let cell = value ?? "";
  if (FORMULA_PREFIX.test(cell)) {
    cell = `'${cell}`;
  }
  if (NEEDS_QUOTING.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Serializa filas a CSV. Usa CRLF como fin de línea (compatible con Excel).
 * `bom` antepone el BOM UTF-8.
 */
export function toCsv(
  rows: readonly (readonly string[])[],
  options: { bom?: boolean } = {},
): string {
  const body = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
  return (options.bom ? CSV_BOM : "") + body;
}
