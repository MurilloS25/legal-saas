import { isoToCostaRicaLocal } from "./datetime";
import type {
  NotarialMetadata,
  NotarialMetadataSuggestions,
} from "./notarial";
import type {
  SimpleIndexMappingKey,
  TemplateIndexConfiguration,
} from "./template-index-configuration";
import {
  normalizeNotarialValue,
  NOTARIAL_SEMANTIC_TYPES,
} from "./normalization";
import type { TemplateDocument } from "@/lib/editor/types";
import { resolveOptionBlockTime } from "./option-block-time";
import { resolveDerivedPrecedence } from "./derived-precedence";

/**
 * `"template"` = el valor refleja la derivación automática actual (recién
 * calculada o coincide con lo guardado). `"saved"` = corrección manual
 * preservada (diverge de lo que la derivación produciría). `"suggestion"` =
 * sugerencia sin fuente real (continuidad numérica). `"empty"` = nada.
 */
export type NotarialPrefillSource =
  | "saved"
  | "template"
  | "suggestion"
  | "empty";

export type NotarialPrefillField = {
  value: string;
  source: NotarialPrefillSource;
  compatible: boolean;
  rawValue?: string;
  /** Solo `true` cuando `source === "saved"` (corrección manual preservada)
   * Y la derivación actual ya no coincide con la que había cuando se hizo
   * esa corrección — sugiere revisión sin sobrescribir nada. */
  sourceChanged?: boolean;
  /** Lo que la derivación automática produce AHORA MISMO (normalizado,
   * compatible con lo que se persiste) — `null` si nada es derivable.
   * Viaja como input oculto hasta `saveNotarialMetadataAction`, que lo
   * guarda tal cual en `<campo>_derived_snapshot`: la derivación real ya
   * se hizo aquí (server component, misma fuente confiable que el resto
   * del formulario), no hace falta recalcularla en la Server Action. */
  derivedNow: string | null;
};

export type NotarialAuthorizedAtPrefill = {
  date: NotarialPrefillField;
  time: NotarialPrefillField;
  optionBlockName?: string;
  optionVariantLabel?: string;
};

export type NotarialMetadataPrefill = {
  instrumentNumber: NotarialPrefillField;
  authorizedAt: NotarialAuthorizedAtPrefill;
  protocolBook: NotarialPrefillField;
  initialFolio: NotarialPrefillField;
  finalFolio: NotarialPrefillField;
  actName: NotarialPrefillField;
  parties: NotarialPrefillField;
};

type AvailableField = { id: string; fieldKey: string };

type ResolveInput = {
  metadata: NotarialMetadata | null;
  configuration: TemplateIndexConfiguration | null;
  availableFields: readonly AvailableField[];
  fieldValues: Record<string, unknown>;
  templateDocument?: TemplateDocument;
  optionSelections?: Record<string, string>;
  templateName: string | null;
  generatedParties: string | null;
  suggestions: NotarialMetadataSuggestions;
};

const emptyField = (derivedNow: string | null = null): NotarialPrefillField => ({
  value: "",
  source: "empty",
  compatible: true,
  derivedNow,
});

