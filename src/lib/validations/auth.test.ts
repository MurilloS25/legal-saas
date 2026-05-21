import { describe, it, expect } from "vitest";
import { LoginSchema, SignupSchema } from "./auth";

// ---------------------------------------------------------------------------
// LoginSchema
// ---------------------------------------------------------------------------

describe("LoginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = LoginSchema.safeParse({
      email: "abogado@ejemplo.com",
      password: "cualquierCosa1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "no-es-un-email",
      password: "cualquierCosa1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.email).toBeDefined();
    }
  });

  it("rejects an empty password", () => {
    const result = LoginSchema.safeParse({
      email: "abogado@ejemplo.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// SignupSchema — password policy
// ---------------------------------------------------------------------------

const VALID_PASSWORD = "MiClave!Segura9";
const VALID_EMAIL = "abogado@ejemplo.com";

describe("SignupSchema — password policy", () => {
  it("accepts a strong password with matching confirmation", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: "Corta!1",
      confirmPassword: "Corta!1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password?.some((m) => m.includes("12"))).toBe(true);
    }
  });

  it("rejects a password without a lowercase letter", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: "SOLOMAYUSCULAS12!",
      confirmPassword: "SOLOMAYUSCULAS12!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password?.some((m) => m.includes("minúscula"))).toBe(true);
    }
  });

  it("rejects a password without an uppercase letter", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: "solominusculas12!",
      confirmPassword: "solominusculas12!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password?.some((m) => m.includes("mayúscula"))).toBe(true);
    }
  });

  it("rejects a password without a number", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: "SinNumeroAqui!abc",
      confirmPassword: "SinNumeroAqui!abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password?.some((m) => m.includes("número"))).toBe(true);
    }
  });

  it("rejects a password without a symbol", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: "SinSimboloAqui123",
      confirmPassword: "SinSimboloAqui123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.password?.some((m) => m.includes("símbolo"))).toBe(true);
    }
  });

  it("rejects when confirmPassword does not match", () => {
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD + "X",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(
        errors.confirmPassword?.some((m) => m.includes("no coinciden")),
      ).toBe(true);
    }
  });

  it("accepts a password that meets all requirements with correct confirmation", () => {
    const strong = "Abogado@2025!Legal";
    const result = SignupSchema.safeParse({
      email: VALID_EMAIL,
      password: strong,
      confirmPassword: strong,
    });
    expect(result.success).toBe(true);
  });
});
