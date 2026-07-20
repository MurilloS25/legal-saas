import { describe, expect, it } from "vitest";
import { buildEscrituraDocx } from "./document";
import { buildTemplateContentJson } from "@/lib/editor/content";
import { legacyTextToDocument } from "@/lib/editor/convert";
import { extractDocxText, readDocx } from "../../../../test/support/docx";

describe("buildEscrituraDocx", () => {
  it("generates a docx from a legacy text-only template", async () => {
    const result = await buildEscrituraDocx({
      contentJson: { text: "Poder de {{poderdante.nombre}} en {{lugar}}." },
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
      contentJson,
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
      contentJson: { text: "Acta con {{dato.uno}}." },
      fieldValues: { "dato.uno": "Uno", "dato.dos": "Dos histórico" },
      title: "Acta",
    });

    const parts = await readDocx(result.buffer);
    const body = extractDocxText(parts.documentXml);
    expect(body).toContain("Uno");
    expect(body).not.toContain("Dos histórico");
  });

  it("uses the persisted rendered snapshot when the template changed after save", async () => {
    const result = await buildEscrituraDocx({
      contentJson: { text: "Texto NUEVO con {{nombre}}." },
      fieldValues: { nombre: "Ana Tester" },
      renderedContent: "Texto guardado con Ana Tester.",
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
      contentJson: { text: "Cédula {{comprador.cedula}}." },
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

  it("uses the safe filename fallback for an empty title", async () => {
    const result = await buildEscrituraDocx({
      contentJson: { text: "Texto." },
      fieldValues: {},
      title: "   ",
    });
    expect(result.filename).toBe("Escritura.docx");
  });
});
