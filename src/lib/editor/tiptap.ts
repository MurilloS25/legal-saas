/**
 * Configuración de Tiptap para el editor de machotes.
 *
 * Solo Tiptap Community (MIT), sin Cloud, sin extensiones Pro, sin
 * colaboración ni telemetría. El esquema del editor es exactamente el
 * subconjunto definido en `types.ts`: párrafos, texto, negrita, cursiva,
 * subrayado, saltos de línea y el nodo inline `templateVariable`.
 *
 * Este módulo importa Tiptap, así que solo debe usarse desde componentes
 * cliente. La validación/serialización del lado servidor vive en los
 * módulos puros (`validate.ts`, `convert.ts`, `render.ts`).
 */

import {
  Node,
  mergeAttributes,
  nodeInputRule,
  nodePasteRule,
  type Extensions,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  FIELD_KEY_PATTERN,
  VARIABLE_INPUT_RULE_PATTERN,
  VARIABLE_PASTE_RULE_PATTERN,
} from "./variable-key";
import { TEMPLATE_DOC_LIMITS } from "./types";
import type { TemplateOptionBlockAttrs } from "./types";

export type InsertTemplateVariableOptions = {
  key: string;
  label?: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateVariable: {
      /** Inserta una variable de machote en la posición del cursor. */
      insertTemplateVariable: (
        options: InsertTemplateVariableOptions,
      ) => ReturnType;
    };
    optionBlock: {
      /** Inserta un Bloque de opciones en la posición del cursor. */
      insertOptionBlock: (attrs: TemplateOptionBlockAttrs) => ReturnType;
    };
  }
}

function isValidVariableKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= TEMPLATE_DOC_LIMITS.maxVariableKeyLength &&
    FIELD_KEY_PATTERN.test(key)
  );
}

/**
 * Nodo inline atómico para las variables del machote.
 *
 * - Es una unidad: no puede editarse por dentro y se elimina completo.
 * - Solo admite los atributos `key` y `label`; nada de HTML arbitrario.
 * - En el editor se muestra como ficha con la etiqueta (o `{{key}}`).
 * - Se serializa a texto como `{{key}}` (clipboard y compatibilidad).
 */
export const TemplateVariableNode = Node.create({
  name: "templateVariable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => {
          const key = element.getAttribute("data-variable-key");
          return isValidVariableKey(key) ? key : null;
        },
        renderHTML: (attributes) => ({
          "data-variable-key": String(attributes.key ?? ""),
        }),
      },
      label: {
        default: null,
        parseHTML: (element) => {
          const label = element.getAttribute("data-variable-label");
          if (typeof label !== "string" || label.length === 0) return null;
          return label.slice(0, TEMPLATE_DOC_LIMITS.maxVariableLabelLength);
        },
        renderHTML: (attributes) =>
          typeof attributes.label === "string" && attributes.label.length > 0
            ? { "data-variable-label": attributes.label }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable-key]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key ?? "");
    const label =
      typeof node.attrs.label === "string" && node.attrs.label.trim() !== ""
        ? node.attrs.label
        : `{{${key}}}`;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class:
          "template-variable-chip rounded bg-accent-50 border border-accent-200 " +
          "px-1 py-0.5 text-accent-800 text-[0.9em] whitespace-nowrap",
      }),
      label,
    ];
  },

  renderText({ node }) {
    return `{{${String(node.attrs.key ?? "")}}}`;
  },

  addCommands() {
    return {
      insertTemplateVariable:
        (options) =>
        ({ commands }) => {
          if (!isValidVariableKey(options.key)) return false;
          const label = options.label?.trim();
          return commands.insertContent({
            type: this.name,
            attrs: {
              key: options.key,
              label:
                label && label.length > 0
                  ? label.slice(0, TEMPLATE_DOC_LIMITS.maxVariableLabelLength)
                  : null,
            },
          });
        },
    };
  },

  // Convierte `{{clave}}` escrito o pegado a mano en una variable real, sin
  // pasar por el diálogo "Insertar variable". El regex solo admite el mismo
  // alfabeto que `FIELD_KEY_PATTERN` (minúsculas, números, guion bajo, puntos
  // simples): un placeholder con sintaxis inválida —mayúsculas, espacios,
  // llaves vacías— simplemente no coincide y queda como texto plano. No hay
  // interpretación de expresiones ni ejecución de código: el "clave" nunca
  // se evalúa, solo se copia como atributo del nodo.
  addInputRules() {
    return [
      nodeInputRule({
        find: VARIABLE_INPUT_RULE_PATTERN,
        type: this.type,
        getAttributes: (match) => ({ key: match[1] }),
      }),
    ];
  },

  // Misma conversión para texto pegado; a diferencia de la regla de entrada,
  // las reglas de pegado sí pueden abortar la coincidencia (devolviendo
  // `false`) — se usa para descartar claves más largas que el límite
  // persistido, en vez de crear una variable que el guardado rechazaría.
  addPasteRules() {
    return [
      nodePasteRule({
        find: VARIABLE_PASTE_RULE_PATTERN,
        type: this.type,
        getAttributes: (match) => {
          const key = match[1];
          if (key.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength) {
            return false;
          }
          return { key };
        },
      }),
    ];
  },
});

