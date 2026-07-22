/**
 * Validación estricta del documento estructurado de un machote.
 *
 * El JSON puede venir del navegador, así que no se confía en él:
 *
 * - solo se aceptan los nodos, marcas y atributos del esquema permitido;
 * - cualquier propiedad extra o desconocida rechaza el documento completo;
 * - se aplican límites de tamaño (nodos, texto, variables);
 * - las claves peligrosas (__proto__, constructor, prototype) se rechazan.
 *
 * La validación debe ejecutarse siempre en las Server Actions antes de
 * persistir, aunque el cliente ya la haya ejecutado.
 */

import { FIELD_KEY_PATTERN } from "./variable-key";
import {
  TEMPLATE_DOC_LIMITS,
  TEMPLATE_DOC_MARKS,
  type TemplateDocMarkType,
  type TemplateDocument,
} from "./types";

export type TemplateDocumentValidation =
  | { ok: true; document: TemplateDocument }
  | { ok: false; error: string };

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MARK_TYPES = new Set<string>(TEMPLATE_DOC_MARKS);

function invalid(error: string): TemplateDocumentValidation {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Claves propias exactamente dentro del conjunto permitido, sin peligrosas. */
function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every(
    (key) => allowed.includes(key) && !DANGEROUS_KEYS.has(key),
  );
}

type Counters = {
  nodes: number;
  textLength: number;
  variableOccurrences: number;
  variableKeys: Set<string>;
  optionBlocks: number;
};

function validateMarks(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "Las marcas deben ser una lista.";

  const seen = new Set<TemplateDocMarkType>();
  for (const mark of value) {
    if (!isPlainObject(mark) || !hasOnlyKeys(mark, ["type"])) {
      return "El documento contiene una marca no permitida.";
    }
    const type = mark.type;
    if (typeof type !== "string" || !MARK_TYPES.has(type)) {
      return "El documento contiene una marca no permitida.";
    }
    if (seen.has(type as TemplateDocMarkType)) {
      return "El documento contiene marcas duplicadas.";
    }
    seen.add(type as TemplateDocMarkType);
  }
  return null;
}

/**
 * Valida un nodo inline "simple" (texto, variable, salto de línea) — el
 * mismo subconjunto permitido dentro del contenido de una variante de
 * Bloque de opciones. No admite `optionBlock`: los bloques no se anidan.
 */
function validateSimpleInlineNode(
  value: unknown,
  counters: Counters,
): string | null {
  if (!isPlainObject(value)) {
    return "El documento contiene un nodo inválido.";
  }

  counters.nodes += 1;
  if (counters.nodes > TEMPLATE_DOC_LIMITS.maxNodes) {
    return "El documento tiene demasiados nodos.";
  }

  switch (value.type) {
    case "text": {
      if (!hasOnlyKeys(value, ["type", "text", "marks"])) {
        return "El documento contiene atributos no permitidos.";
      }
      if (typeof value.text !== "string" || value.text.length === 0) {
        return "El documento contiene un nodo de texto inválido.";
      }
      counters.textLength += value.text.length;
      if (counters.textLength > TEMPLATE_DOC_LIMITS.maxTextLength) {
        return "El contenido del machote es demasiado largo.";
      }
      return validateMarks(value.marks);
    }

    case "templateVariable": {
      if (!hasOnlyKeys(value, ["type", "attrs"])) {
        return "El documento contiene atributos no permitidos.";
      }
      const attrs = value.attrs;
      if (!isPlainObject(attrs) || !hasOnlyKeys(attrs, ["key", "label"])) {
        return "La variable tiene atributos no permitidos.";
      }
      const key = attrs.key;
      if (
        typeof key !== "string" ||
        key.length === 0 ||
        key.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength ||
        !FIELD_KEY_PATTERN.test(key) ||
        DANGEROUS_KEYS.has(key)
      ) {
        return "La clave de una variable no es válida.";
      }
      // Tiptap serializa siempre el atributo `label` con su valor por
      // defecto del esquema (`null`) cuando no se asignó ninguno — por
      // ejemplo, variables detectadas al escribir o pegar `{{clave}}`, o
      // variables pendientes de un machote legacy una vez pasan por el
      // editor. `null` es equivalente a "sin etiqueta", igual que ausente.
      const label = attrs.label;
      if (
        label !== undefined &&
        label !== null &&
        (typeof label !== "string" ||
          label.length > TEMPLATE_DOC_LIMITS.maxVariableLabelLength)
      ) {
        return "La etiqueta de una variable no es válida.";
      }

      counters.variableOccurrences += 1;
      if (
        counters.variableOccurrences >
        TEMPLATE_DOC_LIMITS.maxVariableOccurrences
      ) {
        return "El documento tiene demasiadas variables.";
      }
      counters.variableKeys.add(key);
      if (
        counters.variableKeys.size > TEMPLATE_DOC_LIMITS.maxDistinctVariables
      ) {
        return "El documento tiene demasiadas variables distintas.";
      }
      // La sintaxis de compatibilidad `{{key}}` también cuenta como texto.
      counters.textLength += key.length + 4;
      if (counters.textLength > TEMPLATE_DOC_LIMITS.maxTextLength) {
        return "El contenido del machote es demasiado largo.";
      }
      return null;
    }

    case "hardBreak": {
      if (!hasOnlyKeys(value, ["type"])) {
        return "El documento contiene atributos no permitidos.";
      }
      counters.textLength += 1;
      return null;
    }

    default:
      return "El documento contiene un nodo no permitido.";
  }
}

