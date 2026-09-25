/**
 * Utilidades puras para configurar un Bloque de opciones desde el diálogo
 * "Insertar bloque de opciones" del Machote. Única fuente de verdad para
 * construir, validar y (de)serializar `TemplateOptionBlockAttrs` — el
 * diálogo de inserción/edición y sus tests la comparten.
 */

import { lineToInlineNodes, serializeSimpleNode } from "./convert";
import { TEMPLATE_DOC_LIMITS } from "./types";
import type {
  TemplateOptionBlockAttrs,
  TemplateDocument,
  TemplateOptionVariant,
  TemplateTimeStructuredVariant,
  TemplateVariantContentNode,
} from "./types";

export type OptionBlockVariantSummary = {
  id: string;
  label: string;
  /** Claves de variable presentes en el contenido de esta variante — las
   * únicas candidatas válidas para mapear Hora/Minutos desde el Índice
   * Notarial (ver `TemplateIndexConfigurationSection`). */
  variableKeys: string[];
};

/**
 * Vista de un Bloque de opciones para consumidores fuera del editor del
 * Machote — hoy solo el mapeo Hora/Minutos del Índice Notarial. Incluye
 * TODOS los bloques (no solo los que ya tienen `structuredOutput`), porque
 * el Índice es ahora quien decide y configura cuál bloque cumple ese rol —
 * el diálogo "Insertar/Editar bloque de opciones" ya no pregunta por esto
 * (ver `OptionBlockDialog.tsx`).
 */
export type OptionBlockSummary = {
  blockId: string;
  name: string;
  variants: OptionBlockVariantSummary[];
  /** Mapeo vigente, si el Índice Notarial ya configuró este bloque como
   * fuente de "Hora de autorización". */
  structuredOutput: TemplateOptionBlockAttrs["structuredOutput"];
};

function variantVariableKeys(variant: TemplateOptionVariant): string[] {
  return [
    ...new Set(
      variant.content.flatMap((node) =>
        node.type === "templateVariable" ? [node.attrs.key] : [],
      ),
    ),
  ];
}

export function extractOptionBlockSummaries(
  document: TemplateDocument,
): OptionBlockSummary[] {
  return document.content.flatMap((paragraph) =>
    (paragraph.content ?? []).flatMap((node) =>
      node.type === "optionBlock"
        ? [
            {
              blockId: node.attrs.blockId,
              name: node.attrs.name,
              variants: node.attrs.variants.map((variant) => ({
                id: variant.id,
                label: variant.label,
                variableKeys: variantVariableKeys(variant),
              })),
              structuredOutput: node.attrs.structuredOutput ?? null,
            },
          ]
        : [],
    ),
  );
}

/** Borrador de variante tal como lo edita el diálogo (texto plano, no nodos). */
export type OptionVariantDraft = {
  id: string;
  label: string;
  contentText: string;
};

/**
 * Borrador del bloque completo tal como lo edita el diálogo — nombre,
 * variantes y contenido. El mapeo Hora/Minutos (`structuredOutput`) ya no
 * se edita aquí: el diálogo lo conserva sin tocarlo (ver
 * `buildOptionBlockAttrs`) y solo se configura desde el Índice Notarial.
 */
export type OptionBlockDraft = {
  blockId: string;
  name: string;
  variants: OptionVariantDraft[];
  defaultVariantId: string;
};

/**
 * Convierte el texto de "Contenido de variante" (una línea, puede incluir
 * `{{clave.variable}}`) a nodos estructurados. Reutiliza el mismo parser de
 * placeholders que el contenido legacy — ninguna lógica duplicada.
 */
export function parseVariantContentText(
  raw: string,
): TemplateVariantContentNode[] {
  const singleLine = raw.replace(/[\r\n]+/g, " ").trim();
  if (singleLine === "") return [];
  return lineToInlineNodes(singleLine) as TemplateVariantContentNode[];
}

/** Inversa de `parseVariantContentText`, para prellenar el diálogo al editar. */
export function serializeVariantContentToText(
  content: TemplateVariantContentNode[],
): string {
  return content.map(serializeSimpleNode).join("");
}

export function generateOptionId(): string {
  return globalThis.crypto.randomUUID();
}

export type BuildOptionBlockResult =
  | { ok: true; attrs: TemplateOptionBlockAttrs }
  | { ok: false; error: string };