function isValidOptionBlockAttrs(
  attrs: unknown,
): attrs is TemplateOptionBlockAttrs {
  if (typeof attrs !== "object" || attrs === null) return false;
  const a = attrs as Record<string, unknown>;
  return (
    typeof a.blockId === "string" &&
    a.blockId.length > 0 &&
    typeof a.name === "string" &&
    a.name.trim().length > 0 &&
    Array.isArray(a.variants) &&
    a.variants.length > 0 &&
    typeof a.defaultVariantId === "string"
  );
}

/**
 * Nodo inline atómico para los Bloques de opciones.
 *
 * - Es una unidad: no se edita por dentro del editor de texto — su
 *   contenido se configura siempre a través del diálogo dedicado.
 * - Guarda sus variantes como JSON en un atributo `data-variants`, para que
 *   copiar/pegar dentro del editor conserve toda la configuración.
 * - Se serializa a texto como `[Bloque: nombre]` (clipboard y
 *   compatibilidad) — nunca como un token `{{SMART:...}}` legacy.
 */
export const OptionBlockNode = Node.create({
  name: "optionBlock",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-option-block-id"),
        renderHTML: (attributes) => ({
          "data-option-block-id": String(attributes.blockId ?? ""),
        }),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name") ?? "",
        renderHTML: (attributes) => ({
          "data-name": String(attributes.name ?? ""),
        }),
      },
      variants: {
        default: [],
        parseHTML: (element) => {
          try {
            const raw = element.getAttribute("data-variants");
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-variants": JSON.stringify(attributes.variants ?? []),
        }),
      },
      defaultVariantId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-default-variant-id"),
        renderHTML: (attributes) => ({
          "data-default-variant-id": String(attributes.defaultVariantId ?? ""),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-option-block-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class:
          "option-block-chip rounded bg-accent-50 border border-dashed " +
          "border-accent-300 px-1.5 py-0.5 text-accent-800 text-[0.9em] " +
          "whitespace-nowrap cursor-pointer",
      }),
      `Bloque: ${name}`,
    ];
  },

  renderText({ node }) {
    return `[Bloque: ${String(node.attrs.name ?? "")}]`;
  },

  addCommands() {
    return {
      insertOptionBlock:
        (attrs) =>
        ({ commands }) => {
          if (!isValidOptionBlockAttrs(attrs)) return false;
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});

/**
 * Extensiones habilitadas del editor. StarterKit se recorta al esquema
 * permitido: se desactivan encabezados, listas, código, citas, regla
 * horizontal, tachado y enlaces.
 */
export function buildEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: false,
    }),
    TemplateVariableNode,
    OptionBlockNode,
  ];
}