function validateOptionVariant(
  value: unknown,
  counters: Counters,
  seenIds: Set<string>,
): string | null {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ["id", "label", "content"])) {
    return "Una variante del Bloque de opciones tiene atributos no permitidos.";
  }

  const id = value.id;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength ||
    DANGEROUS_KEYS.has(id)
  ) {
    return "El id de una variante no es válido.";
  }
  if (seenIds.has(id)) {
    return "El Bloque de opciones tiene variantes con id duplicado.";
  }
  seenIds.add(id);

  const label = value.label;
  if (
    typeof label !== "string" ||
    label.trim().length === 0 ||
    label.length > TEMPLATE_DOC_LIMITS.maxOptionVariantLabelLength
  ) {
    return "La etiqueta de una variante no es válida.";
  }

  const content = value.content;
  if (!Array.isArray(content)) {
    return "El contenido de una variante debe ser una lista.";
  }
  for (const node of content) {
    const error = validateSimpleInlineNode(node, counters);
    if (error) return error;
  }

  return null;
}

/**
 * Valida un nodo `optionBlock`: nombre, variantes (cada una con su propio
 * contenido "simple", sin anidar otro Bloque) y que `defaultVariantId`
 * apunte a una variante real del propio bloque.
 */
function validateOptionBlock(
  value: Record<string, unknown>,
  counters: Counters,
): string | null {
  if (!hasOnlyKeys(value, ["type", "attrs"])) {
    return "El documento contiene atributos no permitidos.";
  }
  const attrs = value.attrs;
  if (
    !isPlainObject(attrs) ||
    !hasOnlyKeys(attrs, [
      "blockId",
      "name",
      "variants",
      "defaultVariantId",
      "structuredOutput",
    ])
  ) {
    return "El Bloque de opciones tiene atributos no permitidos.";
  }

  const blockId = attrs.blockId;
  if (
    typeof blockId !== "string" ||
    blockId.length === 0 ||
    blockId.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength ||
    DANGEROUS_KEYS.has(blockId)
  ) {
    return "El id del Bloque de opciones no es válido.";
  }

  const name = attrs.name;
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > TEMPLATE_DOC_LIMITS.maxOptionBlockNameLength
  ) {
    return "El nombre del Bloque de opciones no es válido.";
  }

  const variants = attrs.variants;
  if (
    !Array.isArray(variants) ||
    variants.length === 0 ||
    variants.length > TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock
  ) {
    return "El Bloque de opciones debe tener entre 1 y " +
      `${TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock} variantes.`;
  }

  const seenIds = new Set<string>();
  for (const variant of variants) {
    const error = validateOptionVariant(variant, counters, seenIds);
    if (error) return error;
  }

  const defaultVariantId = attrs.defaultVariantId;
  if (typeof defaultVariantId !== "string" || !seenIds.has(defaultVariantId)) {
    return "La variante predeterminada del Bloque de opciones no es válida.";
  }

  const structuredOutput = attrs.structuredOutput;
  if (structuredOutput !== undefined && structuredOutput !== null) {
    if (
      !isPlainObject(structuredOutput) ||
      !hasOnlyKeys(structuredOutput, ["type", "variants"]) ||
      structuredOutput.type !== "time" ||
      !Array.isArray(structuredOutput.variants) ||
      structuredOutput.variants.length !== variants.length
    ) {
      return "La salida estructurada del Bloque de opciones no es válida.";
    }
    const configuredIds = new Set<string>();
    for (const output of structuredOutput.variants) {
      if (
        !isPlainObject(output) ||
        !hasOnlyKeys(output, ["variantId", "hourFieldKey", "minuteFieldKey"]) ||
        typeof output.variantId !== "string" ||
        !seenIds.has(output.variantId) ||
        configuredIds.has(output.variantId) ||
        typeof output.hourFieldKey !== "string" ||
        !FIELD_KEY_PATTERN.test(output.hourFieldKey) ||
        (output.minuteFieldKey !== null &&
          (typeof output.minuteFieldKey !== "string" ||
            !FIELD_KEY_PATTERN.test(output.minuteFieldKey)))
      ) {
        return "La salida estructurada del Bloque de opciones no es válida.";
      }
      const variant = variants.find(
        (candidate) =>
          isPlainObject(candidate) && candidate.id === output.variantId,
      ) as Record<string, unknown> | undefined;
      const content = Array.isArray(variant?.content) ? variant.content : [];
      const keys = new Set(
        content.flatMap((node) =>
          isPlainObject(node) &&
          node.type === "templateVariable" &&
          isPlainObject(node.attrs) &&
          typeof node.attrs.key === "string"
            ? [node.attrs.key]
            : [],
        ),
      );
      if (
        !keys.has(output.hourFieldKey) ||
        (typeof output.minuteFieldKey === "string" &&
          !keys.has(output.minuteFieldKey))
      ) {
        return "La salida estructurada debe usar variables de su variante.";
      }
      configuredIds.add(output.variantId);
    }
  }

  counters.optionBlocks += 1;
  if (counters.optionBlocks > TEMPLATE_DOC_LIMITS.maxOptionBlocksPerDocument) {
    return "El documento tiene demasiados Bloques de opciones.";
  }

  return null;
}

