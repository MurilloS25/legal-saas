/**
 * Validación SEMÁNTICA de una propuesta ya parseada: coherencia estructural
 * de LexCR, no corrección jurídica del documento. Una propuesta puede ser
 * JSON válido y, aun así, conceptualmente incoherente — p. ej. un Bloque de
 * hora cuya "hora" es la fecha de otorgamiento.
 *
 * Cada incidencia tiene una severidad:
 * - `repair`: amerita el único retry de reparación (el modelo puede
 *   corregirla con la lista de incidencias);
 * - `discard`: la reconstrucción determinista descarta ese elemento y el
 *   resto del Machote sigue siendo coherente.
 *
 * Las incidencias solo llevan códigos y rutas estructurales, nunca texto
 * del documento.
 */

import { parseVariantContentText } from "@/lib/editor/option-blocks";
import type {
  AiProposalOptionBlock,
  AiProposalVariable,
  AiTemplateProposal,
} from "./proposal";
import { locateReference } from "./references";

export const AI_SEMANTIC_ISSUE_CODES = [
  "no_variables",
  "many_occurrences_not_found",
  "occurrence_not_found",
  "variant_undeclared_key",
  "option_block_span_not_found",
  "time_block_incoherent",
  "index_time_block_invalid",
  "index_time_is_date",
  "index_key_undeclared",
  "vehicle_span_not_found",
  "identification_span_not_found",
] as const;
export type AiSemanticIssueCode = (typeof AI_SEMANTIC_ISSUE_CODES)[number];
export type AiSemanticIssue = {
  code: AiSemanticIssueCode;
  path: string;
  severity: "repair" | "discard";
};

/** Proporción de apariciones no localizadas que amerita reparación. */
const MAX_MISSING_OCCURRENCE_RATIO = 0.25;

export function variantContentKeys(content: string): Set<string> {
  return new Set(
    parseVariantContentText(content).flatMap((node) =>
      node.type === "templateVariable" ? [node.attrs.key] : [],
    ),
  );
}

type TimeBlockContext = {
  declared: ReadonlyMap<string, AiProposalVariable>;
  paragraphs: readonly string[];
};

/**
 * Un Bloque de hora es coherente si su salida estructurada apunta, en cada
 * variante, a una variable de HORA (`time_hour`) y opcionalmente a una de
 * MINUTOS (`time_minutes`) distintas; la variante original contiene de
 * verdad esas apariciones dentro de su fragmento; y ninguna variante
 * incluye una fecha (la causa de "minutos + fecha de otorgamiento" en la
 * configuración del Índice, que solo ofrece las variables de cada variante).
 */
export function isCoherentTimeBlock(
  block: AiProposalOptionBlock,
  context: TimeBlockContext,
): boolean {
  const output = block.time_output;
  if (!output || output.alternatives.length !== block.alternative_variants.length) {
    return false;
  }
  const span = locateReference(context.paragraphs, block);
  if (!span) return false;

  const typeOf = (key: string | null) =>
    key === null ? null : (context.declared.get(key)?.semantic_type ?? "undeclared");
  const keysInSpan = new Set<string>();
  for (const [key, variable] of context.declared) {
    for (const occurrence of variable.occurrences) {
      const found = locateReference(context.paragraphs, occurrence);
      if (
        found &&
        found.paragraphIndex === span.paragraphIndex &&
        found.start >= span.start &&
        found.end <= span.end
      ) {
        keysInSpan.add(key);
      }
    }
  }
  const variantKeySets = [keysInSpan, ...block.alternative_variants.map((v) => variantContentKeys(v.content))];
  const outputs = [output.original, ...output.alternatives];

  return outputs.every((keys, index) => {
    const available = variantKeySets[index];
    if (typeOf(keys.hour_key) !== "time_hour") return false;
    if (keys.minute_key !== null) {
      if (keys.minute_key === keys.hour_key) return false;
      if (typeOf(keys.minute_key) !== "time_minutes") return false;
      if (!available.has(keys.minute_key)) return false;
    }
    if (!available.has(keys.hour_key)) return false;
    return ![...available].some((key) => typeOf(key) === "date");
  });
}

