import { describe, expect, it } from "vitest";
import { ReceivableSchema } from "./receivables";

const base = {
  client_id: "41111111-c000-0000-0000-000000000001",
  document_id: "",
  concept: "Honorarios",
  currency: "CRC",
  amount_total: "1500.50",
  issued_at: "2026-07-13",
  due_at: "",
  notes: "",
};

describe("ReceivableSchema", () => {
  it("accepts a valid receivable and normalizes optionals", () => {
    const result = ReceivableSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.document_id).toBeNull();
      expect(result.data.due_at).toBeNull();
      expect(result.data.notes).toBeNull();
      expect(result.data.amount_total).toBe("1500.50");
    }
  });

  it("normalizes a comma decimal separator", () => {
    const result = ReceivableSchema.safeParse({ ...base, amount_total: "1.234,56" });
    // "1.234,56" -> replace comma -> "1.234.56" -> invalid (two dots).
    expect(result.success).toBe(false);
    const ok = ReceivableSchema.safeParse({ ...base, amount_total: "1234,56" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.amount_total).toBe("1234.56");
  });

  it("rejects non-positive or over-precise amounts", () => {
    for (const amount of ["0", "-5", "1.234", "abc", ""]) {
      expect(ReceivableSchema.safeParse({ ...base, amount_total: amount }).success).toBe(
        false,
      );
    }
  });

  it("requires a client", () => {
    expect(ReceivableSchema.safeParse({ ...base, client_id: "" }).success).toBe(false);
    expect(
      ReceivableSchema.safeParse({ ...base, client_id: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("requires a concept and a valid currency", () => {
    expect(ReceivableSchema.safeParse({ ...base, concept: "  " }).success).toBe(false);
    expect(ReceivableSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = ReceivableSchema.safeParse({
      ...base,
      issued_at: "2026-07-13",
      due_at: "2026-07-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a due date equal to or after the issue date", () => {
    expect(
      ReceivableSchema.safeParse({ ...base, due_at: "2026-07-13" }).success,
    ).toBe(true);
    expect(
      ReceivableSchema.safeParse({ ...base, due_at: "2026-08-01" }).success,
    ).toBe(true);
  });
});
