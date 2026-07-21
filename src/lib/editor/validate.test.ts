import { describe, expect, it } from "vitest";
import { validateTemplateDocument } from "./validate";
import { TEMPLATE_DOC_LIMITS, emptyTemplateDocument } from "./types";

const doc = (content: unknown[]) => ({ type: "doc", content });
const p = (content?: unknown[]) =>
  content === undefined
    ? { type: "paragraph" }
    : { type: "paragraph", content };
const text = (t: string, marks?: unknown[]) =>
  marks === undefined ? { type: "text", text: t } : { type: "text", text: t, marks };
const variable = (key: string, label?: string) => ({
  type: "templateVariable",
  attrs: label === undefined ? { key } : { key, label },
});

describe("validateTemplateDocument", () => {
  it("accepts a valid document with paragraphs, marks and variables", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          text("Comparece ", [{ type: "bold" }]),
          variable("comprador.nombre", "Nombre del comprador"),
          text(", quien firma."),
        ]),
        p([text("Texto en cursiva", [{ type: "italic" }])]),
        p([text("Subrayado", [{ type: "underline" }])]),
        p(),
      ]),
    );

    expect(result.ok).toBe(true);
  });

  it("accepts the canonical empty document", () => {
    expect(validateTemplateDocument(emptyTemplateDocument()).ok).toBe(true);
  });

  it("accepts a hardBreak inline node", () => {
    const result = validateTemplateDocument(
      doc([p([text("línea 1"), { type: "hardBreak" }, text("línea 2")])]),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown node types", () => {
    const result = validateTemplateDocument(
      doc([p([{ type: "image", attrs: { src: "https://example.com/x.png" } }])]),
    );
    expect(result).toEqual({
      ok: false,
      error: "El documento contiene un nodo no permitido.",
    });
  });

  it("rejects unknown top-level blocks", () => {
    const result = validateTemplateDocument(
      doc([{ type: "heading", content: [text("Título")] }]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown marks", () => {
    const result = validateTemplateDocument(
      doc([p([text("hola", [{ type: "link" }])])]),
    );
    expect(result).toEqual({
      ok: false,
      error: "El documento contiene una marca no permitida.",
    });
  });

  it("rejects marks with extra attributes", () => {
    const result = validateTemplateDocument(
      doc([p([text("hola", [{ type: "bold", attrs: { color: "red" } }])])]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicated marks", () => {
    const result = validateTemplateDocument(
      doc([p([text("hola", [{ type: "bold" }, { type: "bold" }])])]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown properties on nodes", () => {
    const result = validateTemplateDocument(
      doc([p([{ type: "text", text: "hola", onClick: "alert(1)" }])]),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a variable with attrs.label explicitly null", () => {
    // Tiptap siempre serializa `label` con el valor por defecto del esquema
    // (`null`) cuando no se asignó ninguno -- por ejemplo, variables
    // detectadas al escribir o pegar `{{clave}}`. `null` debe tratarse igual
    // que "sin etiqueta" (ausente), no como un valor inválido.
    const result = validateTemplateDocument(
      doc([p([{ type: "templateVariable", attrs: { key: "sin.etiqueta", label: null } }])]),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a variable with a non-string, non-null label", () => {
    const result = validateTemplateDocument(
      doc([p([{ type: "templateVariable", attrs: { key: "clave", label: 42 } }])]),
    );
    expect(result).toEqual({
      ok: false,
      error: "La etiqueta de una variable no es válida.",
    });
  });

  it("rejects unknown attrs on variables", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          {
            type: "templateVariable",
            attrs: { key: "ok", style: "color:red" },
          },
        ]),
      ]),
    );
    expect(result).toEqual({
      ok: false,
      error: "La variable tiene atributos no permitidos.",
    });
  });

  it("rejects invalid variable keys", () => {
    for (const key of ["Con Mayúscula", "con espacio", "tilde.á", "", "a..b"]) {
      const result = validateTemplateDocument(doc([p([variable(key)])]));
      expect(result.ok).toBe(false);
    }
  });

  it("rejects dangerous keys as variable keys", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const result = validateTemplateDocument(doc([p([variable(key)])]));
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a JSON payload with a dangerous property name", () => {
    const parsed = JSON.parse(
      '{"type":"doc","content":[{"type":"paragraph","__proto__":{"polluted":true}}]}',
    );
    expect(validateTemplateDocument(parsed).ok).toBe(false);
  });

  it("rejects non-object payloads", () => {
    for (const value of [null, undefined, "doc", 42, [], () => {}]) {
      expect(validateTemplateDocument(value).ok).toBe(false);
    }
  });

  it("rejects empty text nodes", () => {
    expect(validateTemplateDocument(doc([p([text("")])])).ok).toBe(false);
  });

  it("rejects documents over the paragraph limit", () => {
    const paragraphs = Array.from(
      { length: TEMPLATE_DOC_LIMITS.maxParagraphs + 1 },
      () => p(),
    );
    expect(validateTemplateDocument(doc(paragraphs)).ok).toBe(false);
  });

  it("rejects documents over the total text limit", () => {
    const chunk = "a".repeat(10_000);
    const paragraphs = Array.from({ length: 21 }, () => p([text(chunk)]));
    const result = validateTemplateDocument(doc(paragraphs));
    expect(result).toEqual({
      ok: false,
      error: "El contenido del machote es demasiado largo.",
    });
  });

  it("rejects variable keys over the length limit", () => {
    const key = "a".repeat(TEMPLATE_DOC_LIMITS.maxVariableKeyLength + 1);
    expect(validateTemplateDocument(doc([p([variable(key)])])).ok).toBe(false);
  });

  it("rejects too many distinct variables", () => {
    const nodes = Array.from(
      { length: TEMPLATE_DOC_LIMITS.maxDistinctVariables + 1 },
      (_, i) => variable(`v_${i}`),
    );
    expect(validateTemplateDocument(doc([p(nodes)])).ok).toBe(false);
  });

  it("rejects deeply nested content (paragraph inside paragraph)", () => {
    const result = validateTemplateDocument(doc([p([p([text("x")])])]));
    expect(result.ok).toBe(false);
  });
});