export function validateProposalSemantics(
  proposal: AiTemplateProposal,
  paragraphs: readonly string[],
): AiSemanticIssue[] {
  const issues: AiSemanticIssue[] = [];
  const declared = new Map(proposal.variables.map((variable) => [variable.key, variable]));

  if (proposal.variables.length === 0) {
    issues.push({ code: "no_variables", path: "variables", severity: "repair" });
  }

  // ---- referencias de variables
  let total = 0;
  let missing = 0;
  proposal.variables.forEach((variable, variableIndex) => {
    variable.occurrences.forEach((occurrence, occurrenceIndex) => {
      total += 1;
      if (!locateReference(paragraphs, occurrence)) {
        missing += 1;
        issues.push({
          code: "occurrence_not_found",
          path: `variables[${variableIndex}].occurrences[${occurrenceIndex}]`,
          severity: "discard",
        });
      }
    });
  });
  if (total > 0 && missing / total > MAX_MISSING_OCCURRENCE_RATIO) {
    issues.push({ code: "many_occurrences_not_found", path: "variables", severity: "repair" });
  }

  // ---- Bloques de opciones
  proposal.option_blocks.forEach((block, blockIndex) => {
    const path = `option_blocks[${blockIndex}]`;
    if (!locateReference(paragraphs, block)) {
      issues.push({ code: "option_block_span_not_found", path, severity: "discard" });
    }
    block.alternative_variants.forEach((variant, variantIndex) => {
      if ([...variantContentKeys(variant.content)].some((key) => !declared.has(key))) {
        issues.push({
          code: "variant_undeclared_key",
          path: `${path}.alternative_variants[${variantIndex}]`,
          severity: "discard",
        });
      }
    });
    if (
      block.basis === "known_pattern_time_minutes" &&
      !isCoherentTimeBlock(block, { declared, paragraphs })
    ) {
      issues.push({ code: "time_block_incoherent", path, severity: "repair" });
    }
  });

  // ---- patrones conocidos
  if (proposal.vehicle_identifiers && !locateReference(paragraphs, proposal.vehicle_identifiers)) {
    issues.push({ code: "vehicle_span_not_found", path: "vehicle_identifiers", severity: "discard" });
  }
  proposal.identification_types.forEach((item, index) => {
    if (!locateReference(paragraphs, item)) {
      issues.push({
        code: "identification_span_not_found",
        path: `identification_types[${index}]`,
        severity: "discard",
      });
    }
  });

  // ---- Índice Notarial
  const index = proposal.notarial_index;
  const simple: Array<[string, string | null]> = [
    ["instrument_number_key", index.instrument_number_key],
    ["authorized_date_key", index.authorized_date_key],
    ["authorized_time_key", index.authorized_time_key],
    ["protocol_book_key", index.protocol_book_key],
    ["initial_folio_key", index.initial_folio_key],
  ];
  for (const [field, key] of simple) {
    if (key !== null && !declared.has(key)) {
      issues.push({ code: "index_key_undeclared", path: `notarial_index.${field}`, severity: "discard" });
    }
  }
  if (
    index.authorized_time_key !== null &&
    (index.authorized_time_key === index.authorized_date_key ||
      declared.get(index.authorized_time_key)?.semantic_type === "date")
  ) {
    issues.push({ code: "index_time_is_date", path: "notarial_index.authorized_time_key", severity: "repair" });
  }
  if (index.authorized_time_option_block !== null) {
    const block = proposal.option_blocks[index.authorized_time_option_block];
    if (!block || block.basis !== "known_pattern_time_minutes") {
      issues.push({
        code: "index_time_block_invalid",
        path: "notarial_index.authorized_time_option_block",
        severity: "repair",
      });
    }
  }

  return issues;
}
