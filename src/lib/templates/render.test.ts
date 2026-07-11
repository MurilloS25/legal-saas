import { describe, it, expect } from "vitest";
import { renderTemplateContent, findUnresolvedVariables } from "./render";

const values = {
  "buyer_1.full_name": "Test Client One",
  "buyer_1.identification_number": "0-0000-0000",
};

describe("renderTemplateContent", () => {
  it("replaces a single variable", () => {
    expect(
      renderTemplateContent("El comprador es {{buyer_1.full_name}}.", values),
    ).toBe("El comprador es Test Client One.");
  });

  it("replaces multiple variables", () => {
    expect(
      renderTemplateContent(
        "El comprador es {{buyer_1.full_name}}, cédula {{buyer_1.identification_number}}.",
        values,
      ),
    ).toBe("El comprador es Test Client One, cédula 0-0000-0000.");
  });

  it("replaces repeated variables everywhere they appear", () => {
    expect(
      renderTemplateContent(
        "{{buyer_1.full_name}} declara. Firma: {{buyer_1.full_name}}",
        values,
      ),
    ).toBe("Test Client One declara. Firma: Test Client One");
  });

  it("supports spaces inside the braces", () => {
    expect(renderTemplateContent("Hola {{ buyer_1.full_name }}", values)).toBe(
      "Hola Test Client One",
    );
  });

  it("keeps the placeholder visible when the value is missing", () => {
    expect(
      renderTemplateContent("Placa: {{vehicle.plate}}", values),
    ).toBe("Placa: {{vehicle.plate}}");
  });

  it("keeps the placeholder visible when the value is empty", () => {
    expect(
      renderTemplateContent("Placa: {{vehicle.plate}}", {
        "vehicle.plate": "",
      }),
    ).toBe("Placa: {{vehicle.plate}}");
  });

  it("does not modify text without variables", () => {
    const content = "CONTRATO DE COMPRAVENTA sin variables.";
    expect(renderTemplateContent(content, values)).toBe(content);
  });

  it("leaves invalid placeholders untouched", () => {
    expect(
      renderTemplateContent("{{Buyer Name}} y {{buyer_1..x}}", values),
    ).toBe("{{Buyer Name}} y {{buyer_1..x}}");
  });

  it("treats values as plain text without interpreting HTML", () => {
    const result = renderTemplateContent("Nombre: {{buyer_1.full_name}}", {
      "buyer_1.full_name": "<script>alert('x')</script>",
    });
    expect(result).toBe("Nombre: <script>alert('x')</script>");
  });

  it("does not re-expand placeholders contained in values", () => {
    const result = renderTemplateContent(
      "A: {{a}} B: {{b}}",
      { a: "{{b}}", b: "value-b" },
    );
    expect(result).toBe("A: {{b}} B: value-b");
  });

  it("returns an empty string for empty content", () => {
    expect(renderTemplateContent("", values)).toBe("");
  });
});

describe("findUnresolvedVariables", () => {
  it("detects variables without a value", () => {
    expect(
      findUnresolvedVariables(
        "{{buyer_1.full_name}} placa {{vehicle.plate}}",
        values,
      ),
    ).toEqual(["vehicle.plate"]);
  });

  it("treats empty values as unresolved", () => {
    expect(
      findUnresolvedVariables("Placa: {{vehicle.plate}}", {
        "vehicle.plate": "   ",
      }),
    ).toEqual(["vehicle.plate"]);
  });

  it("returns empty when everything is resolved", () => {
    expect(
      findUnresolvedVariables("{{buyer_1.full_name}}", values),
    ).toEqual([]);
  });

  it("returns empty for content without variables", () => {
    expect(findUnresolvedVariables("Texto plano.", values)).toEqual([]);
  });

  it("does not report duplicated unresolved variables twice", () => {
    expect(
      findUnresolvedVariables("{{vehicle.plate}} y {{vehicle.plate}}", {}),
    ).toEqual(["vehicle.plate"]);
  });
});
