/**
 * Duplicar un Machote: lógica pura (sin Supabase) que usa
 * `duplicateTemplateAction`. La copia es un Machote nuevo e independiente:
 * mismos contenido, variables, Bloques de opciones y configuración del
 * Índice, pero con IDs propios — los campos reciben IDs nuevos al guardarse
 * y los Bloques de opciones reciben aquí un `blockId` nuevo, remapeando las
 * referencias internas (la hora del Índice que apunta a un Bloque).
 */

import type { TemplateDocument } from "@/lib/editor/types";

const COPY_SUFFIX = " - Copia";
/** Mismo límite que valida `save_template_workspace` para el nombre. */
const MAX_TEMPLATE_NAME_LENGTH = 200;

function comparable(name: string): string {
  return name.trim().toLocaleLowerCase("es-CR");
}

/** Nombre sin sufijo de copia: base común de "X", "X - Copia", "X - Copia 2". */
export function duplicateTemplateNameBase(sourceName: string): string {
  return sourceName.trim().replace(/ - Copia(?: \d+)?$/i, "");
}

/**
 * Nombre de la copia: "{nombre} - Copia", o "{nombre} - Copia N" (N ≥ 2,
 * el primer número libre) si ya existe. Duplicar una copia no encadena
 * sufijos: "Poder - Copia" → "Poder - Copia 2".
 */
export function buildDuplicateTemplateName(
  sourceName: string,
  existingNames: readonly string[],
): string {
  const taken = new Set(existingNames.map(comparable));
  const base = duplicateTemplateNameBase(sourceName);

  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? COPY_SUFFIX : `${COPY_SUFFIX} ${n}`;
    const trimmedBase = base.slice(0, MAX_TEMPLATE_NAME_LENGTH - suffix.length).trimEnd();
    const candidate = `${trimmedBase}${suffix}`;
    if (!taken.has(comparable(candidate))) return candidate;
  }
}

/**
 * Copia profunda del documento con un `blockId` nuevo por cada Bloque de
 * opciones. Las variantes conservan sus IDs (son locales a su bloque y las
 * referencian `defaultVariantId` y `structuredOutput`). Nunca muta el
 * documento de origen.
 */
export function regenerateOptionBlockIds(
  source: TemplateDocument,
  newId: () => string = () => globalThis.crypto.randomUUID(),
): { document: TemplateDocument; blockIdMap: Map<string, string> } {
  const document = structuredClone(source);
  const blockIdMap = new Map<string, string>();
  for (const paragraph of document.content) {
    for (const node of paragraph.content ?? []) {
      if (node.type !== "optionBlock") continue;
      const next = newId();
      blockIdMap.set(node.attrs.blockId, next);
      node.attrs.blockId = next;
    }
  }
  return { document, blockIdMap };
}

export const DUPLICABLE_SIMPLE_INDEX_KEYS = [
  "instrument_number",
  "authorized_date",
  "authorized_time",
  "protocol_book",
  "initial_folio",
  "final_folio",
] as const;

type SimpleIndexKey = (typeof DUPLICABLE_SIMPLE_INDEX_KEYS)[number];

/** Configuración del Índice del Machote de origen (IDs del origen). */
export type DuplicableIndexConfiguration = {
  partySeparator: string;
  fixedSuffix: string | null;
  allowEmpty: boolean;
  simpleFields: Record<SimpleIndexKey, string | null>;
  authorizedTimeOptionBlockId: string | null;
  fields: Array<{ templateFieldId: string; order: number }>;
};

/**
 * Argumentos de `save_template_index_mapping_with_block_source` para la
 * copia: cada campo del origen se traduce a su equivalente en la copia por
 * `field_key` (única por Machote) y el Bloque de hora por el mapa de
 * `regenerateOptionBlockIds`. Una referencia que no se puede traducir
 * queda en null / se omite — nunca se reutiliza un ID del origen.
 */
export function buildDuplicateIndexMapping(input: {
  templateId: string;
  configuration: DuplicableIndexConfiguration;
  sourceFieldKeyById: ReadonlyMap<string, string>;
  targetFieldIdByKey: ReadonlyMap<string, string>;
  blockIdMap: ReadonlyMap<string, string>;
}) {
  const translate = (sourceId: string | null): string | null => {
    if (!sourceId) return null;
    const key = input.sourceFieldKeyById.get(sourceId);
    return key ? (input.targetFieldIdByKey.get(key) ?? null) : null;
  };
  const { configuration } = input;

  const simpleFields = Object.fromEntries(
    DUPLICABLE_SIMPLE_INDEX_KEYS.map((key) => [
      key,
      translate(configuration.simpleFields[key]),
    ]),
  ) as Record<SimpleIndexKey, string | null>;

  const partyFieldIds = [...configuration.fields]
    .sort((a, b) => a.order - b.order)
    .map((field) => translate(field.templateFieldId))
    .filter((id): id is string => id !== null);

  return {
    p_template_id: input.templateId,
    p_simple_fields: simpleFields,
    p_authorized_time_option_block_id: configuration.authorizedTimeOptionBlockId
      ? (input.blockIdMap.get(configuration.authorizedTimeOptionBlockId) ?? null)
      : null,
    p_party_separator: configuration.partySeparator,
    p_fixed_suffix: configuration.fixedSuffix,
    p_allow_empty: configuration.allowEmpty,
    p_party_fields: partyFieldIds.map((id, order) => ({
      template_field_id: id,
      sort_order: order,
    })),
  };
}
