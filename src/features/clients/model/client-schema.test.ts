import { describe, it, expect } from "vitest";
import {
  ClientSchema,
  MARITAL_STATUS_OPTIONS,
  MARITAL_STATUS_VALUES,
  normalizeClientIdentification,
  normalizeLegalEntityIdentification,
  resolveMaritalStatusSelection,
} from "./client-schema";

describe("normalizeClientIdentification", () => {
  it("strips dashes", () => {
    expect(normalizeClientIdentification("2-0839-0123")).toBe("208390123");
  });

  it("strips spaces", () => {
    expect(normalizeClientIdentification("2 0839 0123")).toBe("208390123");
  });

  it("strips both dashes and spaces", () => {
    expect(normalizeClientIdentification("2-0839 0123")).toBe("208390123");
  });

  it("leaves an already-normalized value unchanged", () => {
    expect(normalizeClientIdentification("208390123")).toBe("208390123");
  });
});

const valid = {
  full_name: "Test Client One",
  identification_type: "cedula_fisica" as const,
  identification_number: "000000000",
  marital_status: "Soltero/a",
  nationality: "costarricense",
  occupation: "ingeniero",
  exact_address: "Dirección de prueba 123",
};

describe("ClientSchema", () => {
  it("accepts a valid persona física client", () => {
    expect(ClientSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty full_name", () => {
    const result = ClientSchema.safeParse({ ...valid, full_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only full_name", () => {
    const result = ClientSchema.safeParse({ ...valid, full_name: "   " });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from full_name before checking length", () => {
    const result = ClientSchema.safeParse({ ...valid, full_name: "  A  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBe("A");
  });

  it("rejects an identification_type other than cedula_fisica/cedula_juridica", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_type: "pasaporte",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty identification_number", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only identification_number", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("strips dashes from identification_number", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "2-0839-0123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("208390123");
    }
  });

  it("strips internal spaces from identification_number", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "2 0839 0123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("208390123");
    }
  });

  it("rejects an identification_number that is only dashes and spaces", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "- - -",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty marital_status", () => {
    const result = ClientSchema.safeParse({ ...valid, marital_status: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only marital_status", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      marital_status: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty nationality", () => {
    const result = ClientSchema.safeParse({ ...valid, nationality: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty occupation", () => {
    const result = ClientSchema.safeParse({ ...valid, occupation: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty exact_address", () => {
    const result = ClientSchema.safeParse({ ...valid, exact_address: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only exact_address", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      exact_address: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from all string fields", () => {
    const result = ClientSchema.safeParse({
      full_name: "  Test Client One  ",
      identification_type: "cedula_fisica",
      identification_number: "  000000000  ",
      marital_status: "  Casado/a dos veces  ",
      nationality: "  costarricense  ",
      occupation: "  ingeniero  ",
      exact_address: "  Dirección de prueba 123  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Test Client One");
      expect(result.data.identification_number).toBe("000000000");
      expect(result.data.marital_status).toBe("Casado/a dos veces");
    }
  });

  it.each(MARITAL_STATUS_VALUES)("accepts marital_status %s", (value) => {
    const result = ClientSchema.safeParse({ ...valid, marital_status: value });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.marital_status).toBe(value);
  });

  it("offers exactly the 9 canonical marital status options in order", () => {
    expect(MARITAL_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "Soltero/a",
      "Casado/a",
      "Casado/a dos veces",
      "Casado/a tres veces",
      "Divorciado/a",
      "Divorciado/a dos veces",
      "Divorciado/a tres veces",
      "Viudo/a",
      "Libre",
    ]);
  });

  it.each([
    "soltero",
    "Soltera",
    "Casado",
    "Casada dos veces",
    "union_libre",
    "Unión libre",
    "Casado/a cuatro veces",
  ])("rejects non-canonical marital_status %s on save", (value) => {
    const result = ClientSchema.safeParse({ ...valid, marital_status: value });
    expect(result.success).toBe(false);
  });

  it.each([
    ["soltero", "Soltero/a"],
    ["Soltera", "Soltero/a"],
    ["Soltero/a", "Soltero/a"],
    ["casado", "Casado/a"],
    ["Casada", "Casado/a"],
    ["Casado/a", "Casado/a"],
    ["Casada dos veces", "Casado/a dos veces"],
    ["divorciado", "Divorciado/a"],
    ["Divorciada", "Divorciado/a"],
    ["Divorciada tres veces", "Divorciado/a tres veces"],
    ["viudo", "Viudo/a"],
    ["viuda", "Viudo/a"],
    ["union_libre", "Libre"],
    ["Unión libre", "Libre"],
    ["Libre", "Libre"],
  ])("normalizes legacy %s → %s for preselection", (stored, expected) => {
    expect(resolveMaritalStatusSelection(stored)).toBe(expected);
  });

  it("leaves unknown or empty legacy values unselected", () => {
    expect(resolveMaritalStatusSelection("single")).toBe("");
    expect(resolveMaritalStatusSelection("Viudo dos veces")).toBe("");
    expect(resolveMaritalStatusSelection(null)).toBe("");
  });

  it("maps every canonical value to itself", () => {
    for (const v of MARITAL_STATUS_VALUES) {
      expect(resolveMaritalStatusSelection(v)).toBe(v);
    }
  });

  it("rejects when a required field is missing", () => {
    const result = ClientSchema.safeParse({
      full_name: "Test Client One",
      identification_type: "cedula_fisica" as const,
      identification_number: "000000000",
      marital_status: "Soltero/a",
      nationality: "costarricense",
      // occupation intentionally omitted
      exact_address: "Dirección de prueba 123",
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeLegalEntityIdentification", () => {
  it("keeps the hyphens of a cédula jurídica exactly as typed", () => {
    expect(normalizeLegalEntityIdentification("3-101-123456")).toBe(
      "3-101-123456",
    );
  });

  it("only trims and removes spaces around hyphens", () => {
    expect(normalizeLegalEntityIdentification("  3 - 101 -123456 ")).toBe(
      "3-101-123456",
    );
  });

  it("leaves a value typed without hyphens unchanged", () => {
    expect(normalizeLegalEntityIdentification("3101123456")).toBe("3101123456");
  });
});

const validLegalEntity = {
  full_name: "Inversiones Ejemplo Sociedad Anónima",
  identification_type: "cedula_juridica" as const,
  identification_number: "3-101-123456",
  exact_address: "San José, Escazú, oficentro de prueba",
};

describe("ClientSchema — persona jurídica (cedula_juridica)", () => {
  it("accepts a sociedad without marital status, nationality or occupation", () => {
    const result = ClientSchema.safeParse(validLegalEntity);
    expect(result.success).toBe(true);
  });

  it("preserves the hyphens of the cédula jurídica", () => {
    const result = ClientSchema.safeParse(validLegalEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("3-101-123456");
    }
  });

  it("does not apply the cédula física normalization", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_number: " 3 - 101 - 123456 ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("3-101-123456");
    }
  });

  it("accepts a legacy value written without hyphens as-is", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_number: "3101123456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("3101123456");
    }
  });

  it.each([
    "",
    "   ",
    "-",
    "3-101-",
    "-3-101-123456",
    "3--101-123456",
    "3-101-12345A",
    "3.101.123456",
    "3/101/123456",
    "3 101 123456",
    "3-101-123456; drop",
  ])("rejects the invalid cédula jurídica %j", (value) => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_number: value,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an overly long cédula jurídica", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_number: "1".repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it("stores personal fields as null, discarding any submitted value", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      marital_status: "Casado/a",
      nationality: "costarricense",
      occupation: "abogado",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.marital_status).toBeNull();
      expect(result.data.nationality).toBeNull();
      expect(result.data.occupation).toBeNull();
    }
  });

  it("still requires razón social and domicilio", () => {
    expect(
      ClientSchema.safeParse({ ...validLegalEntity, full_name: " " }).success,
    ).toBe(false);
    expect(
      ClientSchema.safeParse({ ...validLegalEntity, exact_address: "" }).success,
    ).toBe(false);
  });

  it("reports the identification error on identification_number", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_number: "3-101-ABC",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.identification_number?.[0]).toMatch(
        /guiones/,
      );
    }
  });

  it("reports an unknown identification type on identification_type", () => {
    const result = ClientSchema.safeParse({
      ...validLegalEntity,
      identification_type: "pasaporte",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.identification_type?.[0]).toBe(
        "El tipo de identificación no es válido",
      );
    }
  });

  it("keeps normalizing cédula física (no regression)", () => {
    const result = ClientSchema.safeParse({
      ...valid,
      identification_number: "2-0839-0123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identification_number).toBe("208390123");
    }
  });
});
