import { describe, it, expect } from "vitest";
import { extractTemplateVariables } from "./variables";

describe("extractTemplateVariables", () => {
  it("extracts a single variable", () => {
    expect(
      extractTemplateVariables("El comprador es {{buyer_1.full_name}}."),
    ).toEqual(["buyer_1.full_name"]);
  });

  it("extracts multiple variables in order of appearance", () => {
    expect(
      extractTemplateVariables(
        "Comprador: {{buyer_1.full_name}}, cédula {{buyer_1.identification_number}}, placa {{vehicle.plate}}.",
      ),
    ).toEqual([
      "buyer_1.full_name",
      "buyer_1.identification_number",
      "vehicle.plate",
    ]);
  });

  it("removes duplicate variables", () => {
    expect(
      extractTemplateVariables(
        "{{buyer_1.full_name}} y de nuevo {{buyer_1.full_name}}",
      ),
    ).toEqual(["buyer_1.full_name"]);
  });

  it("supports surrounding spaces inside braces", () => {
    expect(extractTemplateVariables("Hola {{ buyer_1.full_name }}")).toEqual([
      "buyer_1.full_name",
    ]);
  });

  it("returns an empty array for plain text without variables", () => {
    expect(
      extractTemplateVariables("CONTRATO DE COMPRAVENTA sin variables."),
    ).toEqual([]);
  });

  it("returns an empty array for empty content", () => {
    expect(extractTemplateVariables("")).toEqual([]);
  });

  it("ignores placeholders with inner spaces in the key", () => {
    expect(extractTemplateVariables("{{buyer 1.full name}}")).toEqual([]);
  });

  it("ignores placeholders with double dots", () => {
    expect(extractTemplateVariables("{{buyer_1..full_name}}")).toEqual([]);
  });

  it("ignores placeholders starting with a dot", () => {
    expect(extractTemplateVariables("{{.buyer_1.full_name}}")).toEqual([]);
  });

  it("ignores placeholders ending with a dot", () => {
    expect(extractTemplateVariables("{{buyer_1.full_name.}}")).toEqual([]);
  });

  it("ignores placeholders with uppercase letters", () => {
    expect(extractTemplateVariables("{{Buyer_1.full_name}}")).toEqual([]);
  });

  it("ignores empty placeholders", () => {
    expect(extractTemplateVariables("{{}} y {{   }}")).toEqual([]);
  });

  it("still extracts valid variables next to invalid ones", () => {
    expect(
      extractTemplateVariables("{{buyer 1}} {{buyer_1.full_name}} {{..x}}"),
    ).toEqual(["buyer_1.full_name"]);
  });
});
