/**
 * Metadata interna del índice notarial (1:1 con una Escritura).
 *
 * La completitud se deriva (no se almacena): una escritura tiene metadata
 * "completa" cuando están presentes los ocho valores requeridos por el índice.
 * "Completo" significa completo según los campos internos del sistema, no
 * validado legalmente.
 */

export type NotarialMetadata = {
  instrument_number: number | null;
  authorized_at: string | null;
  protocol_book: string | null;
  initial_folio: string | null;
  final_folio: string | null;
  act_name_snapshot: string | null;
  act_name_override: string | null;
  generated_parties: string | null;
  parties_override: string | null;
  notes: string | null;
  version: number;
};

/** Campos que determinan la completitud interna. */
export const NOTARIAL_CORE_FIELDS = [
  "protocol_book",
  "initial_folio",
  "final_folio",
  "instrument_number",
  "authorized_at",
  "act_name",
  "parties",
] as const;

export type NotarialMissingField = (typeof NOTARIAL_CORE_FIELDS)[number];

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function overrideOrFallback(
  override: string | null | undefined,
  fallback: string | null | undefined,
): string | null | undefined {
  return hasValue(override) ? override : fallback;
}

/** true si la metadata está completa según los campos internos mínimos. */
export function isNotarialComplete(
  metadata: Partial<NotarialMetadata> | null,
): boolean {
  if (!metadata) return false;
  return (
    typeof metadata.instrument_number === "number" &&
    metadata.instrument_number > 0 &&
    hasValue(metadata.authorized_at) &&
    hasValue(metadata.protocol_book) &&
    hasValue(metadata.initial_folio) &&
    hasValue(metadata.final_folio) &&
    hasValue(
      overrideOrFallback(
        metadata.act_name_override,
        metadata.act_name_snapshot,
      ),
    ) &&
    hasValue(
      overrideOrFallback(
        metadata.parties_override,
        metadata.generated_parties,
      ),
    )
  );
}

export function notarialMissingFields(
  metadata: Partial<NotarialMetadata> | null,
): NotarialMissingField[] {
  if (!metadata) return [...NOTARIAL_CORE_FIELDS];
  const missing: NotarialMissingField[] = [];
  if (!hasValue(metadata.protocol_book)) missing.push("protocol_book");
  if (!hasValue(metadata.initial_folio)) missing.push("initial_folio");
  if (!hasValue(metadata.final_folio)) missing.push("final_folio");
  if (
    !(
      typeof metadata.instrument_number === "number" &&
      metadata.instrument_number > 0
    )
  ) {
    missing.push("instrument_number");
  }
  if (!hasValue(metadata.authorized_at)) missing.push("authorized_at");
  if (
    !hasValue(
      overrideOrFallback(
        metadata.act_name_override,
        metadata.act_name_snapshot,
      ),
    )
  ) {
    missing.push("act_name");
  }
  if (
    !hasValue(
      overrideOrFallback(
        metadata.parties_override,
        metadata.generated_parties,
      ),
    )
  ) {
    missing.push("parties");
  }
  return missing;
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
