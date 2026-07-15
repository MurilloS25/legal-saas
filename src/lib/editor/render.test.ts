import { describe, expect, it } from "vitest";
import { buildDocumentModel, renderStructuredTemplate } from "./render";
import { legacyTextToDocument } from "./convert";
import { renderTemplateContent } from "@/features/templates";
import type { TemplateDocument } from "./types";

const structuredDoc: TemplateDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "PRIMERO.- Comparece " },
        {
          type: "templateVariable",
          attrs: { key: "comprador.nombre", label: "Nombre del comprador" },
        },
        { type: "text", text: ", cédula ", marks: [{ type: "bold" }] },
        { type: "templateVariable", attrs: { key: "comprador.cedula" } },
        { type: "text", text: "." },
      ],
    },
    { type: "paragraph" },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Firmado",
          marks: [{ type: "italic" }, { type: "underline" }],
        },
      ],
    },
  ],
};

describe("renderStructuredTemplate", () => {
  it("replaces variables with their values", () => {
    const rendered = renderStructuredTemplate(structuredDoc, {
      "comprador.nombre": "Cliente Uno",
      "comprador.cedula": "0-0000-0000",
    });
    expect(rendered).toBe(
      "PRIMERO.- Comparece Cliente Uno, cédula 0-0000-0000.\n\nFirmado",
    );
  });

  it("keeps unresolved variables visible as placeholders", () => {
    const rendered = renderStructuredTemplate(structuredDoc, {
      "comprador.nombre": "Cliente Uno",
    });
    expect(rendered).toContain("cédula {{comprador.cedula}}.");
  });

  it("treats blank values as unresolved", () => {
    const rendered = renderStructuredTemplate(structuredDoc, {
      "comprador.nombre": "   ",
      "comprador.cedula": "0-0000-0000",
    });
    expect(rendered).toContain("Comparece {{comprador.nombre}},");
  });

  it("preserves values with leading zeros and line breaks", () => {
    const doc = legacyTextToDocument("Placa {{placa}} y notas: {{notas}}");
    const rendered = renderStructuredTemplate(doc, {
      placa: "012345",
      notas: "línea 1\nlínea 2",
    });
    expect(rendered).toBe("Placa 012345 y notas: línea 1\nlínea 2");
  });

  it("does not re-expand placeholders inside values", () => {
    const doc = legacyTextToDocument("Hola {{a}}");
    const rendered = renderStructuredTemplate(doc, { a: "{{b}}" });
    expect(rendered).toBe("Hola {{b}}");
  });

  it("replaces every occurrence of a repeated variable", () => {
    const doc = legacyTextToDocument("{{x}} y de nuevo {{x}}");
    expect(renderStructuredTemplate(doc, { x: "V" })).toBe("V y de nuevo V");
  });

  it("ignores values for variables that are not in the document", () => {
    const doc = legacyTextToDocument("Sin variables");
    expect(renderStructuredTemplate(doc, { ajena: "x" })).toBe("Sin variables");
  });

  it("matches the legacy text renderer for converted legacy content", () => {
    const samples: [string, Record<string, string>][] = [
      [
        "ESCRITURA. Comparece {{comprador.nombre}}, placa {{vehiculo.placa}}.",
        { "comprador.nombre": "Cliente", "vehiculo.placa": "ABC-123" },
      ],
      ["{{a}}{{b}} y {{a}}", { a: "1", b: "2" }],
      ["Texto con {{Clave Mala}} intacta", { "clave mala": "no" }],
      ["Multi\nlínea con {{v}}\n\nfinal", { v: "valor" }],
      ["Sin valores {{pendiente}}", {}],
    ];

    for (const [content, values] of samples) {
      expect(
        renderStructuredTemplate(legacyTextToDocument(content), values),
      ).toBe(renderTemplateContent(content, values));
    }
  });
});

describe("buildDocumentModel", () => {
  it("produces paragraphs with typed runs and mark flags", () => {
    const model = buildDocumentModel(structuredDoc, {
      "comprador.nombre": "Cliente Uno",
    });

    expect(model).toHaveLength(3);
    expect(model[0].runs[0]).toEqual({
      kind: "text",
      text: "PRIMERO.- Comparece ",
      marks: { bold: false, italic: false, underline: false },
    });
    expect(model[0].runs[1]).toEqual({
      kind: "variable",
      key: "comprador.nombre",
      label: "Nombre del comprador",
      resolved: true,
      value: "Cliente Uno",
    });
    expect(model[0].runs[2]).toEqual({
      kind: "text",
      text: ", cédula ",
      marks: { bold: true, italic: false, underline: false },
    });
    expect(model[0].runs[3]).toEqual({
      kind: "variable",
      key: "comprador.cedula",
      label: undefined,
      resolved: false,
    });
    expect(model[1].runs).toEqual([]);
    expect(model[2].runs[0]).toEqual({
      kind: "text",
      text: "Firmado",
      marks: { bold: false, italic: true, underline: true },
    });
  });

  it("marks every variable as pending when no values are given", () => {
    const model = buildDocumentModel(structuredDoc);
    const variables = model
      .flatMap((paragraph) => paragraph.runs)
      .filter((run) => run.kind === "variable");
    expect(variables).toHaveLength(2);
    expect(variables.every((run) => !run.resolved)).toBe(true);
  });

  it("maps hardBreak to a break run", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "hardBreak" },
            { type: "text", text: "b" },
          ],
        },
      ],
    };
    expect(buildDocumentModel(doc)[0].runs[1]).toEqual({ kind: "break" });
  });
});
