import { describe, expect, it } from "vitest";
import { buildDocumentModel, NO_MARKS, renderStructuredTemplate } from "./render";
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

  it("applies the configured transform for a variable's key", () => {
    const doc = legacyTextToDocument("Cédula {{comprador.cedula}}");
    const rendered = renderStructuredTemplate(
      doc,
      { "comprador.cedula": "208390123" },
      { "comprador.cedula": "digits_to_words" },
    );
    expect(rendered).toBe(
      "Cédula DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES",
    );
  });

  it("leaves a variable untransformed when its transform is 'none' or unconfigured", () => {
    const doc = legacyTextToDocument("{{a}} y {{b}}");
    const rendered = renderStructuredTemplate(
      doc,
      { a: "1600", b: "1600" },
      { a: "none" },
    );
    expect(rendered).toBe("1600 y 1600");
  });

  it("applies number_to_words per the configured transform", () => {
    const doc = legacyTextToDocument("Cilindraje {{vehiculo.cilindraje}}");
    const rendered = renderStructuredTemplate(
      doc,
      { "vehiculo.cilindraje": "1600" },
      { "vehiculo.cilindraje": "number_to_words" },
    );
    expect(rendered).toBe("Cilindraje MIL SEISCIENTOS");
  });

  it("applies number_to_words to a number embedded in surrounding text", () => {
    const doc = legacyTextToDocument("Fecha: {{fecha_texto}}");
    const rendered = renderStructuredTemplate(
      doc,
      { fecha_texto: "25 de julio" },
      { fecha_texto: "number_to_words" },
    );
    expect(rendered).toBe("Fecha: VEINTICINCO DE JULIO");
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

  it("renders an optionBlock's selected variant as plain text", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Comparecen con " },
            {
              type: "optionBlock",
              attrs: {
                blockId: "b1",
                name: "Chasis, VIN y Serie",
                defaultVariantId: "iguales",
                variants: [
                  {
                    id: "iguales",
                    label: "Todos iguales",
                    content: [
                      { type: "text", text: "número " },
                      { type: "templateVariable", attrs: { key: "vehiculo.numero" } },
                    ],
                  },
                  {
                    id: "distintos",
                    label: "Todos distintos",
                    content: [
                      { type: "text", text: "CHASIS " },
                      { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
                    ],
                  },
                ],
              },
            },
            { type: "text", text: "." },
          ],
        },
      ],
    };

    expect(
      renderStructuredTemplate(doc, { "vehiculo.numero": "999" }),
    ).toBe("Comparecen con número 999.");

    expect(
      renderStructuredTemplate(
        doc,
        { "vehiculo.chasis": "ABC123" },
        undefined,
        { b1: "distintos" },
      ),
    ).toBe("Comparecen con CHASIS ABC123.");
  });
});

