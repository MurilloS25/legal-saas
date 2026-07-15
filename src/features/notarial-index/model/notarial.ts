/**
 * Metadata interna del índice notarial (1:1 con una Escritura).
 *
 * La completitud se deriva (no se almacena): una escritura tiene metadata
 * "completa" cuando están presentes número de instrumento, fecha de
 * autorización y tipo de acto. "Completo" significa completo según los campos
 * internos del sistema, no validado legalmente.
 */

export type NotarialMetadata = {
  instrument_number: string | null;
  authorized_at: string | null;
  act_type: string | null;
  book_reference: string | null;
  folio_reference: string | null;
  appearing_parties_summary: string | null;
  notes: string | null;
};

/** Campos que determinan la completitud interna. */
export const NOTARIAL_CORE_FIELDS = [
  "instrument_number",
  "authorized_at",
  "act_type",
] as const;

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** true si la metadata está completa según los campos internos mínimos. */
export function isNotarialComplete(
  metadata: Partial<NotarialMetadata> | null,
): boolean {
  if (!metadata) return false;
  return (
    hasValue(metadata.instrument_number) &&
    hasValue(metadata.authorized_at) &&
    hasValue(metadata.act_type)
  );
}

export type NotarialCompleteness = "complete" | "incomplete" | "missing";

/** Estado de completitud a partir de la metadata (o su ausencia). */
export function notarialCompleteness(
  metadata: NotarialMetadata | null,
): NotarialCompleteness {
  if (!metadata) return "missing";
  return isNotarialComplete(metadata) ? "complete" : "incomplete";
}

export const NOTARIAL_COMPLETENESS_LABEL: Record<NotarialCompleteness, string> =
  {
    complete: "Completo",
    incomplete: "Incompleto",
    missing: "Sin datos",
  };
