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
});
