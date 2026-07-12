import { describe, expect, it } from "vitest";
import {
  extractTemplateVariablesFromDocument,
  findUnresolvedDocumentVariables,
} from "./variables";
import { legacyTextToDocument } from "./convert";
import { extractTemplateVariables } from "@/lib/templates/variables";

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

describe("findUnresolvedDocumentVariables", () => {
  it("lists variables with missing or blank values", () => {
    const doc = legacyTextToDocument("{{a}} {{b}} {{c}}");
    expect(
      findUnresolvedDocumentVariables(doc, { a: "valor", b: "   " }),
    ).toEqual(["b", "c"]);
  });
});
