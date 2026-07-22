import { describe, expect, it } from "vitest";
import { FIELD_KEY_PATTERN, VARIABLE_INPUT_RULE_PATTERN } from "./variable-key";

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