function mappedValue(
  key: SimpleIndexMappingKey,
  configuration: TemplateIndexConfiguration | null,
  availableFields: readonly AvailableField[],
  fieldValues: Record<string, unknown>,
): string | null {
  const mappedId = configuration?.simpleFields[key];
  if (!mappedId) return null;
  const field = availableFields.find((candidate) => candidate.id === mappedId);
  if (!field) return null;
  const value = fieldValues[field.fieldKey];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

/**
 * Campo numérico simple (instrument_number/protocol_book/initial_folio/
 * final_folio; los folios admiten además la cara F/V — ver
 * `normalizeNotarialValue`) con precedencia manual-vs-derivado. `effective`/`lastSnapshot`
 * vienen de `metadata` (null si nunca se guardó nada — el mismo código
 * cubre "primera vez" y "ya guardado, sin tocar" sin una rama aparte).
 */
function integerPrecedenceField(
  key: "instrument_number" | "protocol_book" | "initial_folio" | "final_folio",
  effective: string | number | null,
  lastSnapshot: string | number | null,
  derivedRaw: string | null,
  suggestion: string | number | null,
): NotarialPrefillField {
  const derivedNormalized =
    derivedRaw === null
      ? null
      : normalizeNotarialValue({
          value: derivedRaw,
          type: NOTARIAL_SEMANTIC_TYPES[key],
          locale: "es-CR",
        });
  // Una fuente que no se pudo interpretar cuenta como "nada derivable"
  // (`derivedNow = null`), NUNCA como un cortocircuito que ignore un valor
  // ya guardado — si no, una corrección manual válida quedaría oculta cada
  // vez que la variable mapeada, hoy, resulta ilegible (ver test
  // "ambiguous input requires a manual correction that survives reload").
  const derivedIncompatible = derivedRaw !== null && !derivedNormalized?.ok;
  const derivedNow = derivedNormalized?.ok ? String(derivedNormalized.value) : null;

  const precedence = resolveDerivedPrecedence(
    effective === null ? null : String(effective),
    lastSnapshot === null ? null : String(lastSnapshot),
    derivedNow,
  );
  if (precedence.value !== null) {
    return {
      value: precedence.value,
      source: precedence.isManualOverride ? "saved" : "template",
      compatible: true,
      rawValue: derivedRaw ?? undefined,
      sourceChanged: precedence.isManualOverride
        ? precedence.sourceChanged
        : undefined,
      derivedNow,
    };
  }
  if (derivedIncompatible) {
    // Nada persistido que preservar Y la fuente no se pudo interpretar —
    // aquí sí hace falta corrección manual desde cero.
    return {
      value: "",
      source: "template",
      compatible: false,
      rawValue: derivedRaw,
      derivedNow: null,
    };
  }
  if (suggestion !== null) {
    const normalizedSuggestion = normalizeNotarialValue({
      value: String(suggestion),
      type: NOTARIAL_SEMANTIC_TYPES[key],
      locale: "es-CR",
    });
    return {
      value: normalizedSuggestion.ok ? String(normalizedSuggestion.value) : "",
      source: "suggestion",
      compatible: true,
      derivedNow,
    };
  }
  return emptyField(derivedNow);
}

/**
 * Parte de fecha u hora de `authorized_at`, con la misma precedencia.
 * `precomputedNormalized`: para la hora de un Bloque de opciones, que ya
 * llega interpretada por `resolveOptionBlockTime` (su propio "Original: ..."
 * usa un formato de presentación, "diez / veinte", que no tiene sentido
 * volver a pasar por `normalizeNotarialValue` como si fuera la fuente
 * cruda) — se usa tal cual en vez de renormalizar `derivedRaw`.
 */
function authorizedAtPartField(
  type: "authorized_date" | "authorized_time",
  effective: string | null,
  lastSnapshot: string | null,
  derivedRaw: string | null,
  precomputedNormalized?: { ok: true; value: string } | { ok: false },
): NotarialPrefillField {
  const derivedNormalized =
    precomputedNormalized ??
    (derivedRaw === null
      ? null
      : normalizeNotarialValue({
          value: derivedRaw,
          type: NOTARIAL_SEMANTIC_TYPES[type],
          locale: "es-CR",
        }));
  // Igual que en `integerPrecedenceField`: una fuente ilegible es "nada
  // derivable", nunca un cortocircuito que oculte un valor ya guardado.
  const derivedIncompatible = derivedRaw !== null && !derivedNormalized?.ok;
  const derivedNow = derivedNormalized?.ok ? String(derivedNormalized.value) : null;
  const precedence = resolveDerivedPrecedence(effective, lastSnapshot, derivedNow);
  if (precedence.value !== null) {
    return {
      value: precedence.value,
      source: precedence.isManualOverride ? "saved" : "template",
      compatible: true,
      rawValue: derivedRaw ?? undefined,
      sourceChanged: precedence.isManualOverride
        ? precedence.sourceChanged
        : undefined,
      derivedNow,
    };
  }
  if (derivedIncompatible) {
    return {
      value: "",
      source: "template",
      compatible: false,
      rawValue: derivedRaw,
      derivedNow: null,
    };
  }
  return emptyField(derivedNow);
}

export function resolveNotarialMetadataPrefill({
  metadata,
  configuration,
  availableFields,
  fieldValues,
  templateDocument,
  optionSelections = {},
  templateName,
  generatedParties,
  suggestions,
}: ResolveInput): NotarialMetadataPrefill {
  const mapped = (key: SimpleIndexMappingKey) =>
    mappedValue(key, configuration, availableFields, fieldValues);
  const optionBlockTime =
    configuration?.authorizedTimeOptionBlockId && templateDocument
      ? resolveOptionBlockTime(
          templateDocument,
          configuration.authorizedTimeOptionBlockId,
          optionSelections,
          fieldValues,
        )
      : undefined;
  // El Bloque de opciones es una fuente alternativa a un mapeo directo de
  // variable — nunca ambas a la vez (ver UI de "Hora de autorización" en
  // TemplateIndexConfigurationSection). `derivedTimeRaw` alimenta el hint
  // "Original: ..."; `resolveOptionBlockTime` ya normaliza internamente,
  // así que ese resultado se pasa tal cual en vez de renormalizarlo.
  const derivedTimeRaw = optionBlockTime
    ? (optionBlockTime.rawValue ?? null)
    : mapped("authorized_time");
  const precomputedTime = optionBlockTime
    ? optionBlockTime.ok
      ? ({ ok: true, value: optionBlockTime.value } as const)
      : ({ ok: false } as const)
    : undefined;

  const instrumentNumber = integerPrecedenceField(
    "instrument_number",
    metadata?.instrument_number ?? null,
    metadata?.instrument_number_derived_snapshot ?? null,
    mapped("instrument_number"),
    suggestions.instrumentNumber,
  );
  const dateField = authorizedAtPartField(
    "authorized_date",
    metadata ? isoToCostaRicaLocal(metadata.authorized_at)?.split("T")[0] || null : null,
    metadata?.authorized_date_derived_snapshot ?? null,
    mapped("authorized_date"),
  );
  const timeField = authorizedAtPartField(
    "authorized_time",
    metadata ? isoToCostaRicaLocal(metadata.authorized_at)?.split("T")[1] || null : null,
    metadata?.authorized_time_derived_snapshot ?? null,
    derivedTimeRaw,
    precomputedTime,
  );
  const protocolBook = integerPrecedenceField(
    "protocol_book",
    metadata?.protocol_book ?? null,
    metadata?.protocol_book_derived_snapshot ?? null,
    mapped("protocol_book"),
    suggestions.protocolBook,
  );
  const initialFolio = integerPrecedenceField(
    "initial_folio",
    metadata?.initial_folio ?? null,
    metadata?.initial_folio_derived_snapshot ?? null,
    mapped("initial_folio"),
    suggestions.initialFolio,
  );
  const finalFolio = integerPrecedenceField(
    "final_folio",
    metadata?.final_folio ?? null,
    metadata?.final_folio_derived_snapshot ?? null,
    mapped("final_folio"),
    // Sin sugerencia propia — igual que antes, cae a folio inicial si no
    // hay nada más (el usuario normalmente empieza igual y ajusta).
    suggestions.initialFolio,
  );

  // Acto y Partes ya tenían override/snapshot antes de este cambio — la
  // única corrección real aquí es que el snapshot ahora se compara con la
  // derivación EN VIVO en vez de mostrarse siempre congelado.
  const actNamePrecedence = resolveDerivedPrecedence(
    metadata?.act_name_override ?? null,
    metadata?.act_name_snapshot ?? null,
    templateName,
  );
  const actName: NotarialPrefillField = actNamePrecedence.value
    ? {
        value: actNamePrecedence.value,
        source: actNamePrecedence.isManualOverride ? "saved" : "template",
        compatible: true,
        sourceChanged: actNamePrecedence.isManualOverride
          ? actNamePrecedence.sourceChanged
          : undefined,
        derivedNow: templateName,
      }
    : emptyField(templateName);

  const partiesPrecedence = resolveDerivedPrecedence(
    metadata?.parties_override ?? null,
    metadata?.generated_parties ?? null,
    generatedParties,
  );
  const parties: NotarialPrefillField = partiesPrecedence.value
    ? {
        value: partiesPrecedence.value,
        source: partiesPrecedence.isManualOverride ? "saved" : "template",
        compatible: true,
        sourceChanged: partiesPrecedence.isManualOverride
          ? partiesPrecedence.sourceChanged
          : undefined,
        derivedNow: generatedParties,
      }
    : emptyField(generatedParties);

  return {
    instrumentNumber,
    authorizedAt: {
      date: dateField,
      time: timeField,
      optionBlockName: optionBlockTime?.blockName,
      optionVariantLabel: optionBlockTime?.variantLabel,
    },
    protocolBook,
    initialFolio,
    finalFolio,
    actName,
    parties,
  };
}
