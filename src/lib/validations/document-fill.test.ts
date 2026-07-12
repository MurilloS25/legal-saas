import { describe, it, expect } from "vitest";
import { validateDocumentFill, type FillableField } from "./document-fill";

const fields: FillableField[] = [
  {
    field_key: "buyer_1.full_name",
    label: "Comprador 1 - Nombre completo",
    field_type: "text",
    required: true,
  },
  {
    field_key: "sale.notes",
    label: "Notas de la venta",
    field_type: "textarea",
    required: false,
  },
  {
    field_key: "sale.price",
    label: "Precio",
    field_type: "number",
    required: true,
  },
  {
    field_key: "sale.date",
    label: "Fecha de venta",
    field_type: "date",
    required: false,
  },
];

const validValues = {
  "buyer_1.full_name": "Test Client One",
  "sale.notes": "",
  "sale.price": "1000000",
  "sale.date": "2026-05-20",
};

describe("validateDocumentFill", () => {
  it("accepts values with all required fields present", () => {
    const result = validateDocumentFill(fields, validValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values["buyer_1.full_name"]).toBe("Test Client One");
      expect(result.values["sale.price"]).toBe("1000000");
    }
  });

  it("rejects a missing required field", () => {
    const { "buyer_1.full_name": _omitted, ...rest } = validValues;
    void _omitted;
    const result = validateDocumentFill(fields, rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["buyer_1.full_name"]).toBeTruthy();
    }
  });

  it("rejects an empty required field", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "buyer_1.full_name": "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only required field", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "buyer_1.full_name": "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty optional fields", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "sale.notes": "",
      "sale.date": "",
    });
    expect(result.success).toBe(true);
  });

  it("drops keys that are not defined as fields", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "hacker.injected_key": "malicious",
      owner_id: "someone-else",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values).not.toHaveProperty("hacker.injected_key");
      expect(result.values).not.toHaveProperty("owner_id");
    }
  });

  it("trims values before validating and returning them", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "buyer_1.full_name": "  Test Client One  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values["buyer_1.full_name"]).toBe("Test Client One");
    }
  });

  it("accepts free text for a legacy number field — no numeric parsing", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "sale.price": "un millón de colones exactos",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values["sale.price"]).toBe("un millón de colones exactos");
    }
  });

  it("accepts free text for a legacy date field — no date parsing", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "sale.date": "veinte de mayo del año dos mil veintiséis",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values["sale.date"]).toBe(
        "veinte de mayo del año dos mil veintiséis",
      );
    }
  });

  it("preserves numeric-looking text exactly as written", () => {
    const result = validateDocumentFill(fields, {
      ...validValues,
      "sale.price": "1.000.000,50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values["sale.price"]).toBe("1.000.000,50");
    }
  });

  it("only reports errors for empty required fields", () => {
    const result = validateDocumentFill(fields, {
      "buyer_1.full_name": "",
      "sale.price": "abc",
      "sale.date": "not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors)).toEqual(["buyer_1.full_name"]);
    }
  });

  it("returns success with empty values when there are no fields", () => {
    const result = validateDocumentFill([], { anything: "x" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values).toEqual({});
    }
  });
});