function validateInlineNode(
  value: unknown,
  counters: Counters,
): string | null {
  if (isPlainObject(value) && value.type === "optionBlock") {
    counters.nodes += 1;
    if (counters.nodes > TEMPLATE_DOC_LIMITS.maxNodes) {
      return "El documento tiene demasiados nodos.";
    }
    return validateOptionBlock(value, counters);
  }
  return validateSimpleInlineNode(value, counters);
}

function validateParagraph(value: unknown, counters: Counters): string | null {
  if (!isPlainObject(value) || value.type !== "paragraph") {
    return "El documento solo admite párrafos en el nivel superior.";
  }
  if (!hasOnlyKeys(value, ["type", "content"])) {
    return "El documento contiene atributos no permitidos.";
  }

  counters.nodes += 1;
  if (counters.nodes > TEMPLATE_DOC_LIMITS.maxNodes) {
    return "El documento tiene demasiados nodos.";
  }

  if (value.content === undefined) return null;
  if (!Array.isArray(value.content)) {
    return "El contenido de un párrafo debe ser una lista.";
  }

  for (const child of value.content) {
    const error = validateInlineNode(child, counters);
    if (error) return error;
  }
  return null;
}

export function validateTemplateDocument(
  value: unknown,
): TemplateDocumentValidation {
  if (!isPlainObject(value) || value.type !== "doc") {
    return invalid("El contenido del machote no es un documento válido.");
  }
  if (!hasOnlyKeys(value, ["type", "content"])) {
    return invalid("El documento contiene atributos no permitidos.");
  }
  if (!Array.isArray(value.content)) {
    return invalid("El documento debe contener una lista de párrafos.");
  }
  if (value.content.length > TEMPLATE_DOC_LIMITS.maxParagraphs) {
    return invalid("El documento tiene demasiados párrafos.");
  }

  const counters: Counters = {
    nodes: 0,
    textLength: 0,
    variableOccurrences: 0,
    variableKeys: new Set(),
    optionBlocks: 0,
  };

  for (const paragraph of value.content) {
    const error = validateParagraph(paragraph, counters);
    if (error) return invalid(error);
  }

  return { ok: true, document: value as unknown as TemplateDocument };
}