describe("buildDocumentModel", () => {
  it("assigns a distinct nodeId to every repeated variable occurrence", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "templateVariable", attrs: { key: "numero_escritura" } },
            { type: "text", text: " y " },
            { type: "templateVariable", attrs: { key: "numero_escritura" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "optionBlock",
              attrs: {
                blockId: "cierre",
                name: "Cierre",
                defaultVariantId: "repite",
                variants: [
                  {
                    id: "repite",
                    label: "Repite número",
                    content: [
                      {
                        type: "templateVariable",
                        attrs: { key: "numero_escritura" },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const variableRuns = buildDocumentModel(doc, { numero_escritura: "7" })
      .flatMap((paragraph) => paragraph.runs)
      .flatMap((run) =>
        run.kind === "optionBlock" ? run.runs : [run],
      )
      .filter((run) => run.kind === "variable");

    expect(variableRuns.map((run) => run.key)).toEqual([
      "numero_escritura",
      "numero_escritura",
      "numero_escritura",
    ]);
    expect(
      new Set(
        variableRuns.map(
          (run) => (run as typeof run & { nodeId?: string }).nodeId,
        ),
      ).size,
    ).toBe(3);
    expect(variableRuns.every((run) => "nodeId" in run)).toBe(true);
  });

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
      nodeId: "paragraph:0:node:1",
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
      nodeId: "paragraph:0:node:3",
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

  it("resolves an optionBlock into an OptionBlockRun wrapping its default variant's runs", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Comparecen con " },
            {
              type: "optionBlock",
              attrs: {
                blockId: "b1",
                name: "Chasis, VIN y Serie",
                defaultVariantId: "distintos",
                variants: [
                  {
                    id: "iguales",
                    label: "Todos iguales",
                    content: [{ type: "text", text: "un mismo número" }],
                  },
                  {
                    id: "distintos",
                    label: "Todos distintos",
                    content: [
                      { type: "text", text: "CHASIS " },
                      {
                        type: "templateVariable",
                        attrs: { key: "vehiculo.chasis" },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const model = buildDocumentModel(doc, { "vehiculo.chasis": "ABC123" });
    expect(model[0].runs).toEqual([
      { kind: "text", text: "Comparecen con ", marks: NO_MARKS },
      {
        kind: "optionBlock",
        blockId: "b1",
        name: "Chasis, VIN y Serie",
        selectedVariantId: "distintos",
        variants: [
          { id: "iguales", label: "Todos iguales" },
          { id: "distintos", label: "Todos distintos" },
        ],
        runs: [
          { kind: "text", text: "CHASIS ", marks: NO_MARKS },
          {
            kind: "variable",
            nodeId: "paragraph:0:node:1:variant:distintos:node:1",
            key: "vehiculo.chasis",
            label: undefined,
            resolved: true,
            value: "ABC123",
          },
        ],
      },
    ]);
  });

  it("uses optionSelections to pick a non-default variant, falling back to the default when unset", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "optionBlock",
              attrs: {
                blockId: "b1",
                name: "Chasis, VIN y Serie",
                defaultVariantId: "distintos",
                variants: [
                  {
                    id: "iguales",
                    label: "Todos iguales",
                    content: [{ type: "text", text: "un mismo número" }],
                  },
                  {
                    id: "distintos",
                    label: "Todos distintos",
                    content: [{ type: "text", text: "números distintos" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const withoutSelection = buildDocumentModel(doc, {});
    const runWithoutSelection = withoutSelection[0].runs[0];
    if (runWithoutSelection.kind !== "optionBlock") throw new Error("expected optionBlock");
    expect(runWithoutSelection.selectedVariantId).toBe("distintos");

    const withSelection = buildDocumentModel(doc, {}, undefined, { b1: "iguales" });
    const runWithSelection = withSelection[0].runs[0];
    if (runWithSelection.kind !== "optionBlock") throw new Error("expected optionBlock");
    expect(runWithSelection.selectedVariantId).toBe("iguales");
    expect(runWithSelection.runs).toEqual([
      { kind: "text", text: "un mismo número", marks: NO_MARKS },
    ]);
  });

  it("resolves the same variable consistently whether it appears inside or outside an optionBlock", () => {
    const doc: TemplateDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "optionBlock",
              attrs: {
                blockId: "b1",
                name: "Hora",
                defaultVariantId: "con_minutos",
                variants: [
                  {
                    id: "en_punto",
                    label: "Hora en punto",
                    content: [{ type: "templateVariable", attrs: { key: "hora.valor" } }],
                  },
                  {
                    id: "con_minutos",
                    label: "Hora con minutos",
                    content: [
                      { type: "templateVariable", attrs: { key: "hora.valor" } },
                      { type: "text", text: " y " },
                      { type: "templateVariable", attrs: { key: "hora.minutos" } },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const model = buildDocumentModel(doc, {
      "hora.valor": "3",
      "hora.minutos": "15",
    });
    expect(model[0].runs).toHaveLength(1);
    const block = model[0].runs[0];
    if (block.kind !== "optionBlock") throw new Error("expected optionBlock");
    expect(block.runs).toHaveLength(3);
    expect(block.runs[0]).toMatchObject({ key: "hora.valor", resolved: true, value: "3" });
    expect(block.runs[2]).toMatchObject({ key: "hora.minutos", resolved: true, value: "15" });
  });
});
