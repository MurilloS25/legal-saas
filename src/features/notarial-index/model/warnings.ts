import type { NotarialIndexRow } from "./notarial-index-row";

const FIELD_LABELS = {
  protocol_book: "Tomo",
  initial_folio: "Folio inicial",
  final_folio: "Folio final",
  instrument_number: "Número",
  authorized_at: "Fecha y hora",
  act_name: "Acto o contrato",
  parties: "Partes",
} as const;

function blank(value: string | null): boolean {
  return !value || value.trim() === "";
}

export function missingNotarialIndexFields(row: NotarialIndexRow): string[] {
  const missing: string[] = [];
  if (blank(row.protocol_book)) missing.push(FIELD_LABELS.protocol_book);
  if (blank(row.initial_folio)) missing.push(FIELD_LABELS.initial_folio);
  if (blank(row.final_folio)) missing.push(FIELD_LABELS.final_folio);
  if (!row.instrument_number || row.instrument_number < 1) {
    missing.push(FIELD_LABELS.instrument_number);
  }
  if (blank(row.authorized_at)) missing.push(FIELD_LABELS.authorized_at);
  if (blank(row.act_name)) missing.push(FIELD_LABELS.act_name);
  if (blank(row.parties)) missing.push(FIELD_LABELS.parties);
  return missing;
}

export function notarialIndexWarnings(rows: readonly NotarialIndexRow[]): {
  incompleteCount: number;
  missingFields: string[];
} {
  const missingFields = new Set<string>();
  let incompleteCount = 0;
  for (const row of rows) {
    const missing = missingNotarialIndexFields(row);
    if (missing.length === 0) continue;
    incompleteCount += 1;
    for (const field of missing) missingFields.add(field);
  }
  return { incompleteCount, missingFields: [...missingFields] };
}
