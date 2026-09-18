import { describe, it, expect } from "vitest";
import {
  ClientSchema,
  MARITAL_STATUS_OPTIONS,
  MARITAL_STATUS_VALUES,
  normalizeClientIdentification,
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
  marital_status: "Soltero",
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

  it("rejects an identification_type other than cedula_fisica", () => {
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
      marital_status: "  Casada dos veces  ",
      nationality: "  costarricense  ",
      occupation: "  ingeniero  ",
      exact_address: "  Dirección de prueba 123  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Test Client One");
      expect(result.data.identification_number).toBe("000000000");
      expect(result.data.marital_status).toBe("Casada dos veces");
    }
  });

  it.each(MARITAL_STATUS_VALUES)("accepts marital_status %s", (value) => {
    const result = ClientSchema.safeParse({ ...valid, marital_status: value });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.marital_status).toBe(value);
  });

  it("offers exactly the 17 explicit marital status options", () => {
    expect(MARITAL_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "Soltero", "Soltera", "Casado", "Casada", "Casado dos veces",
      "Casada dos veces", "Casado tres veces", "Casada tres veces",
      "Divorciado", "Divorciada", "Divorciado dos veces",
      "Divorciada dos veces", "Divorciado tres veces",
      "Divorciada tres veces", "Viudo", "Viuda", "Libre",
    ]);
  });

  it.each(["soltero", "Casado/a", "Unión libre", "Casado cuatro veces"])(
    "rejects legacy or unknown marital_status %s",
    (value) => {
      const result = ClientSchema.safeParse({ ...valid, marital_status: value });
      expect(result.success).toBe(false);
    },
  );

  it("preselects legacy values only when they match an explicit option", () => {
    expect(resolveMaritalStatusSelection("soltero")).toBe("Soltero");
    expect(resolveMaritalStatusSelection("casado")).toBe("Casado");
    expect(resolveMaritalStatusSelection("Casada dos veces")).toBe(
      "Casada dos veces",
    );
    expect(resolveMaritalStatusSelection("Casado/a")).toBe("");
    expect(resolveMaritalStatusSelection("union_libre")).toBe("");
    expect(resolveMaritalStatusSelection(null)).toBe("");
  });

  it("rejects when a required field is missing", () => {
    const result = ClientSchema.safeParse({
      full_name: "Test Client One",
      identification_type: "cedula_fisica" as const,
      identification_number: "000000000",
      marital_status: "Soltero",
      nationality: "costarricense",
      // occupation intentionally omitted
      exact_address: "Dirección de prueba 123",
    });
    expect(result.success).toBe(false);
  });
});
