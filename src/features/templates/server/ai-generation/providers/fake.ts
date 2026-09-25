import "server-only";

/**
 * Proveedor SIMULADO para desarrollo local y E2E. Nunca llama a ningún
 * servicio externo y `config.ts` lo rechaza cuando `NODE_ENV=production`
 * (incluye builds de Vercel Preview), así que no puede activarse en un
 * despliegue.
 *
 * Heurística determinista sobre datos ficticios de prueba:
 * - "TEST PERSONA <X>": la primera persona distinta es `comprador.nombre`,
 *   la segunda `vendedor.nombre` (todas sus apariciones);
 * - "ESCRITURA NUMERO <X>": `numero_escritura`, mapeada al Índice;
 * - ambas personas como Partes del Índice.
 *
 * Marcadores para probar rutas de error sin un modelo real:
 * - `[[lexcr-fake:invalid-output]]`: devuelve texto no-JSON (dispara el
 *   retry técnico y luego `invalid_output`);
 * - `[[lexcr-fake:unavailable]]`: simula el proveedor caído.
 */

import {
  AI_TEMPLATE_SCHEMA_VERSION,
  type AiTemplateProposal,
} from "../../../model/ai-generation/proposal";
import {
  AiProviderError,
  type AiTemplateProvider,
  type TemplateGenerationRequest,
} from "../provider";

const PERSON_PATTERN = /TEST PERSONA [A-Z]+/g;
const INSTRUMENT_PATTERN = /ESCRITURA NUMERO ([A-Z]+)/;
const ROLE_KEYS = ["comprador.nombre", "vendedor.nombre"] as const;
const ROLE_LABELS = ["Nombre del comprador", "Nombre del vendedor"] as const;

function countBefore(paragraph: string, text: string, index: number): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const found = paragraph.indexOf(text, from);
    if (found < 0 || found > index) return count;
    count += 1;
    from = found + text.length;
  }
}

export function buildFakeProposal(request: TemplateGenerationRequest): AiTemplateProposal {
  const people = new Map<string, number>();
  const variables: AiTemplateProposal["variables"] = [];
  let instrumentKey: string | null = null;

  request.paragraphs.forEach((paragraph, index) => {
    const instrument = INSTRUMENT_PATTERN.exec(paragraph);
    if (instrument && instrumentKey === null) {
      instrumentKey = "numero_escritura";
      variables.push({
        key: instrumentKey,
        label: "Número de escritura",
        semantic_type: "instrument_number",
        output_transform: "number_to_words",
        needs_review: false,
        occurrences: [{ paragraph: index + 1, text: instrument[1], occurrence: 1 }],
      });
    }
    for (const match of paragraph.matchAll(PERSON_PATTERN)) {
      const name = match[0];
      if (!people.has(name) && people.size < ROLE_KEYS.length) {
        const role = people.size;
        people.set(name, role);
        variables.push({
          key: ROLE_KEYS[role],
          label: ROLE_LABELS[role],
          semantic_type: "person_name",
          output_transform: "none",
          needs_review: role === 1,
          occurrences: [],
        });
      }
      const role = people.get(name);
      if (role === undefined) continue;
      const variable = variables.find((v) => v.key === ROLE_KEYS[role]);
      variable?.occurrences.push({
        paragraph: index + 1,
        text: name,
        occurrence: countBefore(paragraph, name, match.index ?? 0),
      });
    }
  });

  return {
    schema_version: AI_TEMPLATE_SCHEMA_VERSION,
    template: { name: "Machote de prueba (IA simulada)", description: null },
    variables,
    option_blocks: [],
    vehicle_identifiers: null,
    identification_types: [],
    notarial_index: {
      instrument_number_key: instrumentKey,
      authorized_date_key: null,
      authorized_time_key: null,
      authorized_time_option_block: null,
      protocol_book_key: null,
      initial_folio_key: null,
      party_keys: [...people.values()].map((role) => ROLE_KEYS[role]),
    },
    warnings: [],
  };
}

export function createFakeTemplateProvider(
  options: { delayMs?: number } = {},
): AiTemplateProvider {
  return {
    id: "fake",
    model: "fake-deterministic",
    async generateTemplate(request) {
      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      const joined = request.paragraphs.join("\n");
      if (joined.includes("[[lexcr-fake:unavailable]]")) {
        throw new AiProviderError("unavailable", { retryable: true, billable: false });
      }
      if (joined.includes("[[lexcr-fake:invalid-output]]")) {
        return {
          rawOutput: "Claro, aquí tienes el clima de San José: soleado.",
          usage: { inputTokens: 10, outputTokens: 10 },
        };
      }
      return {
        rawOutput: JSON.stringify(buildFakeProposal(request)),
        usage: { inputTokens: null, outputTokens: null },
      };
    },
  };
}