/**
 * Poda el mapeo Hora/Minutos vigente (si existe) contra las variantes que
 * el diálogo acaba de guardar — el diálogo ya no lo edita, pero sí puede
 * invalidarlo indirectamente: renombrar el contenido de una variante puede
 * hacer que la clave de hora/minutos elegida desde el Índice Notarial ya no
 * exista ahí. Nunca descarta el bloque completo por esto — solo la entrada
 * afectada (o solo sus minutos, si es lo único que dejó de existir), para
 * no borrar silenciosamente la configuración de las demás variantes.
 */
function pruneStructuredOutput(
  structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
  variants: TemplateOptionVariant[],
): TemplateOptionBlockAttrs["structuredOutput"] {
  if (!structuredOutput) return null;
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

  const pruned: TemplateTimeStructuredVariant[] = [];
  for (const entry of structuredOutput.variants) {
    const variant = variantsById.get(entry.variantId);
    if (!variant) continue;
    const keys = new Set(variantVariableKeys(variant));
    if (!keys.has(entry.hourFieldKey)) continue;
    pruned.push({
      ...entry,
      minuteFieldKey:
        entry.minuteFieldKey !== null && keys.has(entry.minuteFieldKey)
          ? entry.minuteFieldKey
          : null,
    });
  }
  return pruned.length > 0 ? { type: "time", variants: pruned } : null;
}

/**
 * Valida un borrador del diálogo y lo convierte a los attrs estructurados
 * del nodo `optionBlock`. Reglas: nombre no vacío; entre 1 y el máximo de
 * variantes permitido; cada variante con etiqueta no vacía; el contenido de
 * una variante PUEDE ser vacío (la cláusula no existe en esa modalidad, p. ej.
 * "Sin garantía"), pero al menos una variante debe tener contenido;
 * exactamente una variante marcada como predeterminada.
 *
 * `existingStructuredOutput` es el mapeo Hora/Minutos vigente del bloque
 * (si edita uno existente) — el diálogo ya no lo edita (ver
 * `OptionBlockDialog.tsx`; se configura desde el Índice Notarial), así que
 * se conserva tal cual, podado contra las variantes resultantes.
 */
export function buildOptionBlockAttrs(
  draft: OptionBlockDraft,
  existingStructuredOutput: TemplateOptionBlockAttrs["structuredOutput"] = null,
): BuildOptionBlockResult {
  const name = draft.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del bloque es requerido." };
  }
  if (name.length > TEMPLATE_DOC_LIMITS.maxOptionBlockNameLength) {
    return { ok: false, error: "El nombre del bloque es demasiado largo." };
  }

  if (draft.variants.length === 0) {
    return { ok: false, error: "Agrega al menos una variante." };
  }
  if (draft.variants.length > TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock) {
    return {
      ok: false,
      error: `El bloque admite hasta ${TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock} variantes.`,
    };
  }

  const variants: TemplateOptionVariant[] = [];
  for (const variantDraft of draft.variants) {
    const label = variantDraft.label.trim();
    if (label === "") {
      return { ok: false, error: "Cada variante necesita una etiqueta." };
    }
    if (label.length > TEMPLATE_DOC_LIMITS.maxOptionVariantLabelLength) {
      return { ok: false, error: "La etiqueta de una variante es demasiado larga." };
    }
    const content =
      variantDraft.contentText.trim() === ""
        ? []
        : parseVariantContentText(variantDraft.contentText);
    variants.push({ id: variantDraft.id, label, content });
  }
  if (variants.every((variant) => variant.content.length === 0)) {
    return {
      ok: false,
      error: "Al menos una variante necesita contenido. Una variante vacía indica que el texto no aparece.",
    };
  }

  if (!draft.variants.some((v) => v.id === draft.defaultVariantId)) {
    return {
      ok: false,
      error: "Selecciona cuál variante es la predeterminada.",
    };
  }

  return {
    ok: true,
    attrs: {
      blockId: draft.blockId,
      name,
      variants,
      defaultVariantId: draft.defaultVariantId,
      structuredOutput: pruneStructuredOutput(existingStructuredOutput, variants),
    },
  };
}

/**
 * Convierte los attrs persistidos de vuelta a un borrador editable. No
 * incluye `structuredOutput` — el diálogo ya no lo edita, así que su
 * pass-through vive en `buildOptionBlockAttrs` (recibe el valor vigente por
 * separado, directo de `initialAttrs`, no a través de este borrador).
 */
export function attrsToDraft(attrs: TemplateOptionBlockAttrs): OptionBlockDraft {
  return {
    blockId: attrs.blockId,
    name: attrs.name,
    defaultVariantId: attrs.defaultVariantId,
    variants: attrs.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      contentText: serializeVariantContentToText(variant.content),
    })),
  };
}
