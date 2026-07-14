import { describe, expect, it } from "vitest";
import {
  RegisterPaymentSchema,
  VoidPaymentSchema,
} from "./receivable-payments";

const base = {
  amount: "50000.00",
  paid_at: "2026-07-13",
  method: "cash",
  reference: "",
};

describe("RegisterPaymentSchema", () => {
  it("accepts a valid payment and normalizes optionals", () => {
    const result = RegisterPaymentSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference).toBeNull();
      expect(result.data.amount).toBe("50000.00");
    }
  });

  it("allows an empty date (defaults server-side)", () => {
    const result = RegisterPaymentSchema.safeParse({ ...base, paid_at: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paid_at).toBeNull();
  });

  it("rejects non-positive or over-precise amounts", () => {
    for (const amount of ["0", "-1", "10.999", "abc", ""]) {
      expect(
        RegisterPaymentSchema.safeParse({ ...base, amount }).success,
      ).toBe(false);
    }
  });

  it("rejects an unknown method", () => {
    expect(
      RegisterPaymentSchema.safeParse({ ...base, method: "crypto" }).success,
    ).toBe(false);
  });
});

describe("VoidPaymentSchema", () => {
  it("requires a non-blank reason", () => {
    expect(VoidPaymentSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(VoidPaymentSchema.safeParse({ reason: "duplicado" }).success).toBe(
      true,
    );
  });
});
