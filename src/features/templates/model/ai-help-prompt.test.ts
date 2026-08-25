import { describe, expect, it } from "vitest";
import { MACHOTE_AI_HELP_PROMPT } from "./ai-help-prompt";
import { FIELD_KEY_PATTERN, PLACEHOLDER_PATTERN } from "@/lib/editor/variable-key";

describe("MACHOTE_AI_HELP_PROMPT", () => {
  it("teaches the real placeholder syntax the editor parses", () => {
    const matches = [...MACHOTE_AI_HELP_PROMPT.matchAll(PLACEHOLDER_PATTERN)];
    const exampleKeys = matches
      .map((match) => match[1]?.trim())
      .filter((key): key is string => !!key && key !== "nombre_variable");

    expect(exampleKeys.length).toBeGreaterThan(0);
    for (const key of exampleKeys) {
      expect(FIELD_KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it("includes the rol.dato grouping convention with a real example", () => {
    expect(MACHOTE_AI_HELP_PROMPT).toContain("{{comprador.nombre}}");
    expect(MACHOTE_AI_HELP_PROMPT).toContain("{{vendedor.nombre}}");
  });

  it("documents the actual key charset (lowercase, digits, _ and .)", () => {
    expect(MACHOTE_AI_HELP_PROMPT).toMatch(/minúsculas/);
    expect(MACHOTE_AI_HELP_PROMPT).toContain('"_"');
    expect(MACHOTE_AI_HELP_PROMPT).toContain('"."');
  });

  it("tells the model to reuse the exact same key for repeated data", () => {
    expect(MACHOTE_AI_HELP_PROMPT).toMatch(/misma clave/);
  });

  it("never mentions sending the document to LexCR or any automated integration", () => {
    expect(MACHOTE_AI_HELP_PROMPT.toLowerCase()).not.toContain("api");
    expect(MACHOTE_AI_HELP_PROMPT.toLowerCase()).not.toContain("lexcr enviará");
  });

  it("instructs the model to return only the pasteable document, with no trailing variable list or commentary", () => {
    expect(MACHOTE_AI_HELP_PROMPT).toMatch(/ÚNICAMENTE el texto final del machote/);
    expect(MACHOTE_AI_HELP_PROMPT.toLowerCase()).not.toContain(
      "lista de las variables utilizadas y explica",
    );
    expect(MACHOTE_AI_HELP_PROMPT).toMatch(
      /No agregues explicaciones, comentarios, resumen, lista de variables/,
    );
  });

  it("teaches the [[OPCIÓN MÚLTIPLE: ...]] marker for content the editor can't parse from pasted text", () => {
    expect(MACHOTE_AI_HELP_PROMPT).toContain("[[OPCIÓN MÚLTIPLE:");
    expect(MACHOTE_AI_HELP_PROMPT).toMatch(/opciones sugeridas/);
    // El marcador nunca debe parecer una variable real ({{...}}).
    expect(MACHOTE_AI_HELP_PROMPT).not.toMatch(/\{\{OPCIÓN/i);
  });

  it("is organized into short labeled sections instead of one long block", () => {
    for (const heading of [
      "OBJETIVO",
      "SINTAXIS DE VARIABLES",
      "OPCIONES MÚLTIPLES",
      "FORMATO DE RESPUESTA",
    ]) {
      expect(MACHOTE_AI_HELP_PROMPT).toContain(heading);
    }
  });
});
