import { describe, expect, it } from "vitest";
import {
  FIELD_KEY_PATTERN,
  VARIABLE_INPUT_RULE_PATTERN,
  VARIABLE_PASTE_RULE_PATTERN,
} from "./variable-key";

describe("VARIABLE_INPUT_RULE_PATTERN", () => {
  it("matches a simple placeholder right after the closing braces", () => {
    const match = "Hola {{comprador}}".match(VARIABLE_INPUT_RULE_PATTERN);
    expect(match?.[1]).toBe("comprador");
  });

  it("matches a dotted key", () => {
    const match = "{{comprador.nombre}}".match(VARIABLE_INPUT_RULE_PATTERN);
    expect(match?.[1]).toBe("comprador.nombre");
  });

  it("only matches when the placeholder is at the end of the string", () => {
    expect("{{comprador}} y algo más".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("does not match uppercase letters", () => {
    expect("{{Comprador}}".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("does not match spaces inside the key", () => {
    expect("{{clave con espacios}}".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("does not match empty braces", () => {
    expect("{{}}".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("does not match incomplete braces", () => {
    expect("{{comprador}".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
    expect("{comprador}}".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("does not match plain text without a placeholder", () => {
    expect("texto sin variables".match(VARIABLE_INPUT_RULE_PATTERN)).toBeNull();
  });

  it("matched keys always satisfy FIELD_KEY_PATTERN", () => {
    const match = "{{vehiculo.placa}}".match(VARIABLE_INPUT_RULE_PATTERN);
    expect(FIELD_KEY_PATTERN.test(match![1])).toBe(true);
  });
});

describe("VARIABLE_PASTE_RULE_PATTERN", () => {
  it("matches every valid placeholder in pasted content", () => {
    const text =
      "Comparecen {{comprador.nombre}} y {{vendedor.nombre}}, folio {{folio.inicio}}.";
    const matches = [...text.matchAll(VARIABLE_PASTE_RULE_PATTERN)].map(
      (m) => m[1],
    );
    expect(matches).toEqual([
      "comprador.nombre",
      "vendedor.nombre",
      "folio.inicio",
    ]);
  });

  it("matches a duplicated placeholder each time it appears", () => {
    const text = "{{a.b}} ... {{a.b}}";
    const matches = [...text.matchAll(VARIABLE_PASTE_RULE_PATTERN)].map(
      (m) => m[1],
    );
    expect(matches).toEqual(["a.b", "a.b"]);
  });

  it("skips invalid placeholders without matching partial content", () => {
    const text = "{{Clave Invalida}} pero {{clave.valida}} sí";
    const matches = [...text.matchAll(VARIABLE_PASTE_RULE_PATTERN)].map(
      (m) => m[1],
    );
    expect(matches).toEqual(["clave.valida"]);
  });

  it("returns no matches for plain text", () => {
    expect([...("sin variables aquí").matchAll(VARIABLE_PASTE_RULE_PATTERN)]).toEqual(
      [],
    );
  });

  it("returns no matches for incomplete braces", () => {
    expect([...("{{comprador} y {vendedor}}").matchAll(VARIABLE_PASTE_RULE_PATTERN)]).toEqual(
      [],
    );
  });
});
