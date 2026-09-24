/**
 * Construcción determinista del borrador de Machote a partir de:
 *
 * 1. el TEXTO ORIGINAL extraído (fuente de verdad textual), y
 * 2. la PROPUESTA estructurada del modelo (ya validada con Zod), que solo
 *    contiene referencias a fragmentos exactos de ese texto.
 *
 * El resultado usa exclusivamente el modelo actual de LexCR: documento
 * Tiptap canónico (`TemplateDocument`), variables del workspace
 * (`TemplateWorkspaceVariable`) y un plan de mapeo del Índice Notarial que
 * luego se guarda con la RPC existente. No hay un segundo modelo de
 * Machote.
 *
 * Garantías por construcción:
 * - todo texto fuera de variables y bloques se copia literalmente del
 *   original (el modelo no puede reescribirlo, resumirlo ni ampliarlo);
 * - una referencia que no se encuentra exactamente en su párrafo se
 *   descarta (nunca se "adivina" su posición);
 * - solapamientos se resuelven de forma determinista y conservadora;
 * - un Bloque de opciones sin base admitida (patrón conocido verificable,
 *   evidencia del documento o indicación explícita del usuario) se descarta;
 * - la variante predeterminada de cada bloque ES el texto original;
 * - el folio final nunca se mapea;
 * - el resultado pasa por los validadores actuales del editor y del
 *   workspace antes de devolverse.
 */

import { parseVariantContentText } from "@/lib/editor/option-blocks";
import {
  TEMPLATE_DOC_LIMITS,
  type TemplateDocument,
  type TemplateInlineNode,
  type TemplateOptionBlockAttrs,
  type TemplateOptionBlockStructuredOutput,
  type TemplateParagraphNode,
  type TemplateVariantContentNode,
} from "@/lib/editor/types";
import { validateTemplateDocument } from "@/lib/editor/validate";
import type { VariableOutputTransform } from "@/lib/editor/text-transforms";
import {
  TemplateWorkspaceVariableSchema,
  type TemplateWorkspaceVariable,
} from "../template-workspace";
import { stripDiacritics, suggestAutofillSource } from "../variable-autofill";
import { AI_PROPOSAL_LIMITS } from "./limits";
import type {
  AiIdentificationDocumentType,
  AiProposalOptionBlock,
  AiProposalVariable,
  AiProposalVehicleIdentifiers,
  AiProposalWarningCode,
  AiTemplateProposal,
  AiVariableSemanticType,
  AiVehicleIdentifierCase,
} from "./proposal";
import { findNth, locateReference } from "./references";
import { isCoherentTimeBlock } from "./semantic-validation";

export const AI_BUILDER_WARNING_CODES = [
  "occurrence_not_found",
  "overlap_discarded",
  "option_block_discarded",
  "option_variant_discarded",
  "time_output_discarded",
  "time_block_discarded",
  "transform_corrected",
  "index_mapping_discarded",
  "vehicle_identifier_block_missing",
  "professional_data_kept_fixed",
  "nationality_completed",
  "identification_type_skipped",
] as const;
export type AiBuilderWarningCode = (typeof AI_BUILDER_WARNING_CODES)[number];
export type AiDraftWarningCode = AiProposalWarningCode | AiBuilderWarningCode;

export const FALLBACK_AI_TEMPLATE_NAME = "Machote generado con IA";

export type AiIndexPlan = {
  simpleFieldKeys: {
    instrument_number: string | null;
    authorized_date: string | null;
    authorized_time: string | null;
    protocol_book: string | null;
    initial_folio: string | null;
  };
  /** `blockId` del Bloque de Hora; excluyente con `authorized_time`. */
  authorizedTimeOptionBlockId: string | null;
  partyKeys: string[];
};

export type AiDraftSummary = {
  variableCount: number;
  optionBlockCount: number;
  indexMappingCount: number;
};

export type AiTemplateDraft = {
  name: string;
  description: string | null;
  document: TemplateDocument;
  variables: TemplateWorkspaceVariable[];
  indexPlan: AiIndexPlan;
  summary: AiDraftSummary;
  /** Claves marcadas por el modelo como "requiere revisión". */
  reviewKeys: string[];
  warnings: AiDraftWarningCode[];
};

export type BuildAiDraftResult =
  | { ok: true; draft: AiTemplateDraft }
  | { ok: false; code: "invalid_output" | "no_variables" };

type BuildInput = {
  sourceText: string;
  proposal: AiTemplateProposal;
  /**
   * Indicaciones del abogado ("Notas para la IA"), ya normalizadas,
   * o null. Se usan solo para reglas deterministas cerradas (p. ej. si piden
   * parametrizar los datos del profesional); nunca como instrucciones.
   */
  instructions: string | null;
  /** Inyectable para pruebas deterministas. */
  generateId?: () => string;
};

// ------------------------------------------------------------ helpers

/** Separa el texto normalizado en párrafos (numerados desde 1 en el prompt). */
export function splitSourceParagraphs(sourceText: string): string[] {
  return sourceText.split("\n");
}

