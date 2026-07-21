import { describe, it, expect } from "vitest";
import { TemplateSchema } from "./templates";

const valid = {
  name: "Contrato de Arrendamiento Residencial",
  content: "CONTRATO DE ARRENDAMIENTO que celebran las partes...",
  status: "draft" as const,
};

describe("TemplateSchema", () => {
  it("accepts a valid template with required fields only", () => {
    expect(TemplateSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a valid template with an optional description", () => {
    const result = TemplateSchema.safeParse({
      ...valid,
      description: "Modelo estándar para alquiler de vivienda urbana",
    });
    expect(result.success).toBe(true);
  });

  it("accepts status active", () => {
    const result = TemplateSchema.safeParse({ ...valid, status: "active" });
    expect(result.success).toBe(true);
  });

  it("accepts status archived", () => {
    const result = TemplateSchema.safeParse({ ...valid, status: "archived" });
    expect(result.success).toBe(true);
  });

  it("allows description to be absent", () => {
    // valid intentionally omits description — it must be optional
    expect(TemplateSchema.safeParse(valid).success).toBe(true);
  });

  it("allows description to be an empty string", () => {
    const result = TemplateSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = TemplateSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = TemplateSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects an empty content", () => {
    const result = TemplateSchema.safeParse({ ...valid, content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only content", () => {
    const result = TemplateSchema.safeParse({ ...valid, content: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a status outside draft/active/archived", () => {
    const result = TemplateSchema.safeParse({ ...valid, status: "published" });
    expect(result.success).toBe(false);
  });

  it("rejects another invalid status", () => {
    const result = TemplateSchema.safeParse({ ...valid, status: "inactive" });
    expect(result.success).toBe(false);
  });

  it("rejects when name is missing", () => {
    expect(
      TemplateSchema.safeParse({ content: valid.content, status: valid.status }).success,
    ).toBe(false);
  });

  it("rejects when content is missing", () => {
    expect(
      TemplateSchema.safeParse({ name: valid.name, status: valid.status }).success,
    ).toBe(false);
  });

  it("rejects when status is missing", () => {
    expect(
      TemplateSchema.safeParse({ name: valid.name, content: valid.content }).success,
    ).toBe(false);
  });

  it("trims whitespace from name before checking length", () => {
    const result = TemplateSchema.safeParse({ ...valid, name: "  A  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("A");
  });

  it("trims whitespace from content before checking length", () => {
    const result = TemplateSchema.safeParse({
      ...valid,
      content: "  Contenido válido del machote  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.content).toBe("Contenido válido del machote");
  });
});
