/**
 * Contrato de la propuesta de Machote que devuelve un proveedor de IA.
 *
 * Es un contrato de DOMINIO, independiente del proveedor: cualquier adapter
 * (OpenAI hoy, otro mañana) debe producir exactamente esta forma. Dos
 * representaciones del mismo contrato:
 *
 * - `AI_TEMPLATE_PROPOSAL_JSON_SCHEMA`: JSON Schema estricto que se envía al
 *   proveedor como formato de salida estructurada (sin propiedades extra,
 *   todas requeridas, nulos explícitos);
 * - `AiTemplateProposalSchema`: validación Zod server-side. El schema del
 *   proveedor NO sustituye esta validación: la salida del modelo se trata
 *   siempre como input no confiable.
 *
 * Decisión clave de fidelidad: el modelo NUNCA devuelve el texto del
 * documento. Solo devuelve REFERENCIAS a fragmentos exactos del texto
 * original (número de párrafo + texto literal + número de aparición). LexCR
 * reconstruye el Machote desde el texto original de forma determinista
 * (`build-draft.ts`), así que el modelo no puede reescribir, resumir ni
 * agregar cláusulas al cuerpo del documento.
 *
 * El folio final no existe en este contrato a propósito: no puede inferirse
 * desde un Machote (depende de cómo termine impresa la escritura).
 *
 * v2: el patrón conocido Chasis/VIN/Serie tiene su propia estructura
 * (`vehicle_identifiers`). El modelo solo identifica el fragmento, el caso
 * que muestra el documento y las tres claves; LexCR construye las cinco
 * variantes de forma determinista (ver `build-draft.ts`).
 */

import { z } from "zod";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";
import { TEMPLATE_DOC_LIMITS } from "@/lib/editor/types";
import { VARIABLE_OUTPUT_TRANSFORMS } from "@/lib/editor/text-transforms";
import { AI_PROPOSAL_LIMITS as L } from "./limits";

export const AI_TEMPLATE_SCHEMA_VERSION = "lexcr.template_generation.v2";

/** Tipo semántico del dato: guía normalizaciones y mapeos del Índice. */
export const AI_VARIABLE_SEMANTIC_TYPES = [
  "person_name",
  "identification",
  "marital_status",
  "occupation",
  "address",
  "nationality",
  "date",
  "time_hour",
  "time_minutes",
  "day",
  "month",
  "year",
  "amount",
  "quantity",
  "instrument_number",
  "folio",
  "protocol_book",
  "vehicle_identifier",
  "plate",
  "property_identifier",
  "text",
] as const;
export type AiVariableSemanticType = (typeof AI_VARIABLE_SEMANTIC_TYPES)[number];

/**
 * Únicas justificaciones admitidas para crear un Bloque de opciones. No hay
 * una categoría "creatividad jurídica": sin una de estas bases, no se crea.
 */
export const AI_OPTION_BLOCK_BASES = [
  "known_pattern_time_minutes",
  "document_evidence",
  "user_instruction",
] as const;
export type AiOptionBlockBasis = (typeof AI_OPTION_BLOCK_BASES)[number];

/** Advertencias cerradas: nunca texto libre del modelo en la UI/DB. */
export const AI_PROPOSAL_WARNING_CODES = [
  "ambiguous_party_roles",
  "possible_missing_variables",
  "ambiguous_values",
  "option_block_skipped",
  "index_mapping_skipped",
  "document_contains_instructions",
  "document_not_legal_instrument",
  "low_text_quality",
] as const;
export type AiProposalWarningCode = (typeof AI_PROPOSAL_WARNING_CODES)[number];

/**
 * Caso de Chasis/VIN/Serie que muestra el documento original. LexCR genera
 * las otras cuatro combinaciones como variantes del mismo bloque.
 */
export const AI_VEHICLE_IDENTIFIER_CASES = [
  "all_equal",
  "chassis_vin_equal",
  "vin_serial_equal",
  "chassis_serial_equal",
  "all_different",
] as const;
export type AiVehicleIdentifierCase = (typeof AI_VEHICLE_IDENTIFIER_CASES)[number];

const keyString = z
  .string()
  .min(1)
  .max(TEMPLATE_DOC_LIMITS.maxVariableKeyLength)
  .regex(FIELD_KEY_PATTERN);
const shortText = (max: number) => z.string().min(1).max(max);
const positiveInt = z.number().int().min(1).max(100_000);

