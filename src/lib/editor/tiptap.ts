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
  InputRule,
  Node,
  mergeAttributes,
  type Extensions,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FIELD_KEY_PATTERN, VARIABLE_INPUT_RULE_PATTERN } from "./variable-key";
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
  // Solo aplica a lo que se escribe a mano, carácter por carácter. El
  // pegado NUNCA convierte en silencio (ver `handlePaste` en
  // `TemplateEditor.tsx`): todo `{{...}}` pegado, sea cual sea su
  // mayúscula/minúscula, pasa siempre por el diálogo "Revisar variables
  // detectadas" antes de convertirse — así el usuario confirma clave,
  // etiqueta, obligatoriedad y transformación en un solo paso.
  //
  // Un `InputRule` a mano en vez del helper `nodeInputRule` de Tiptap: ese
  // helper asume que `match[1]` debe sobrevivir como texto alrededor del
  // nodo (pensado para sintaxis tipo markdown con delimitadores que se
  // conservan) — para `{{clave}}` queremos consumir AMBOS delimitadores
  // completos, no solo la clave. `range.to` (posición del cursor antes de
  // insertar el carácter que disparó la regla) ya cubre exactamente
  // "{{clave" — todo menos el "}" final, que Tiptap intercepta y nunca
  // llega a insertarse por separado si esta regla despacha su propia
  // transacción. Reemplazar [range.from, range.to] entero por el nodo deja
  // cero caracteres residuales, sin necesidad de reinsertar nada.
  addInputRules() {
    return [
      new InputRule({
        find: VARIABLE_INPUT_RULE_PATTERN,
        handler: ({ state, range, match }) => {
          const key = match[1];
          if (!key) return;
          state.tr.replaceWith(range.from, range.to, this.type.create({ key }));
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
      structuredOutput: {
        default: null,
        parseHTML: (element) => {
          try {
            const raw = element.getAttribute("data-structured-output");
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) =>
          attributes.structuredOutput
            ? {
                "data-structured-output": JSON.stringify(
                  attributes.structuredOutput,
                ),
              }
            : {},
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
