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

import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FIELD_KEY_PATTERN } from "@/lib/validations/template-fields";
import { TEMPLATE_DOC_LIMITS } from "./types";

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
          "template-variable-chip rounded bg-teal-50 border border-teal-200 " +
          "px-1 py-0.5 text-teal-800 text-[0.9em] whitespace-nowrap",
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
  ];
}
