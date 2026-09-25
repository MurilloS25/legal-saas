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
 *
 * v3:
 * - `required` ya no es parte del contrato: toda variable generada con IA
 *   es opcional (`required = false`), decidido por LexCR, no por el modelo;
 * - una variante alternativa puede ser vacía ("" = la cláusula no existe en
 *   esa modalidad, p. ej. "Sin garantía");
 * - patrón conocido Cédula / DIMEX / Pasaporte (`identification_types`): el
 *   modelo solo señala el fragmento, la clave y el tipo que muestra el
 *   documento; LexCR construye las variantes adaptando solo la mención del
 *   documento;
 * - validación POR ÍTEM: un ítem inválido (una variable, un bloque) se
 *   descarta con un código de incidencia en lugar de invalidar toda la
 *   propuesta. La forma de primer nivel (JSON, campos, Índice) sigue siendo
 *   estricta.
 */

import { z } from "zod";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";
import { TEMPLATE_DOC_LIMITS } from "@/lib/editor/types";
import { VARIABLE_OUTPUT_TRANSFORMS } from "@/lib/editor/text-transforms";
import { AI_PROPOSAL_LIMITS as L } from "./limits";

export const AI_TEMPLATE_SCHEMA_VERSION = "lexcr.template_generation.v3";

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

/** Tipos de documento de identificación del patrón conocido. */
export const AI_IDENTIFICATION_DOCUMENT_TYPES = ["cedula", "dimex", "pasaporte"] as const;
export type AiIdentificationDocumentType = (typeof AI_IDENTIFICATION_DOCUMENT_TYPES)[number];

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

// Ítems: los campos desconocidos se IGNORAN (`.strip()`), nunca se usan ni
// se guardan; así un campo extra inofensivo no descarta cada variable. El
// primer nivel y el Índice siguen siendo estrictos (`.strict()`).
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
  .strip();

const VariableSchema = z
  .object({
    key: keyString,
    label: shortText(L.maxLabelChars),
    semantic_type: z.enum(AI_VARIABLE_SEMANTIC_TYPES),
    output_transform: z.enum(VARIABLE_OUTPUT_TRANSFORMS),
    needs_review: z.boolean(),
    // Puede estar vacío solo para variables que aparecen únicamente en una
    // variante alternativa de un Bloque de opciones (p. ej. `vehiculo.serie`
    // cuando el documento original solo menciona el VIN).
    occurrences: z.array(OccurrenceSchema).max(L.maxOccurrencesPerVariable),
  })
  .strip();

const TimeKeysSchema = z
  .object({ hour_key: keyString, minute_key: keyString.nullable() })
  .strip();

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
            // "" es válido: la cláusula no existe en esa modalidad.
            content: z.string().max(L.maxVariantContentChars),
          })
          .strip(),
      )
      .min(1)
      .max(L.maxAlternativeVariants),
    time_output: z
      .object({
        original: TimeKeysSchema,
        alternatives: z.array(TimeKeysSchema).max(L.maxAlternativeVariants),
      })
      .strip()
      .nullable(),
  })
  .strip();

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
  .strip();

const IdentificationTypeSchema = z
  .object({
    paragraph: positiveInt,
    text: shortText(L.maxBlockSpanChars),
    occurrence: positiveInt,
    identification_key: keyString,
    original_type: z.enum(AI_IDENTIFICATION_DOCUMENT_TYPES),
  })
  .strip();

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
    identification_types: z.array(IdentificationTypeSchema).max(L.maxIdentificationTypes),
    notarial_index: NotarialIndexSchema,
    warnings: z.array(z.enum(AI_PROPOSAL_WARNING_CODES)).max(L.maxWarnings),
  })
  .strict();

export type AiTemplateProposal = z.infer<typeof AiTemplateProposalSchema>;
export type AiProposalVariable = AiTemplateProposal["variables"][number];
export type AiProposalOptionBlock = AiTemplateProposal["option_blocks"][number];
export type AiProposalVehicleIdentifiers = NonNullable<AiTemplateProposal["vehicle_identifiers"]>;
export type AiProposalIdentificationType = AiTemplateProposal["identification_types"][number];

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
    "identification_types",
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
    identification_types: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["paragraph", "text", "occurrence", "identification_key", "original_type"],
        properties: {
          paragraph: { type: "integer" },
          text: { type: "string" },
          occurrence: { type: "integer" },
          identification_key: jsonKey,
          original_type: { type: "string", enum: [...AI_IDENTIFICATION_DOCUMENT_TYPES] },
        },
      },
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

/**
 * Incidencias del parseo por ítem. Solo códigos y rutas estructurales
 * (`variables[3]`), nunca contenido del documento: deciden el retry de
 * reparación, viajan al proveedor en ese retry y se registran como códigos.
 */
