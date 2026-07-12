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

import { FIELD_KEY_PATTERN } from "@/lib/validations/template-fields";
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

function validateInlineNode(
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
      const label = attrs.label;
      if (
        label !== undefined &&
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
  };

  for (const paragraph of value.content) {
    const error = validateParagraph(paragraph, counters);
    if (error) return invalid(error);
  }

  return { ok: true, document: value as unknown as TemplateDocument };
}
