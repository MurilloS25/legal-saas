/**
 * Formato documental canónico de los machotes.
 *
 * Es un subconjunto estricto del JSON de Tiptap/ProseMirror. Solo se admite
 * lo que el producto necesita hoy:
 *
 * - documento → párrafos → texto | variable | salto de línea;
 * - marcas de negrita, cursiva y subrayado sobre texto;
 * - variables de machote como nodo inline estructurado (`templateVariable`)
 *   con una clave estable y una etiqueta opcional.
 *
 * Cualquier otro nodo, marca o atributo se rechaza en la validación
 * (`validate.ts`). Estos tipos no dependen de React ni de Tiptap: son datos
 * puros que también consume el modelo de render (`render.ts`).
 */

export const TEMPLATE_DOC_MARKS = ["bold", "italic", "underline"] as const;
export type TemplateDocMarkType = (typeof TEMPLATE_DOC_MARKS)[number];

export type TemplateDocMark = {
  type: TemplateDocMarkType;
};

export type TemplateTextNode = {
  type: "text";
  text: string;
  marks?: TemplateDocMark[];
};

export type TemplateVariableAttrs = {
  key: string;
  label?: string;
};

export type TemplateVariableNode = {
  type: "templateVariable";
  attrs: TemplateVariableAttrs;
};

export type TemplateHardBreakNode = {
  type: "hardBreak";
};

/**
 * Contenido de una variante de Bloque de opciones: el mismo subconjunto de
 * nodos inline "simples" que existía antes de los Bloques (texto, variable,
 * salto de línea). Deliberadamente NO incluye `optionBlock`: los bloques no
 * se anidan.
 */
export type TemplateVariantContentNode =
  | TemplateTextNode
  | TemplateVariableNode
  | TemplateHardBreakNode;

export type TemplateOptionVariant = {
  /** Id estable de la variante dentro del bloque (no cambia al editar). */
  id: string;
  /** Etiqueta visible del selector, p. ej. "Todos distintos". */
  label: string;
  content: TemplateVariantContentNode[];
};

export type TemplateOptionBlockAttrs = {
  /** Id estable del bloque, generado al insertarlo; no cambia al editar. */
  blockId: string;
  /** Nombre del bloque, p. ej. "Chasis, VIN y Serie". */
  name: string;
  variants: TemplateOptionVariant[];
  /** Debe coincidir con el `id` de una de las `variants`. */
  defaultVariantId: string;
};

/**
 * Bloque de opciones: una frase o fragmento que cambia entre variantes
 * predefinidas (p. ej. "Chasis, VIN y Serie" o "Hora"). Se inserta como
 * nodo estructurado — nunca como texto plano ambiguo ni como un token
 * `{{SMART:...}}` legacy.
 */
export type TemplateOptionBlockNode = {
  type: "optionBlock";
  attrs: TemplateOptionBlockAttrs;
};

export type TemplateInlineNode =
  | TemplateTextNode
  | TemplateVariableNode
  | TemplateHardBreakNode
  | TemplateOptionBlockNode;

export type TemplateParagraphNode = {
  type: "paragraph";
  content?: TemplateInlineNode[];
};

export type TemplateDocument = {
  type: "doc";
  content: TemplateParagraphNode[];
};

/** Documento vacío canónico: un párrafo sin contenido. */
export function emptyTemplateDocument(): TemplateDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

// ------------------------------------------------------------------ límites

/**
 * Límites del documento. La validación se aplica en servidor (Server
 * Actions) y también puede usarse en cliente para feedback temprano.
 * Los límites de clave/valores están alineados con los de documents
 * (`MAX_KEY_LENGTH`, `MAX_VALUE_ENTRIES`) y el snapshot renderizado
 * (`MAX_RENDERED_LENGTH`).
 */
export const TEMPLATE_DOC_LIMITS = {
  /** Nodos totales (párrafos + inline). */
  maxNodes: 20_000,
  /** Párrafos del documento. */
  maxParagraphs: 5_000,
  /** Caracteres de texto acumulados en todo el documento. */
  maxTextLength: 200_000,
  /** Longitud de la clave de una variable (igual que MAX_KEY_LENGTH). */
  maxVariableKeyLength: 120,
  /** Longitud de la etiqueta de una variable. */
  maxVariableLabelLength: 200,
  /** Claves distintas de variables (igual que MAX_VALUE_ENTRIES). */
  maxDistinctVariables: 200,
  /** Ocurrencias totales de variables. */
  maxVariableOccurrences: 2_000,
  /** Longitud del nombre de un Bloque de opciones. */
  maxOptionBlockNameLength: 200,
  /** Longitud de la etiqueta de una variante. */
  maxOptionVariantLabelLength: 200,
  /** Variantes permitidas por Bloque de opciones. */
  maxOptionVariantsPerBlock: 10,
  /** Bloques de opciones permitidos por documento. */
  maxOptionBlocksPerDocument: 50,
} as const;
