import { describe, expect, it } from "vitest";
import {
  formatMoney,
  isReceivableStatus,
  receivableStatusLabel,
} from "./status";

describe("receivable status", () => {
  it("labels known statuses and falls back", () => {
    expect(receivableStatusLabel("pending")).toBe("Pendiente");
    expect(receivableStatusLabel("partial")).toBe("Parcial");
    expect(receivableStatusLabel("paid")).toBe("Pagada");
    expect(receivableStatusLabel("overdue")).toBe("Vencida");
    expect(receivableStatusLabel("weird")).toBe("weird");
  });

  it("recognizes valid statuses", () => {
    expect(isReceivableStatus("overdue")).toBe(true);
    expect(isReceivableStatus("cancelled")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats CRC and USD with the Costa Rican convention", () => {
    expect(formatMoney("1000", "CRC")).toBe("₡1.000,00 CRC");
    expect(formatMoney("1234.5", "USD")).toBe("$1.234,50 USD");
    expect(formatMoney("1234567.89", "CRC")).toBe("₡1.234.567,89 CRC");
  });

  it("handles numeric input", () => {
    expect(formatMoney(50, "CRC")).toBe("₡50,00 CRC");
  });
});
