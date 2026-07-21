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
  TemplateOptionVariant,
  TemplateVariantContentNode,
} from "./types";

/** Borrador de variante tal como lo edita el diálogo (texto plano, no nodos). */
export type OptionVariantDraft = {
  id: string;
  label: string;
  contentText: string;
};

/** Borrador del bloque completo tal como lo edita el diálogo. */
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
 * Valida un borrador del diálogo y lo convierte a los attrs estructurados
 * del nodo `optionBlock`. Reglas: nombre no vacío; entre 1 y el máximo de
 * variantes permitido; cada variante con etiqueta y contenido no vacíos;
 * exactamente una variante marcada como predeterminada.
 */
export function buildOptionBlockAttrs(
  draft: OptionBlockDraft,
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
    const content = parseVariantContentText(variantDraft.contentText);
    if (content.length === 0) {
      return { ok: false, error: "Cada variante necesita contenido." };
    }
    variants.push({ id: variantDraft.id, label, content });
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
    },
  };
}

/** Convierte los attrs persistidos de vuelta a un borrador editable. */
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
