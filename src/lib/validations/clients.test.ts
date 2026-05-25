import { describe, it, expect } from "vitest";
import { ClientSchema } from "./clients";

const valid = {
  full_name: "Test Client One",
  identification_type: "cedula_fisica" as const,
  identification_number: "000000000",
  marital_status: "soltero",
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
      marital_status: "  soltero  ",
      nationality: "  costarricense  ",
      occupation: "  ingeniero  ",
      exact_address: "  Dirección de prueba 123  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Test Client One");
      expect(result.data.identification_number).toBe("000000000");
    }
  });

  it("rejects when a required field is missing", () => {
    const result = ClientSchema.safeParse({
      full_name: "Test Client One",
      identification_type: "cedula_fisica" as const,
      identification_number: "000000000",
      marital_status: "soltero",
      nationality: "costarricense",
      // occupation intentionally omitted
      exact_address: "Dirección de prueba 123",
    });
    expect(result.success).toBe(false);
  });
});