const OccurrenceSchema = z
  .object({
    paragraph: positiveInt,
    text: shortText(L.maxOccurrenceTextChars),
    occurrence: positiveInt,
  })
  .strict();

const VariableSchema = z
  .object({
    key: keyString,
    label: shortText(L.maxLabelChars),
    semantic_type: z.enum(AI_VARIABLE_SEMANTIC_TYPES),
    output_transform: z.enum(VARIABLE_OUTPUT_TRANSFORMS),
    required: z.boolean(),
    needs_review: z.boolean(),
    // Puede estar vacío solo para variables que aparecen únicamente en una
    // variante alternativa de un Bloque de opciones (p. ej. `vehiculo.serie`
    // cuando el documento original solo menciona el VIN).
    occurrences: z.array(OccurrenceSchema).max(L.maxOccurrencesPerVariable),
  })
  .strict();

const TimeKeysSchema = z
  .object({ hour_key: keyString, minute_key: keyString.nullable() })
  .strict();

const OptionBlockSchema = z
  .object({
    name: shortText(L.maxLabelChars),
    basis: z.enum(AI_OPTION_BLOCK_BASES),
    paragraph: positiveInt,
    text: shortText(L.maxBlockSpanChars),
    occurrence: positiveInt,
    original_variant_label: shortText(L.maxLabelChars),
    alternative_variants: z
      .array(
        z
          .object({
            label: shortText(L.maxLabelChars),
            content: shortText(L.maxVariantContentChars),
          })
          .strict(),
      )
      .min(1)
      .max(L.maxAlternativeVariants),
    time_output: z
      .object({
        original: TimeKeysSchema,
        alternatives: z.array(TimeKeysSchema).max(L.maxAlternativeVariants),
      })
      .strict()
      .nullable(),
  })
  .strict();

const VehicleIdentifiersSchema = z
  .object({
    paragraph: positiveInt,
    text: shortText(L.maxBlockSpanChars),
    occurrence: positiveInt,
    original_case: z.enum(AI_VEHICLE_IDENTIFIER_CASES),
    chassis_key: keyString,
    vin_key: keyString,
    serial_key: keyString,
  })
  .strict();

const NotarialIndexSchema = z
  .object({
    instrument_number_key: keyString.nullable(),
    authorized_date_key: keyString.nullable(),
    authorized_time_key: keyString.nullable(),
    authorized_time_option_block: z.number().int().min(0).max(100).nullable(),
    protocol_book_key: keyString.nullable(),
    initial_folio_key: keyString.nullable(),
    party_keys: z.array(keyString).max(L.maxPartyKeys),
  })
  .strict();

export const AiTemplateProposalSchema = z
  .object({
    schema_version: z.literal(AI_TEMPLATE_SCHEMA_VERSION),
    template: z
      .object({
        name: shortText(L.maxNameChars),
        description: z.string().max(L.maxDescriptionChars).nullable(),
      })
      .strict(),
    variables: z.array(VariableSchema).max(L.maxVariables),
    option_blocks: z.array(OptionBlockSchema).max(L.maxOptionBlocks),
    vehicle_identifiers: VehicleIdentifiersSchema.nullable(),
    notarial_index: NotarialIndexSchema,
    warnings: z.array(z.enum(AI_PROPOSAL_WARNING_CODES)).max(L.maxWarnings),
  })
  .strict();

export type AiTemplateProposal = z.infer<typeof AiTemplateProposalSchema>;
export type AiProposalVariable = AiTemplateProposal["variables"][number];
export type AiProposalOptionBlock = AiTemplateProposal["option_blocks"][number];
export type AiProposalVehicleIdentifiers = NonNullable<AiTemplateProposal["vehicle_identifiers"]>;

// ------------------------------------------------------------ JSON Schema

const KEY_PATTERN_SOURCE = FIELD_KEY_PATTERN.source;

const jsonKey = { type: "string", pattern: KEY_PATTERN_SOURCE } as const;
const jsonNullableKey = {
  type: ["string", "null"],
  pattern: KEY_PATTERN_SOURCE,
} as const;
const jsonTimeKeys = {
  type: "object",
  additionalProperties: false,
  required: ["hour_key", "minute_key"],
  properties: { hour_key: jsonKey, minute_key: jsonNullableKey },
} as const;

/**
 * JSON Schema estricto para la salida estructurada del proveedor. Usa solo
 * palabras clave ampliamente soportadas en modo estricto (type, enum,
 * pattern, required, additionalProperties:false, nulos por unión de
 * tipos). Los límites numéricos finos se aplican después con Zod.
 */