function sanitizeLabel(raw: string, max: number): string {
  let out = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    out += code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? " " : char;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeForMatch(text: string): string {
  return stripDiacritics(text).toLowerCase();
}

// ------------------------------------------ datos del profesional (fijos)

/**
 * Segmentos de clave que identifican al profesional autor del Machote
 * (notario/abogado que redacta o autoriza). Por defecto esos datos quedan
 * como texto FIJO: el abogado convierte su propio documento en Machote para
 * reutilizarlo él mismo.
 */
const PROFESSIONAL_KEY_TOKENS = new Set([
  "notario",
  "notaria",
  "abogado",
  "abogada",
  "profesional",
  "licenciado",
  "licenciada",
  "autorizante",
  "carne",
]);

export function isProfessionalDataKey(key: string): boolean {
  return normalizeForMatch(key)
    .split(/[._]/)
    .some((token) => PROFESSIONAL_KEY_TOKENS.has(token));
}

/** Las indicaciones piden explícitamente parametrizar al profesional. */
export function instructionsRequestProfessionalData(instructions: string | null): boolean {
  if (!instructions) return false;
  return /\b(notari[oa]s?|abogad[oa]s?|profesional(es)?|licenciad[oa]s?|autorizante)\b/.test(
    normalizeForMatch(instructions),
  );
}

// ------------------------------------------------- nacionalidad de Partes

/**
 * Gentilicios frecuentes en escrituras de Costa Rica (lista cerrada; sin
 * coincidencia difusa). Si uno queda como texto literal justo después del
 * nombre de una Parte, LexCR lo convierte en `rol.nacionalidad`.
 */
/** Palabras completas, con plural opcional ("costarricenses"). */
const NATIONALITY_WORDS = ["costarricense", "nicaraguense", "estadounidense", "canadiense", "belga"];
/** Terminan en consonante; femenino/plural opcional ("alemán", "alemana"). */
const NATIONALITY_CONSONANT_WORDS = [
  "aleman", "frances", "ingles", "portugues", "holandes", "japones", "espanol",
];
/** Raíces que exigen -o/-a ("uruguayo", nunca el país "Uruguay"). */
const NATIONALITY_STEMS = [
  "panamen", "salvadoren", "honduren", "guatemaltec", "mexican", "colombian",
  "venezolan", "cuban", "dominican", "peruan", "ecuatorian", "argentin", "chilen",
  "uruguay", "paraguay", "bolivian", "brasilen", "italian", "britanic", "suiz",
  "suec", "chin", "corean", "rus", "austriac",
];
const NATIONALITY_PATTERN = new RegExp(
  `\\b(?:(?:${NATIONALITY_WORDS.join("|")})s?|israeli(?:es)?|(?:${NATIONALITY_CONSONANT_WORDS.join("|")})(?:a|as|es)?|(?:${NATIONALITY_STEMS.join("|")})(?:o|a|os|as))\\b`,
  "g",
);

/** Rangos [start, end) de gentilicios de la lista en un párrafo. */
export function findNationalityMentions(paragraph: string): Array<{ start: number; end: number }> {
  // stripDiacritics preserva la longitud en texto NFC compuesto (un carácter
  // acentuado se reemplaza por uno sin acento), así que las posiciones del
  // texto normalizado son las del original.
  const normalized = normalizeForMatch(paragraph);
  if (normalized.length !== paragraph.length) return [];
  return [...normalized.matchAll(NATIONALITY_PATTERN)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

// ------------------------------------ patrón Cédula / DIMEX / Pasaporte

const IDENTIFICATION_TYPE_LABELS: Record<AiIdentificationDocumentType, string> = {
  cedula: "Cédula",
  dimex: "DIMEX",
  pasaporte: "Pasaporte",
};
/** Redacción mínima de cada modalidad: solo el nombre del documento. */
const IDENTIFICATION_TYPE_PHRASES: Record<AiIdentificationDocumentType, string> = {
  cedula: "cédula de identidad",
  dimex: "DIMEX",
  pasaporte: "pasaporte",
};
/** Mención del documento de identificación dentro del fragmento. */
const IDENTIFICATION_PHRASE_PATTERN =
  /c[eé]dula de identidad|c[eé]dula de residencia|c[eé]dula|documento de identidad migratorio para extranjeros|dimex|pasaporte/i;

/**
 * Mención del documento JUSTO antes del número de una Parte ("cédula de
 * identidad número ", "pasaporte No. ", "DIMEX: "). Nunca incluye "cédula
 * jurídica": el patrón es solo para personas físicas.
 */
const IDENTIFICATION_LEADING_PATTERN =
  /(c[eé]dula de identidad|c[eé]dula de residencia|c[eé]dula|documento de identidad migratorio para extranjeros|dimex|pasaporte)(?:\s+(?:n[uú]mero|no\.|n[°º]\.?))?\s*:?\s*$/i;
const IDENTIFICATION_LOOKBEHIND_CHARS = 70;
/** Datos (último segmento) de una clave que es el número de identificación. */
const IDENTIFICATION_DATA_KEYS = new Set([
  "cedula",
  "identificacion",
  "numero_identificacion",
  "cedula_identidad",
  "documento_identidad",
]);
/** Roles que representan una persona jurídica (el patrón no aplica). */
const LEGAL_ENTITY_ROLE_TOKENS = new Set([
  "sociedad",
  "empresa",
  "compania",
  "persona_juridica",
  "entidad",
  "corporacion",
  "asociacion",
  "fundacion",
  "cooperativa",
]);
/** Formato de cédula jurídica costarricense (3-101-123456). */
const LEGAL_ENTITY_ID_PATTERN = /^3-?\d{3}-?\d{6}$/;

/**
 * El abogado desactiva explícitamente el patrón ("solo cédula", "sin DIMEX
 * ni pasaporte", "no agregues opciones de tipo de identificación"). Sin una
 * exclusión explícita, el patrón canónico aplica.
 */
export function identificationTypesDisabledByNotes(instructions: string | null): boolean {
  const notes = normalizeForMatch(instructions ?? "");
  return (
    /\b(solo|solamente|unicamente)\s+(con\s+)?cedula\b/.test(notes) ||
    /\bsin\s+(opciones?\s+de\s+)?(dimex|pasaporte|tipos?\s+de\s+(documento|identificacion))\b/.test(notes) ||
    /\bno\s+(ofrezcas?|agregues|agregar|incluyas|incluir|crees|crear|uses|usar)\s+(opciones?\s+de\s+)?(dimex|pasaporte|tipos?\s+de\s+(documento|identificacion))\b/.test(
      notes,
    )
  );
}

function documentTypeOf(phrase: string): AiIdentificationDocumentType {
  const normalized = normalizeForMatch(phrase);
  if (/pasaporte/.test(normalized)) return "pasaporte";
  if (/dimex|residencia|migratorio/.test(normalized)) return "dimex";
  return "cedula";
}

/** La identificación es de una persona jurídica: el patrón no aplica. */
function isLegalEntityIdentification(key: string, spanText: string, value: string): boolean {
  const role = normalizeForMatch(key.split(".")[0] ?? "");
  return (
    role.split("_").some((token) => LEGAL_ENTITY_ROLE_TOKENS.has(token)) ||
    LEGAL_ENTITY_ROLE_TOKENS.has(role) ||
    /jur[ií]dica/i.test(spanText) ||
    LEGAL_ENTITY_ID_PATTERN.test(value.trim())
  );
}

function adaptIdentificationPhrase(text: string, target: AiIdentificationDocumentType): string {
  return text.replace(IDENTIFICATION_PHRASE_PATTERN, (match) => {
    const phrase = IDENTIFICATION_TYPE_PHRASES[target];
    return match === match.toUpperCase() ? phrase.toUpperCase() : phrase;
  });
}

/**
 * Tipos semánticos que se expresan como NÚMERO COMPLETO en palabras en una
 * escritura (30 minutos → TREINTA, folio 27 → VEINTISIETE). Nunca dígito
 * por dígito: si el modelo propone `digits_to_words` para uno de estos, se
 * corrige a `number_to_words` de forma determinista.
 */
const WHOLE_NUMBER_TYPES = new Set<AiVariableSemanticType>([
  "time_hour",
  "time_minutes",
  "day",
  "year",
  "quantity",
  "amount",
  "folio",
  "instrument_number",
]);

/**
 * Identificadores técnicos alfanuméricos (cédula, VIN, chasis, serie, motor,
 * placa, matrícula…). En la escritura se expresan carácter por carácter con
 * la transformación existente `digits_to_words` ("1AJK203" →
 * "UNO A J K DOS CERO TRES"), nunca como número completo.
 */
const IDENTIFIER_TYPES = new Set<AiVariableSemanticType>([
  "identification",
  "vehicle_identifier",
  "plate",
  "property_identifier",
]);
const IDENTIFIER_KEY_PATTERN =
  /(^|_)(motor|chasis|vin|serie|placa|matricula|cedula|identificacion|pasaporte|dimex)(_|$)/;

/** true si la clave (su último segmento) nombra un identificador técnico. */
export function isIdentifierKey(key: string): boolean {
  const data = key.split(".").pop() ?? key;
  return IDENTIFIER_KEY_PATTERN.test(stripDiacritics(data).toLowerCase());
}

function resolveTransform(
  variable: AiProposalVariable,
  warnings: Set<AiDraftWarningCode>,
): VariableOutputTransform {
  // 1) Número completo: nunca dígito por dígito (30 minutos → TREINTA).
  if (WHOLE_NUMBER_TYPES.has(variable.semantic_type)) {
    if (variable.output_transform === "digits_to_words") {
      warnings.add("transform_corrected");
      return "number_to_words";
    }
    return variable.output_transform;
  }
  // 2) Identificador técnico sin transformación: carácter por carácter. Un
  //    identificador con letras NO queda sin transformar solo por no ser un
  //    número puro; `digits_to_words` conserva las letras.
  if (
    variable.output_transform === "none" &&
    (IDENTIFIER_TYPES.has(variable.semantic_type) || isIdentifierKey(variable.key))
  ) {
    warnings.add("transform_corrected");
    return "digits_to_words";
  }
  return variable.output_transform;
}

function hasKnownPatternEvidence(
  basis: AiProposalOptionBlock["basis"],
  span: string,
): boolean {
  const normalized = stripDiacritics(span).toLowerCase();
  if (basis === "known_pattern_time_minutes") {
    return /\bhoras?\b/.test(normalized);
  }
  return true;
}

// ------------------------------------------------ patrón Chasis/VIN/Serie

/** El texto menciona chasis o VIN ("serie" sola es ambigua). */
export function mentionsVehicleIdentifiers(text: string): boolean {
  return /\b(chasis|vin)\b/.test(stripDiacritics(text).toLowerCase());
}

export const VEHICLE_IDENTIFIER_CASE_LABELS: Record<AiVehicleIdentifierCase, string> = {
  all_equal: "Chasis, VIN y serie iguales",
  chassis_vin_equal: "Chasis y VIN iguales; serie diferente",
  vin_serial_equal: "VIN y serie iguales; chasis diferente",
  chassis_serial_equal: "Chasis y serie iguales; VIN diferente",
  all_different: "Chasis, VIN y serie diferentes",
};

/**
 * Redacción estándar de LexCR para cada caso. Un valor compartido usa la
 * clave del VIN (o la del chasis cuando chasis = serie), de modo que cada
 * dato real se escribe una sola vez en la Escritura.
 */
export function vehicleIdentifierVariantText(
  variantCase: AiVehicleIdentifierCase,
  keys: { chassis: string; vin: string; serial: string },
): string {
  const v = (key: string) => `{{${key}}}`;
  switch (variantCase) {
    case "all_equal":
      return `chasis, VIN y serie número ${v(keys.vin)}`;
    case "chassis_vin_equal":
      return `chasis y VIN número ${v(keys.vin)}, y serie número ${v(keys.serial)}`;
    case "vin_serial_equal":
      return `chasis número ${v(keys.chassis)}, y VIN y serie número ${v(keys.vin)}`;
    case "chassis_serial_equal":
      return `chasis y serie número ${v(keys.chassis)}, y VIN número ${v(keys.vin)}`;
    case "all_different":
      return `chasis número ${v(keys.chassis)}, VIN número ${v(keys.vin)} y serie número ${v(keys.serial)}`;
  }
}

const VEHICLE_KEY_DEFAULTS = {
  chassis: { key: "vehiculo.chasis", label: "Número de chasis" },
  vin: { key: "vehiculo.vin", label: "Número VIN" },
  serial: { key: "vehiculo.serie", label: "Número de serie" },
} as const;

/** Claves del patrón: las del modelo si son distintas entre sí; si no, las canónicas. */
function resolveVehicleKeys(vehicle: AiProposalVehicleIdentifiers) {
  const proposed = [vehicle.chassis_key, vehicle.vin_key, vehicle.serial_key];
  if (new Set(proposed).size === 3) {
    return { chassis: vehicle.chassis_key, vin: vehicle.vin_key, serial: vehicle.serial_key };
  }
  return {
    chassis: VEHICLE_KEY_DEFAULTS.chassis.key,
    vin: VEHICLE_KEY_DEFAULTS.vin.key,
    serial: VEHICLE_KEY_DEFAULTS.serial.key,
  };
}

type VarSpan = { start: number; end: number; key: string };
type BlockSpan = { start: number; end: number; blockIndex: number };

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}
function contains(outer: { start: number; end: number }, inner: { start: number; end: number }) {
  return outer.start <= inner.start && inner.end <= outer.end;
}

function variantKeys(content: TemplateVariantContentNode[]): Set<string> {
  return new Set(
    content.flatMap((node) =>
      node.type === "templateVariable" ? [node.attrs.key] : [],
    ),
  );
}

// ------------------------------------------------------------ builder

export function buildTemplateDraftFromProposal(
  input: BuildInput,
): BuildAiDraftResult {
  const { proposal, sourceText } = input;
  const generateId = input.generateId ?? (() => globalThis.crypto.randomUUID());
  const warnings = new Set<AiDraftWarningCode>(proposal.warnings);
  const paragraphs = splitSourceParagraphs(sourceText);

  // ---- catálogo declarado (fusiona claves duplicadas)
  const declared = new Map<string, AiProposalVariable>();
  for (const variable of proposal.variables) {
    const existing = declared.get(variable.key);
    if (existing) {
      declared.set(variable.key, {
        ...existing,
        occurrences: [...existing.occurrences, ...variable.occurrences],
        needs_review: existing.needs_review || variable.needs_review,
      });
    } else {
      declared.set(variable.key, variable);
    }
  }
  // ---- datos del profesional autor: texto fijo salvo pedido explícito
  if (!instructionsRequestProfessionalData(input.instructions)) {
    for (const key of [...declared.keys()]) {
      if (isProfessionalDataKey(key)) {
        declared.delete(key);
        warnings.add("professional_data_kept_fixed");
      }
    }
  }
  const instructionsProvided = (input.instructions ?? "").trim() !== "";

  const labels = new Map<string, string>();
  for (const [key, variable] of declared) {
    labels.set(key, sanitizeLabel(variable.label, AI_PROPOSAL_LIMITS.maxLabelChars) || key);
  }

  // ---- bloques candidatos: base admitida + alternativas con claves declaradas
  type CandidateBlock = {
    /** Índice en `proposal.option_blocks`; -1 para el bloque Chasis/VIN/Serie. */
    blockIndex: number;
    name: string;
    originalLabel: string;
    span: BlockSpan & { paragraphIndex: number };
    alternatives: Array<{ label: string; content: TemplateVariantContentNode[]; originalIndex: number }>;
    /** Alternativas propuestas originalmente (para validar `time_output`). */
    proposedAlternativeCount: number;
    timeOutput: AiProposalOptionBlock["time_output"];
    /**
     * Patrón Cédula / DIMEX / Pasaporte: las alternativas se derivan del
     * propio texto original (con sus variables) cambiando solo la mención
     * del documento, al construir el párrafo.
     */
    identification?: { originalType: AiIdentificationDocumentType };
  };
  const candidateBlocks: CandidateBlock[] = [];

  // ---- patrón conocido Chasis/VIN/Serie: variantes construidas por LexCR
  const vehicle = proposal.vehicle_identifiers;
  if (vehicle) {
    const paragraphIndex = vehicle.paragraph - 1;
    const paragraph = paragraphs[paragraphIndex];
    const start =
      paragraph === undefined || vehicle.text.trim() === ""
        ? -1
        : findNth(paragraph, vehicle.text, vehicle.occurrence);
    if (start < 0 || !mentionsVehicleIdentifiers(vehicle.text)) {
      warnings.add("option_block_discarded");
    } else {
      const keys = resolveVehicleKeys(vehicle);
      const roles = [
        ["chassis", keys.chassis],
        ["vin", keys.vin],
        ["serial", keys.serial],
      ] as const;
      for (const [role, key] of roles) {
        if (!declared.has(key)) {
          // Clave usada solo por variantes alternativas: se declara aquí.
          declared.set(key, {
            key,
            label: VEHICLE_KEY_DEFAULTS[role].label,
            semantic_type: "vehicle_identifier",
            output_transform: "digits_to_words",
            needs_review: false,
            occurrences: [],
          });
          labels.set(key, VEHICLE_KEY_DEFAULTS[role].label);
        }
      }
      const cases = (
        Object.keys(VEHICLE_IDENTIFIER_CASE_LABELS) as AiVehicleIdentifierCase[]
      ).filter((variantCase) => variantCase !== vehicle.original_case);
      candidateBlocks.push({
        blockIndex: -1,
        name: "Chasis, VIN y serie",
        originalLabel: `${VEHICLE_IDENTIFIER_CASE_LABELS[vehicle.original_case]} (según el documento)`,
        span: { start, end: start + vehicle.text.length, blockIndex: -1, paragraphIndex },
        alternatives: cases.map((variantCase, originalIndex) => ({
          label: VEHICLE_IDENTIFIER_CASE_LABELS[variantCase],
          content: parseVariantContentText(vehicleIdentifierVariantText(variantCase, keys)),
          originalIndex,
        })),
        proposedAlternativeCount: cases.length,
        timeOutput: null,
      });
    }
  }
  // ---- patrón canónico Cédula / DIMEX / Pasaporte (personas físicas)
  // Toda identificación de una Parte persona física queda preparada para
  // las tres modalidades, reutilizando la MISMA variable. Fuentes: lo que
  // propone el modelo y, además, una detección determinista de LexCR (la
  // mención del documento justo antes del número), para no depender del
  // modelo. Las notas solo lo desactivan con una exclusión explícita.
  type IdentificationCandidate = {
    paragraphIndex: number;
    start: number;
    end: number;
    key: string;
    type: AiIdentificationDocumentType;
  };
  const identificationCandidates: IdentificationCandidate[] = [];
  const pushIdentification = (candidate: IdentificationCandidate, value: string) => {
    const spanText = paragraphs[candidate.paragraphIndex].slice(candidate.start, candidate.end);
    if (isLegalEntityIdentification(candidate.key, spanText, value)) {
      warnings.add("identification_type_skipped");
      return;
    }
    identificationCandidates.push(candidate);
  };
  if (identificationTypesDisabledByNotes(input.instructions)) {
    if (proposal.identification_types.length > 0) warnings.add("identification_type_skipped");
  } else {
    // 1) propuestas del modelo (fragmento que contiene la mención y el número)
    for (const item of proposal.identification_types) {
      const located = locateReference(paragraphs, item);
      const phrase = IDENTIFICATION_PHRASE_PATTERN.exec(item.text);
      const inner = (declared.get(item.identification_key)?.occurrences ?? [])
        .map((occurrence) => ({ occurrence, found: locateReference(paragraphs, occurrence) }))
        .find(
          ({ found }) =>
            located !== null &&
            found !== null &&
            found.paragraphIndex === located.paragraphIndex &&
            found.start >= located.start &&
            found.end <= located.end,
        );
      if (!located || !phrase || !inner) {
        warnings.add("identification_type_skipped");
        continue;
      }
      pushIdentification(
        { ...located, key: item.identification_key, type: documentTypeOf(phrase[0]) },
        inner.occurrence.text,
      );
    }
    // 2) detección determinista: número de identificación de un rol
    //    precedido por la mención del documento
    for (const [key, variable] of declared) {
      const dot = key.indexOf(".");
      if (dot <= 0) continue;
      const data = normalizeForMatch(key.slice(dot + 1));
      if (variable.semantic_type !== "identification" && !IDENTIFICATION_DATA_KEYS.has(data)) continue;
      for (const occurrence of variable.occurrences) {
        const found = locateReference(paragraphs, occurrence);
        if (!found) continue;
        const paragraph = paragraphs[found.paragraphIndex];
        const lookStart = Math.max(0, found.start - IDENTIFICATION_LOOKBEHIND_CHARS);
        const leading = IDENTIFICATION_LEADING_PATTERN.exec(paragraph.slice(lookStart, found.start));
        if (!leading) continue;
        pushIdentification(
          {
            paragraphIndex: found.paragraphIndex,
            start: lookStart + leading.index,
            end: found.end,
            key,
            type: documentTypeOf(leading[1]),
          },
          occurrence.text,
        );
      }
    }
  }
  // Una sola opción por fragmento (el modelo y la detección suelen coincidir).
  const acceptedIdentifications: IdentificationCandidate[] = [];
  for (const candidate of identificationCandidates) {
    if (
      !acceptedIdentifications.some(
        (other) => other.paragraphIndex === candidate.paragraphIndex && overlaps(other, candidate),
      )
    ) {
      acceptedIdentifications.push(candidate);
    }
  }
  acceptedIdentifications.forEach((candidate, index) => {
    const blockIndex = -100 - index;
    candidateBlocks.push({
      blockIndex,
      name: "Tipo de identificación",
      originalLabel: `${IDENTIFICATION_TYPE_LABELS[candidate.type]} (según el documento)`,
      span: {
        start: candidate.start,
        end: candidate.end,
        blockIndex,
        paragraphIndex: candidate.paragraphIndex,
      },
      alternatives: [],
      proposedAlternativeCount: 0,
      timeOutput: null,
      identification: { originalType: candidate.type },
    });
  });

  proposal.option_blocks.forEach((block, blockIndex) => {
    const paragraphIndex = block.paragraph - 1;
    const paragraph = paragraphs[paragraphIndex];
    if (paragraph === undefined) {
      warnings.add("option_block_discarded");
      return;
    }
    if (block.basis === "user_instruction" && !instructionsProvided) {
      warnings.add("option_block_discarded");
      return;
    }
    // Un Bloque de hora incoherente (la "hora" es la fecha, la hora queda
    // fuera del fragmento, una variante incluye la fecha…) nunca se guarda:
    // sus variables quedan como variables normales del texto.
    if (
      block.basis === "known_pattern_time_minutes" &&
      (!isCoherentTimeBlock(block, { declared, paragraphs }) ||
        !hasKnownPatternEvidence(block.basis, block.text))
    ) {
      warnings.add("time_block_discarded");
      return;
    }
    if (!hasKnownPatternEvidence(block.basis, block.text)) {
      warnings.add("option_block_discarded");
      return;
    }
    const start = findNth(paragraph, block.text, block.occurrence);
    if (start < 0 || block.text.trim() === "") {
      warnings.add("option_block_discarded");
      return;
    }
    const alternatives: CandidateBlock["alternatives"] = [];
    block.alternative_variants.forEach((variant, originalIndex) => {
      const label = sanitizeLabel(variant.label, AI_PROPOSAL_LIMITS.maxLabelChars);
      // Variante vacía válida: la cláusula no existe en esa modalidad (p. ej.
      // "Sin garantía"). Nunca se rellena con texto que no existía.
      const content =
        variant.content.trim() === "" ? [] : parseVariantContentText(variant.content);
      const keys = variantKeys(content);
      const undeclared = [...keys].some((key) => !declared.has(key));
      if (label === "" || undeclared) {
        warnings.add("option_variant_discarded");
        return;
      }
      alternatives.push({ label, content, originalIndex });
    });
    if (alternatives.length === 0) {
      warnings.add("option_block_discarded");
      return;
    }
    candidateBlocks.push({
      blockIndex,
      name: block.name,
      originalLabel: block.original_variant_label,
      span: { start, end: start + block.text.length, blockIndex, paragraphIndex },
      alternatives,
      proposedAlternativeCount: block.alternative_variants.length,
      timeOutput: block.time_output,
    });
  });

  // ---- bloques aceptados por párrafo (sin solaparse entre sí)
  const blocksByParagraph = new Map<number, CandidateBlock[]>();
  for (const candidate of [...candidateBlocks].sort(
    (a, b) => a.span.paragraphIndex - b.span.paragraphIndex || a.span.start - b.span.start,
  )) {
    const list = blocksByParagraph.get(candidate.span.paragraphIndex) ?? [];
    if (list.some((accepted) => overlaps(accepted.span, candidate.span))) {
      warnings.add("overlap_discarded");
      continue;
    }
    list.push(candidate);
    blocksByParagraph.set(candidate.span.paragraphIndex, list);
  }

  // ---- ocurrencias de variables localizadas
  const varsByParagraph = new Map<number, VarSpan[]>();
  for (const [key, variable] of declared) {
    for (const occurrence of variable.occurrences) {
      const paragraphIndex = occurrence.paragraph - 1;
      const paragraph = paragraphs[paragraphIndex];
      const start =
        paragraph === undefined || occurrence.text.trim() === ""
          ? -1
          : findNth(paragraph, occurrence.text, occurrence.occurrence);
      if (start < 0) {
        warnings.add("occurrence_not_found");
        continue;
      }
      const list = varsByParagraph.get(paragraphIndex) ?? [];
      list.push({ start, end: start + occurrence.text.length, key });
      varsByParagraph.set(paragraphIndex, list);
    }
  }

  // ---- nacionalidad de las Partes: nunca queda como texto fijo
  // Un gentilicio de la lista cerrada que el modelo dejó literal, a poca
  // distancia después del nombre de una Parte (`rol.x` de tipo
  // `person_name`) en el mismo párrafo, pasa a `rol.nacionalidad` —
  // cualquier rol, sin lista de roles.
  const NATIONALITY_MAX_DISTANCE = 250;
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const spans = varsByParagraph.get(paragraphIndex) ?? [];
    const blocks = blocksByParagraph.get(paragraphIndex) ?? [];
    for (const mention of findNationalityMentions(paragraph)) {
      if (
        spans.some((span) => overlaps(span, mention)) ||
        blocks.some((block) => overlaps(block.span, mention))
      ) {
        continue;
      }
      const owner = spans
        .filter(
          (span) =>
            span.end <= mention.start &&
            mention.start - span.end <= NATIONALITY_MAX_DISTANCE &&
            span.key.includes(".") &&
            declared.get(span.key)?.semantic_type === "person_name",
        )
        .sort((a, b) => b.end - a.end)[0];
      if (!owner) continue;
      const role = owner.key.slice(0, owner.key.indexOf("."));
      const key = `${role}.nacionalidad`;
      if (!declared.has(key)) {
        declared.set(key, {
          key,
          label: `Nacionalidad (${role.replaceAll("_", " ")})`,
          semantic_type: "nationality",
          output_transform: "none",
          needs_review: false,
          occurrences: [],
        });
        labels.set(key, `Nacionalidad (${role.replaceAll("_", " ")})`);
      }
      spans.push({ start: mention.start, end: mention.end, key });
      varsByParagraph.set(paragraphIndex, spans);
      warnings.add("nationality_completed");
    }
  });

  // ---- construcción de párrafos
  const content: TemplateParagraphNode[] = [];
  const usedKeys: string[] = [];
  const markUsed = (key: string) => {
    if (!usedKeys.includes(key)) usedKeys.push(key);
  };
  const blockIdsByIndex = new Map<number, string>();
  const timeBlocks = new Set<number>();

  const variableNode = (key: string): TemplateVariantContentNode => ({
    type: "templateVariable",
    attrs: { key, label: labels.get(key) ?? key },
  });

  function buildRun(
    text: string,
    offset: number,
    spans: VarSpan[],
  ): TemplateVariantContentNode[] {
    const nodes: TemplateVariantContentNode[] = [];
    let cursor = offset;
    for (const span of spans) {
      if (span.start > cursor) {
        nodes.push({ type: "text", text: text.slice(cursor - offset, span.start - offset) });
      }
      nodes.push(variableNode(span.key));
      markUsed(span.key);
      cursor = span.end;
    }
    if (cursor < offset + text.length) {
      nodes.push({ type: "text", text: text.slice(cursor - offset) });
    }
    return nodes;
  }

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const blocks = blocksByParagraph.get(paragraphIndex) ?? [];
    // Variables: orden por inicio y, a igual inicio, la más larga primero;
    // se descarta cualquier solapamiento con una ya aceptada o un cruce
    // parcial con el borde de un bloque.
    const accepted: VarSpan[] = [];
    for (const span of (varsByParagraph.get(paragraphIndex) ?? []).sort(
      (a, b) => a.start - b.start || b.end - a.end,
    )) {
      const crossesBlock = blocks.some(
        (block) => overlaps(block.span, span) && !contains(block.span, span),
      );
      if (crossesBlock || accepted.some((other) => overlaps(other, span))) {
        warnings.add("overlap_discarded");
        continue;
      }
      accepted.push(span);
    }

    type Item =
      | { kind: "var"; span: VarSpan }
      | { kind: "block"; block: CandidateBlock };
    const items: Item[] = [
      ...blocks.map((block) => ({ kind: "block" as const, block })),
      ...accepted
        .filter((span) => !blocks.some((block) => contains(block.span, span)))
        .map((span) => ({ kind: "var" as const, span })),
    ].sort(
      (a, b) =>
        (a.kind === "var" ? a.span.start : a.block.span.start) -
        (b.kind === "var" ? b.span.start : b.block.span.start),
    );

    const nodes: TemplateInlineNode[] = [];
    let cursor = 0;
    for (const item of items) {
      const start = item.kind === "var" ? item.span.start : item.block.span.start;
      if (start > cursor) nodes.push({ type: "text", text: paragraph.slice(cursor, start) });
      if (item.kind === "var") {
        nodes.push(variableNode(item.span.key));
        markUsed(item.span.key);
        cursor = item.span.end;
        continue;
      }

      const { block } = item;
      const innerSpans = accepted.filter((span) => contains(block.span, span));
      const originalContent = buildRun(
        paragraph.slice(block.span.start, block.span.end),
        block.span.start,
        innerSpans,
      );
      const originalId = generateId();
      if (block.identification) {
        // Alternativas = el mismo texto original (con sus variables) con
        // solo la mención del documento adaptada; nada de contenido nuevo.
        const originalType = block.identification.originalType;
        block.alternatives = (["cedula", "dimex", "pasaporte"] as const)
          .filter((type) => type !== originalType)
          .map((type, originalIndex) => {
            let adapted = false;
            const content = originalContent.map((node) => {
              if (adapted || node.type !== "text" || !IDENTIFICATION_PHRASE_PATTERN.test(node.text)) {
                return node;
              }
              adapted = true;
              return { ...node, text: adaptIdentificationPhrase(node.text, type) };
            });
            return { label: IDENTIFICATION_TYPE_LABELS[type], content, originalIndex };
          });
      }
      const variants = [
        {
          id: originalId,
          label:
            sanitizeLabel(block.originalLabel, AI_PROPOSAL_LIMITS.maxLabelChars) ||
            "Según el documento",
          content: originalContent,
        },
        ...block.alternatives.map((alternative) => {
          for (const key of variantKeys(alternative.content)) markUsed(key);
          return {
            id: generateId(),
            label: alternative.label,
            // Etiquetas de las fichas coherentes con el catálogo.
            content: alternative.content.map((node) =>
              node.type === "templateVariable" ? variableNode(node.attrs.key) : node,
            ),
          };
        }),
      ];

      let structuredOutput: TemplateOptionBlockStructuredOutput | null = null;
      const timeOutput = block.timeOutput;
      if (timeOutput) {
        const allAlternativesKept =
          block.alternatives.length === block.proposedAlternativeCount &&
          timeOutput.alternatives.length === block.alternatives.length;
        const keySets = [timeOutput.original, ...timeOutput.alternatives];
        const valid =
          allAlternativesKept &&
          keySets.every((keys, index) => {
            const available = variantKeys(variants[index].content);
            return (
              available.has(keys.hour_key) &&
              (keys.minute_key === null || available.has(keys.minute_key))
            );
          });
        if (valid) {
          structuredOutput = {
            type: "time",
            variants: keySets.map((keys, index) => ({
              variantId: variants[index].id,
              hourFieldKey: keys.hour_key,
              minuteFieldKey: keys.minute_key,
            })),
          };
          timeBlocks.add(block.blockIndex);
        } else {
          warnings.add("time_output_discarded");
        }
      }

      const blockId = generateId();
      blockIdsByIndex.set(block.blockIndex, blockId);
      const attrs: TemplateOptionBlockAttrs = {
        blockId,
        name:
          sanitizeLabel(block.name, TEMPLATE_DOC_LIMITS.maxOptionBlockNameLength) ||
          "Bloque de opciones",
        variants,
        defaultVariantId: originalId,
        structuredOutput,
      };
      nodes.push({ type: "optionBlock", attrs });
      cursor = block.span.end;
    }
    if (cursor < paragraph.length) nodes.push({ type: "text", text: paragraph.slice(cursor) });

    content.push(nodes.length > 0 ? { type: "paragraph", content: nodes } : { type: "paragraph" });
  });

  const document: TemplateDocument = {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };

  if (usedKeys.length === 0) return { ok: false, code: "no_variables" };
  if (mentionsVehicleIdentifiers(sourceText) && !blockIdsByIndex.has(-1)) {
    warnings.add("vehicle_identifier_block_missing");
  }

  // ---- catálogo final: solo claves realmente usadas en el documento
  const variables: TemplateWorkspaceVariable[] = [];
  for (const key of usedKeys) {
    const proposalVariable = declared.get(key);
    if (!proposalVariable) return { ok: false, code: "invalid_output" };
    const parsed = TemplateWorkspaceVariableSchema.safeParse({
      field_key: key,
      label: labels.get(key),
      // Regla de LexCR, no del modelo: toda variable generada con IA es
      // opcional. El abogado decide qué exigir al revisar el Machote.
      required: false,
      autofill_source: suggestAutofillSource(key),
      output_transform: resolveTransform(proposalVariable, warnings),
    });
    if (!parsed.success) return { ok: false, code: "invalid_output" };
    variables.push(parsed.data);
  }

  // ---- plan del Índice Notarial (solo claves del catálogo final)
  const catalog = new Set(usedKeys);
  const assigned = new Set<string>();
  const simpleKey = (key: string | null): string | null => {
    if (key === null) return null;
    if (!catalog.has(key) || assigned.has(key)) {
      warnings.add("index_mapping_discarded");
      return null;
    }
    assigned.add(key);
    return key;
  };
  const index = proposal.notarial_index;
  let authorizedTimeOptionBlockId: string | null = null;
  if (index.authorized_time_option_block !== null) {
    const blockId = blockIdsByIndex.get(index.authorized_time_option_block);
    if (blockId && timeBlocks.has(index.authorized_time_option_block)) {
      authorizedTimeOptionBlockId = blockId;
    } else {
      warnings.add("index_mapping_discarded");
    }
  }
  // La fecha se resuelve ANTES que la hora: si el modelo propone la misma
  // clave para ambas, nunca gana la hora (antes la fecha terminaba mapeada
  // como hora de otorgamiento y la fecha del Índice quedaba vacía).
  const instrumentNumberKey = simpleKey(index.instrument_number_key);
  const authorizedDateKey = simpleKey(index.authorized_date_key);
  // La hora tiene una sola fuente: el Bloque de Hora gana si es válido. Una
  // variable de tipo fecha nunca es la hora del Índice.
  let authorizedTimeKey: string | null = null;
  if (authorizedTimeOptionBlockId === null) {
    if (
      index.authorized_time_key !== null &&
      declared.get(index.authorized_time_key)?.semantic_type === "date"
    ) {
      warnings.add("index_mapping_discarded");
    } else {
      authorizedTimeKey = simpleKey(index.authorized_time_key);
    }
  } else if (index.authorized_time_key !== null) {
    warnings.add("index_mapping_discarded");
  }
  const simpleFieldKeys: AiIndexPlan["simpleFieldKeys"] = {
    instrument_number: instrumentNumberKey,
    authorized_date: authorizedDateKey,
    authorized_time: authorizedTimeKey,
    protocol_book: simpleKey(index.protocol_book_key),
    initial_folio: simpleKey(index.initial_folio_key),
  };
  const partyKeys = [...new Set(index.party_keys)].filter((key) => {
    if (catalog.has(key)) return true;
    warnings.add("index_mapping_discarded");
    return false;
  });

  // ---- validadores actuales (defensa final)
  const validation = validateTemplateDocument(document);
  if (!validation.ok) return { ok: false, code: "invalid_output" };
  if (variables.length > TEMPLATE_DOC_LIMITS.maxDistinctVariables) {
    return { ok: false, code: "invalid_output" };
  }

  const name =
    sanitizeLabel(proposal.template.name, AI_PROPOSAL_LIMITS.maxNameChars) ||
    FALLBACK_AI_TEMPLATE_NAME;
  const description = proposal.template.description
    ? sanitizeLabel(proposal.template.description, AI_PROPOSAL_LIMITS.maxDescriptionChars) || null
    : null;

  const indexMappingCount =
    Object.values(simpleFieldKeys).filter((key) => key !== null).length +
    (authorizedTimeOptionBlockId ? 1 : 0) +
    (partyKeys.length > 0 ? 1 : 0);

  return {
    ok: true,
    draft: {
      name,
      description,
      document: validation.document,
      variables,
      indexPlan: { simpleFieldKeys, authorizedTimeOptionBlockId, partyKeys },
      summary: {
        variableCount: variables.length,
        optionBlockCount: blockIdsByIndex.size,
        indexMappingCount,
      },
      reviewKeys: usedKeys.filter((key) => declared.get(key)?.needs_review),
      warnings: [...warnings],
    },
  };
}
