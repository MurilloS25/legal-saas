import { describe, expect, it } from "vitest";
import {
  documentToPlainText,
  legacyTextToDocument,
  serializeDocumentToTemplateText,
} from "./convert";
import { validateTemplateDocument } from "./validate";
import type { TemplateDocument } from "./types";

describe("legacyTextToDocument", () => {
  it("converts plain text lines into paragraphs", () => {
    const doc = legacyTextToDocument("línea uno\nlínea dos");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "línea uno" }] },
        { type: "paragraph", content: [{ type: "text", text: "línea dos" }] },
      ],
    });
  });

  it("converts valid placeholders into templateVariable nodes", () => {
    const doc = legacyTextToDocument("Comparece {{comprador.nombre}} hoy.");
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "Comparece " },
      { type: "templateVariable", attrs: { key: "comprador.nombre" } },
      { type: "text", text: " hoy." },
    ]);
  });

  it("handles a variable at the start and at the end", () => {
    const doc = legacyTextToDocument("{{inicio}} y {{final}}");
    expect(doc.content[0].content).toEqual([
      { type: "templateVariable", attrs: { key: "inicio" } },
      { type: "text", text: " y " },
      { type: "templateVariable", attrs: { key: "final" } },
    ]);
  });

  it("handles consecutive variables", () => {
    const doc = legacyTextToDocument("{{a}}{{b}}");
    expect(doc.content[0].content).toEqual([
      { type: "templateVariable", attrs: { key: "a" } },
      { type: "templateVariable", attrs: { key: "b" } },
    ]);
  });

  it("keeps invalid placeholders as literal text", () => {
    const doc = legacyTextToDocument("Texto {{Clave Mala}} y {{}} literal");
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "Texto {{Clave Mala}} y {{}} literal" },
    ]);
  });

  it("keeps braces that are not placeholders", () => {
    const doc = legacyTextToDocument("conjunto {a, b} y {{{x}}}");
    // `{{{x}}}` contiene el placeholder válido `{{x}}` tras la primera llave.
    expect(serializeDocumentToTemplateText(doc)).toBe("conjunto {a, b} y {{{x}}}");
  });

  it("normalizes {{ key }} with inner spaces to a variable node", () => {
    const doc = legacyTextToDocument("Hola {{ nombre }}.");
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "Hola " },
      { type: "templateVariable", attrs: { key: "nombre" } },
      { type: "text", text: "." },
    ]);
  });

  it("normalizes CRLF and CR line endings", () => {
    const doc = legacyTextToDocument("uno\r\ndos\rtres");
    expect(doc.content).toHaveLength(3);
    expect(serializeDocumentToTemplateText(doc)).toBe("uno\ndos\ntres");
  });

  it("converts empty lines into empty paragraphs", () => {
    const doc = legacyTextToDocument("uno\n\ndos");
    expect(doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "uno" }] },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "dos" }] },
    ]);
  });

  it("converts the empty string into the canonical empty document", () => {
    expect(legacyTextToDocument("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("always produces a document that passes validation", () => {
    const samples = [
      "",
      "texto plano",
      "{{a}}{{b}} y {{ c }}",
      "línea\ncon\nsaltos\n\n\ny vacíos",
      "llaves {no válidas} y {{tampoco esto}}",
    ];
    for (const sample of samples) {
      expect(validateTemplateDocument(legacyTextToDocument(sample)).ok).toBe(true);
    }
  });
});

describe("serializeDocumentToTemplateText", () => {
  it("round-trips canonical legacy text exactly", () => {
    const samples = [
      "ESCRITURA. Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}.",
      "{{inicio}} texto {{final}}",
      "{{a}}{{b}}",
      "línea uno\nlínea dos\n\nlínea cuatro",
      "sin variables, con puntuación jurídica: PRIMERO.- SEGUNDO.-",
      "",
    ];
    for (const sample of samples) {
      expect(serializeDocumentToTemplateText(legacyTextToDocument(sample))).toBe(
        sample,
      );
    }
  });

  it("serializes hardBreak as a newline", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "uno" },
            { type: "hardBreak" },
            { type: "text", text: "dos" },
          ],
        },
      ],
    };
    expect(serializeDocumentToTemplateText(doc)).toBe("uno\ndos");
  });

  it("emits compatibility syntax for variables regardless of label", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "templateVariable",
              attrs: { key: "lugar", label: "Lugar de otorgamiento" },
            },
          ],
        },
      ],
    };
    expect(serializeDocumentToTemplateText(doc)).toBe("{{lugar}}");
  });
});

describe("documentToPlainText", () => {
  it("renders variables by label, falling back to the key", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Otorgado en " },
            { type: "templateVariable", attrs: { key: "lugar", label: "Lugar" } },
            { type: "text", text: " por " },
            { type: "templateVariable", attrs: { key: "poderdante.nombre" } },
          ],
        },
      ],
    };
    expect(documentToPlainText(doc)).toBe(
      "Otorgado en Lugar por poderdante.nombre",
    );
  });
});