export const AI_PROPOSAL_ISSUE_CODES = [
  "output_not_json",
  "output_too_large",
  "envelope_invalid",
  "template_invalid",
  "variable_invalid",
  "option_block_invalid",
  "vehicle_identifiers_invalid",
  "identification_type_invalid",
  "warning_invalid",
  "too_many_items",
] as const;
export type AiProposalIssueCode = (typeof AI_PROPOSAL_ISSUE_CODES)[number];
export type AiProposalIssue = { code: AiProposalIssueCode; path: string };

export type AiProposalParseResult =
  | { ok: true; proposal: AiTemplateProposal; issues: AiProposalIssue[] }
  | { ok: false; issues: AiProposalIssue[] };

/** Forma de primer nivel: estricta. Los ítems se validan uno por uno. */
const EnvelopeSchema = z
  .object({
    schema_version: z.literal(AI_TEMPLATE_SCHEMA_VERSION),
    template: z.unknown(),
    variables: z.array(z.unknown()),
    option_blocks: z.array(z.unknown()),
    vehicle_identifiers: z.unknown(),
    identification_types: z.array(z.unknown()),
    // El Índice sigue siendo estricto: p. ej. un folio final contrabandeado
    // invalida la propuesta completa.
    notarial_index: NotarialIndexSchema,
    warnings: z.array(z.unknown()),
  })
  .strict();

const TemplateInfoSchema = z
  .object({
    name: shortText(L.maxNameChars),
    description: z.string().max(L.maxDescriptionChars).nullable(),
  })
  .strict();

function itemsOf<T>(
  items: unknown[],
  schema: z.ZodType<T>,
  max: number,
  path: string,
  code: AiProposalIssueCode,
  issues: AiProposalIssue[],
): T[] {
  const out: T[] = [];
  items.forEach((item, index) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else issues.push({ code, path: `${path}[${index}]` });
  });
  if (out.length > max) {
    issues.push({ code: "too_many_items", path });
    return out.slice(0, max);
  }
  return out;
}

/**
 * Parsea la salida cruda del proveedor. Rechaza (sin propuesta) JSON
 * inválido, salidas demasiado grandes, claves de prototipo y cualquier
 * forma de primer nivel fuera del contrato (incluidas propiedades extra,
 * como un intento de "devolver el system prompt"). Dentro de esa forma,
 * cada ítem inválido se descarta con una incidencia: una sola variable mal
 * formada ya no invalida toda la generación.
 */
export function parseAiTemplateProposal(raw: string): AiProposalParseResult {
  if (raw.length === 0) return { ok: false, issues: [{ code: "output_not_json", path: "$" }] };
  if (raw.length > L.maxRawOutputChars) {
    return { ok: false, issues: [{ code: "output_too_large", path: "$" }] };
  }
  let json: unknown;
  try {
    // Las claves de prototipo se rechazan explícitamente: `.strict()` de
    // Zod no las considera "propiedades extra".
    json = JSON.parse(raw, (key, value: unknown) => {
      if (DANGEROUS_KEYS.has(key)) throw new Error("dangerous_key");
      return value;
    });
  } catch {
    return { ok: false, issues: [{ code: "output_not_json", path: "$" }] };
  }
  const envelope = EnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    return { ok: false, issues: [{ code: "envelope_invalid", path: "$" }] };
  }

  const issues: AiProposalIssue[] = [];
  const data = envelope.data;
  const template = TemplateInfoSchema.safeParse(data.template);
  if (!template.success) issues.push({ code: "template_invalid", path: "template" });

  let vehicle: AiProposalVehicleIdentifiers | null = null;
  if (data.vehicle_identifiers !== null) {
    const parsed = VehicleIdentifiersSchema.safeParse(data.vehicle_identifiers);
    if (parsed.success) vehicle = parsed.data;
    else issues.push({ code: "vehicle_identifiers_invalid", path: "vehicle_identifiers" });
  }

  const warnings = itemsOf(
    data.warnings,
    z.enum(AI_PROPOSAL_WARNING_CODES),
    L.maxWarnings,
    "warnings",
    "warning_invalid",
    issues,
  );

  const proposal: AiTemplateProposal = {
    schema_version: AI_TEMPLATE_SCHEMA_VERSION,
    // Sin nombre válido, el constructor usa su nombre por defecto.
    template: template.success ? template.data : { name: " ", description: null },
    variables: itemsOf(data.variables, VariableSchema, L.maxVariables, "variables", "variable_invalid", issues),
    option_blocks: itemsOf(
      data.option_blocks,
      OptionBlockSchema,
      L.maxOptionBlocks,
      "option_blocks",
      "option_block_invalid",
      issues,
    ),
    vehicle_identifiers: vehicle,
    identification_types: itemsOf(
      data.identification_types,
      IdentificationTypeSchema,
      L.maxIdentificationTypes,
      "identification_types",
      "identification_type_invalid",
      issues,
    ),
    notarial_index: data.notarial_index,
    warnings: [...new Set(warnings)],
  };
  return { ok: true, proposal, issues };
}