const optionBlock = (
  variants: { id: string; label: string; content: unknown[] }[],
  defaultVariantId: string,
  overrides: { blockId?: string; name?: string } = {},
) => ({
  type: "optionBlock",
  attrs: {
    blockId: overrides.blockId ?? "block-1",
    name: overrides.name ?? "Chasis, VIN y Serie",
    variants,
    defaultVariantId,
  },
});

describe("validateTemplateDocument — optionBlock", () => {
  it("accepts a valid option block with several variants", () => {
    const block = optionBlock(
      [
        { id: "v1", label: "Todos iguales", content: [text("Todos iguales")] },
        {
          id: "v2",
          label: "Todos distintos",
          content: [
            text("CHASIS número "),
            variable("vehiculo.chasis"),
            text(", VIN número "),
            variable("vehiculo.vin"),
            text(" y SERIE número "),
            variable("vehiculo.serie"),
          ],
        },
      ],
      "v2",
    );
    const result = validateTemplateDocument(doc([p([block])]));
    expect(result.ok).toBe(true);
  });

  it("rejects a block with zero variants", () => {
    const result = validateTemplateDocument(doc([p([optionBlock([], "v1")])]));
    expect(result.ok).toBe(false);
  });

  it("rejects a block with more variants than the limit", () => {
    const variants = Array.from(
      { length: TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock + 1 },
      (_, i) => ({ id: `v${i}`, label: `Variante ${i}`, content: [text("x")] }),
    );
    const result = validateTemplateDocument(
      doc([p([optionBlock(variants, "v0")])]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a defaultVariantId that does not match any variant", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          optionBlock(
            [{ id: "v1", label: "Única", content: [text("x")] }],
            "no-existe",
          ),
        ]),
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate variant ids", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          optionBlock(
            [
              { id: "v1", label: "A", content: [text("a")] },
              { id: "v1", label: "B", content: [text("b")] },
            ],
            "v1",
          ),
        ]),
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty variant label", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          optionBlock([{ id: "v1", label: "", content: [text("x")] }], "v1"),
        ]),
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty block name", () => {
    const result = validateTemplateDocument(
      doc([
        p([
          optionBlock(
            [{ id: "v1", label: "A", content: [text("x")] }],
            "v1",
            { name: "" },
          ),
        ]),
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an optionBlock nested inside a variant's content", () => {
    const nested = optionBlock(
      [{ id: "inner", label: "Interno", content: [text("x")] }],
      "inner",
    );
    const result = validateTemplateDocument(
      doc([
        p([
          optionBlock(
            [{ id: "v1", label: "A", content: [nested] }],
            "v1",
          ),
        ]),
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown attrs on the block or a variant", () => {
    const withExtraBlockAttr = {
      type: "optionBlock",
      attrs: {
        blockId: "b1",
        name: "Hora",
        variants: [{ id: "v1", label: "En punto", content: [text("x")] }],
        defaultVariantId: "v1",
        extra: "not allowed",
      },
    };
    expect(validateTemplateDocument(doc([p([withExtraBlockAttr])])).ok).toBe(
      false,
    );

    const withExtraVariantAttr = optionBlock(
      [
        {
          id: "v1",
          label: "En punto",
          content: [text("x")],
          // @ts-expect-error intentionally invalid for this test
          extra: "not allowed",
        },
      ],
      "v1",
    );
    expect(
      validateTemplateDocument(doc([p([withExtraVariantAttr])])).ok,
    ).toBe(false);
  });

  it("accepts the Hora example with two variants", () => {
    const block = optionBlock(
      [
        { id: "en_punto", label: "Hora en punto", content: [variable("hora.valor")] },
        {
          id: "con_minutos",
          label: "Hora con minutos",
          content: [variable("hora.valor"), text(" con "), variable("hora.minutos")],
        },
      ],
      "en_punto",
      { name: "Hora" },
    );
    expect(validateTemplateDocument(doc([p([block])])).ok).toBe(true);
  });
});
