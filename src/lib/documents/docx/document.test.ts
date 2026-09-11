import { describe, expect, it } from "vitest";
import { buildEscrituraDocx } from "./document";
import { buildTemplateContentJson } from "@/lib/editor/content";
import { legacyTextToDocument } from "@/lib/editor/convert";
import type { TemplateDocument } from "@/lib/editor/types";
import { extractDocxText, readDocx } from "../../../../test/support/docx";

describe("buildEscrituraDocx", () => {
  it("generates a docx from a legacy text-only template", async () => {
    const result = await buildEscrituraDocx({
      document: legacyTextToDocument("Poder de {{poderdante.nombre}} en {{lugar}}."),
      fieldValues: { "poderdante.nombre": "Ana Tester" },
      title: "Poder Especial",
    });

    const parts = await readDocx(result.buffer);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("Ana Tester");
    // Variable sin valor permanece visible.
    expect(body).toContain("{{lugar}}");
    expect(result.filename).toBe("Poder Especial.docx");
    expect(result.pendingVariables).toEqual(["lugar"]);
  });

  it("generates a docx from a structured content_json.doc", async () => {
    const doc = legacyTextToDocument("Comparece {{otorgante.nombre}}.");
    const contentJson = buildTemplateContentJson(doc);

    const result = await buildEscrituraDocx({
      document: contentJson.doc,
      fieldValues: { "otorgante.nombre": "Otorgante Estructurado" },
      title: "Escritura Estructurada",
    });

    const parts = await readDocx(result.buffer);
    expect(extractDocxText(parts.documentXml)).toContain(
      "Otorgante Estructurado",
    );
    expect(result.pendingVariables).toEqual([]);
  });

  it("preserves historical values not present in the template", async () => {
    // El machote ya no usa {{dato.dos}}, pero su valor histórico persiste en
    // field_values y no debe romper la generación.
    const result = await buildEscrituraDocx({
      document: legacyTextToDocument("Acta con {{dato.uno}}."),
      fieldValues: { "dato.uno": "Uno", "dato.dos": "Dos histórico" },
      title: "Acta",
    });

    const parts = await readDocx(result.buffer);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("Uno");
    expect(body).not.toContain("Dos histórico");
  });

  it("uses the document snapshot even after the source template changed", async () => {
    const result = await buildEscrituraDocx({
      document: legacyTextToDocument("Texto guardado con {{nombre}}."),
      fieldValues: { nombre: "Ana Tester" },
      title: "Snapshot estable",
    });

    const parts = await readDocx(result.buffer);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("Texto guardado con Ana Tester.");
    expect(body).not.toContain("Texto NUEVO con Ana Tester.");
    expect(result.pendingVariables).toEqual([]);
  });

  it("applies the configured output transform, matching the render pipeline", async () => {
    const result = await buildEscrituraDocx({
      document: legacyTextToDocument("Cédula {{comprador.cedula}}."),
      fieldValues: { "comprador.cedula": "208390123" },
      title: "Compraventa",
      transforms: { "comprador.cedula": "digits_to_words" },
    });

    const parts = await readDocx(result.buffer);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain(
      "DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES",
    );
    expect(body).not.toContain("208390123");
  });

  it("renders an optionBlock's selected variant in the docx", async () => {
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

    const defaultResult = await buildEscrituraDocx({
      document: doc,
      fieldValues: { "vehiculo.numero": "999" },
      title: "Compraventa",
    });
    const defaultBody = extractDocxText(
      (await readDocx(defaultResult.buffer)).documentXml,
    );
    expect(defaultBody).toContain("Comparecen con número 999.");

    const selectedResult = await buildEscrituraDocx({
      document: doc,
      fieldValues: { "vehiculo.chasis": "ABC123" },
      title: "Compraventa",
      optionSelections: { b1: "distintos" },
    });
    const selectedBody = extractDocxText(
      (await readDocx(selectedResult.buffer)).documentXml,
    );
    expect(selectedBody).toContain("Comparecen con CHASIS ABC123.");
  });

  it("uses the safe filename fallback for an empty title", async () => {
    const result = await buildEscrituraDocx({
      document: legacyTextToDocument("Texto."),
      fieldValues: {},
      title: "   ",
    });
    expect(result.filename).toBe("Escritura.docx");
  });
});
