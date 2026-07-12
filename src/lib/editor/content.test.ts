import { describe, expect, it } from "vitest";
import { buildTemplateContentJson, resolveTemplateContent } from "./content";
import { legacyTextToDocument } from "./convert";

describe("resolveTemplateContent", () => {
  it("converts a legacy content_json with text only", () => {
    const resolved = resolveTemplateContent({
      text: "Hola {{nombre}}",
    });
    expect(resolved.structured).toBe(false);
    expect(resolved.templateText).toBe("Hola {{nombre}}");
    expect(resolved.document.content[0].content).toEqual([
      { type: "text", text: "Hola " },
      { type: "templateVariable", attrs: { key: "nombre" } },
    ]);
  });

  it("uses the structured doc when present and valid", () => {
    const document = legacyTextToDocument("Texto {{v}}");
    const resolved = resolveTemplateContent({
      text: "Texto {{v}}",
      doc: document,
    });
    expect(resolved.structured).toBe(true);
    expect(resolved.document).toEqual(document);
    expect(resolved.templateText).toBe("Texto {{v}}");
  });

  it("falls back to the compatibility text when the doc is invalid", () => {
    const resolved = resolveTemplateContent({
      text: "Respaldo {{v}}",
      doc: { type: "doc", content: [{ type: "iframe" }] },
    });
    expect(resolved.structured).toBe(false);
    expect(resolved.templateText).toBe("Respaldo {{v}}");
  });

  it("handles empty, null and malformed content_json", () => {
    for (const contentJson of [{}, null, undefined, "texto", 42, []]) {
      const resolved = resolveTemplateContent(contentJson);
      expect(resolved.structured).toBe(false);
      expect(resolved.templateText).toBe("");
      expect(resolved.document).toEqual({
        type: "doc",
        content: [{ type: "paragraph" }],
      });
    }
  });
});

describe("buildTemplateContentJson", () => {
  it("keeps the compatibility text in sync with the document", () => {
    const document = legacyTextToDocument("Comparece {{comprador.nombre}}.");
    expect(buildTemplateContentJson(document)).toEqual({
      text: "Comparece {{comprador.nombre}}.",
      doc: document,
    });
  });
});
