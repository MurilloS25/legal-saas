import { describe, expect, it } from "vitest";
import {
  applyVariableLabels,
  extractTemplateVariablesFromDocument,
  findUnresolvedDocumentVariables,
} from "./variables";
import { legacyTextToDocument } from "./convert";
import { extractTemplateVariables } from "@/features/templates";

describe("extractTemplateVariablesFromDocument", () => {
  it("returns keys without duplicates in order of appearance", () => {
    const doc = legacyTextToDocument(
      "{{b}} luego {{a}} y de nuevo {{b}} y {{c}}",
    );
    expect(extractTemplateVariablesFromDocument(doc)).toEqual(["b", "a", "c"]);
  });

  it("matches the legacy text extractor for converted content", () => {
    const samples = [
      "ESCRITURA {{comprador.nombre}} placa {{vehiculo.placa}}",
      "{{a}}{{a}}{{b}}",
      "sin variables",
      "inválidas {{Con Mayúscula}} y válida {{ok}}",
      "multi\nlínea {{x}}\n{{y}}",
    ];
    for (const sample of samples) {
      expect(
        extractTemplateVariablesFromDocument(legacyTextToDocument(sample)),
      ).toEqual(extractTemplateVariables(sample));
    }
  });

  it("returns an empty list for an empty document", () => {
    expect(extractTemplateVariablesFromDocument(legacyTextToDocument(""))).toEqual(
      [],
    );
  });
});

describe("applyVariableLabels", () => {
  it("applies configured labels to variables without label", () => {
    const doc = legacyTextToDocument("Hola {{a}} y {{b}}");
    const labeled = applyVariableLabels(doc, { a: "Etiqueta A" });

    expect(labeled.content[0].content).toEqual([
      { type: "text", text: "Hola " },
      { type: "templateVariable", attrs: { key: "a", label: "Etiqueta A" } },
      { type: "text", text: " y " },
      { type: "templateVariable", attrs: { key: "b" } },
    ]);
    // El documento original no se muta.
    expect(doc.content[0].content?.[1]).toEqual({
      type: "templateVariable",
      attrs: { key: "a" },
    });
  });

  it("does not overwrite labels already present in the document", () => {
    const doc = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
          content: [
            {
              type: "templateVariable" as const,
              attrs: { key: "a", label: "Original" },
            },
          ],
        },
      ],
    };
    const labeled = applyVariableLabels(doc, { a: "Nueva" });
    expect(labeled.content[0].content?.[0]).toEqual({
      type: "templateVariable",
      attrs: { key: "a", label: "Original" },
    });
  });
});

describe("findUnresolvedDocumentVariables", () => {
  it("lists variables with missing or blank values", () => {
    const doc = legacyTextToDocument("{{a}} {{b}} {{c}}");
    expect(
      findUnresolvedDocumentVariables(doc, { a: "valor", b: "   " }),
    ).toEqual(["b", "c"]);
  });
});
