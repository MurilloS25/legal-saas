import { describe, it, expect } from "vitest";
import { TemplateFieldSchema } from "./template-fields";

const valid = {
  field_key: "buyer_1.full_name",
  label: "Comprador 1 - Nombre completo",
  required: true,
  sort_order: 0,
};

function omit(key: keyof typeof valid) {
  const copy: Partial<typeof valid> = { ...valid };
  delete copy[key];
  return copy;
}

describe("TemplateFieldSchema", () => {
  it("accepts a valid field payload", () => {
    const result = TemplateFieldSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts a single-segment field_key without dots", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, field_key: "price" });
    expect(result.success).toBe(true);
  });

  it("accepts field_key with numbers and underscores", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "seller_2.identification_number",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a payload without field_type — all fields are text now", () => {
    const result = TemplateFieldSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("ignores a legacy field_type sent by an old form", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_type: "number",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("field_type");
    }
  });

  it("accepts required true and false", () => {
    expect(TemplateFieldSchema.safeParse({ ...valid, required: true }).success).toBe(true);
    expect(TemplateFieldSchema.safeParse({ ...valid, required: false }).success).toBe(true);
  });

  it("accepts a positive sort_order", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, sort_order: 7 });
    expect(result.success).toBe(true);
  });

  it("rejects an empty field_key", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, field_key: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only field_key", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, field_key: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key with inner spaces", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "buyer 1.full_name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key with uppercase letters", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "Buyer_1.full_name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key with invalid characters", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "buyer-1.full-name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key wrapped in handlebars braces", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "{{buyer_1.full_name}}",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key with double dots", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "buyer_1..full_name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key starting with a dot", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: ".buyer_1.full_name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field_key ending with a dot", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "buyer_1.full_name.",
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from field_key before validating", () => {
    const result = TemplateFieldSchema.safeParse({
      ...valid,
      field_key: "  buyer_1.full_name  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.field_key).toBe("buyer_1.full_name");
  });

  it("rejects an empty label", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only label", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, label: "   " });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from label", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, label: "  Precio  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("Precio");
  });

  it("rejects a non-boolean required", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, required: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative sort_order", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, sort_order: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer sort_order", () => {
    const result = TemplateFieldSchema.safeParse({ ...valid, sort_order: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects when field_key is missing", () => {
    expect(TemplateFieldSchema.safeParse(omit("field_key")).success).toBe(false);
  });

  it("rejects when label is missing", () => {
    expect(TemplateFieldSchema.safeParse(omit("label")).success).toBe(false);
  });
});