export const AI_TEMPLATE_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "template",
    "variables",
    "option_blocks",
    "vehicle_identifiers",
    "notarial_index",
    "warnings",
  ],
  properties: {
    schema_version: { type: "string", enum: [AI_TEMPLATE_SCHEMA_VERSION] },
    template: {
      type: "object",
      additionalProperties: false,
      required: ["name", "description"],
      properties: {
        name: { type: "string" },
        description: { type: ["string", "null"] },
      },
    },
    variables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "label",
          "semantic_type",
          "output_transform",
          "required",
          "needs_review",
          "occurrences",
        ],
        properties: {
          key: jsonKey,
          label: { type: "string" },
          semantic_type: { type: "string", enum: [...AI_VARIABLE_SEMANTIC_TYPES] },
          output_transform: {
            type: "string",
            enum: [...VARIABLE_OUTPUT_TRANSFORMS],
          },
          required: { type: "boolean" },
          needs_review: { type: "boolean" },
          occurrences: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["paragraph", "text", "occurrence"],
              properties: {
                paragraph: { type: "integer" },
                text: { type: "string" },
                occurrence: { type: "integer" },
              },
            },
          },
        },
      },
    },
    option_blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "basis",
          "paragraph",
          "text",
          "occurrence",
          "original_variant_label",
          "alternative_variants",
          "time_output",
        ],
        properties: {
          name: { type: "string" },
          basis: { type: "string", enum: [...AI_OPTION_BLOCK_BASES] },
          paragraph: { type: "integer" },
          text: { type: "string" },
          occurrence: { type: "integer" },
          original_variant_label: { type: "string" },
          alternative_variants: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "content"],
              properties: {
                label: { type: "string" },
                content: { type: "string" },
              },
            },
          },
          time_output: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["original", "alternatives"],
                properties: {
                  original: jsonTimeKeys,
                  alternatives: { type: "array", items: jsonTimeKeys },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
    vehicle_identifiers: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "paragraph",
            "text",
            "occurrence",
            "original_case",
            "chassis_key",
            "vin_key",
            "serial_key",
          ],
          properties: {
            paragraph: { type: "integer" },
            text: { type: "string" },
            occurrence: { type: "integer" },
            original_case: { type: "string", enum: [...AI_VEHICLE_IDENTIFIER_CASES] },
            chassis_key: jsonKey,
            vin_key: jsonKey,
            serial_key: jsonKey,
          },
        },
        { type: "null" },
      ],
    },
    notarial_index: {
      type: "object",
      additionalProperties: false,
      required: [
        "instrument_number_key",
        "authorized_date_key",
        "authorized_time_key",
        "authorized_time_option_block",
        "protocol_book_key",
        "initial_folio_key",
        "party_keys",
      ],
      properties: {
        instrument_number_key: jsonNullableKey,
        authorized_date_key: jsonNullableKey,
        authorized_time_key: jsonNullableKey,
        authorized_time_option_block: { type: ["integer", "null"] },
        protocol_book_key: jsonNullableKey,
        initial_folio_key: jsonNullableKey,
        party_keys: { type: "array", items: jsonKey },
      },
    },
    warnings: {
      type: "array",
      items: { type: "string", enum: [...AI_PROPOSAL_WARNING_CODES] },
    },
  },
} as const;

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type AiProposalParseResult =
  | { ok: true; proposal: AiTemplateProposal }
  | { ok: false };

/**
 * Parsea la salida cruda del proveedor. Rechaza JSON inválido, salidas
 * demasiado grandes y cualquier forma fuera del contrato (incluidas
 * propiedades extra, como un intento de "devolver el system prompt" en un
 * campo no previsto).
 */
export function parseAiTemplateProposal(raw: string): AiProposalParseResult {
  if (raw.length === 0 || raw.length > L.maxRawOutputChars) return { ok: false };
  let json: unknown;
  try {
    // Las claves de prototipo se rechazan explícitamente: `.strict()` de
    // Zod no las considera "propiedades extra".
    json = JSON.parse(raw, (key, value: unknown) => {
      if (DANGEROUS_KEYS.has(key)) throw new Error("dangerous_key");
      return value;
    });
  } catch {
    return { ok: false };
  }
  const result = AiTemplateProposalSchema.safeParse(json);
  return result.success ? { ok: true, proposal: result.data } : { ok: false };
}
