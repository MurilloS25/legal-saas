import { describe, expect, it } from "vitest";
import {
  createPaymentsColumns,
  PAYMENTS_COLUMN_LABELS,
  formatPaymentDate,
} from "./payments-columns";

describe("createPaymentsColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createPaymentsColumns("receivable-1", true);
    expect(columns.map((c) => c.id)).toEqual([
      "paid_at",
      "amount",
      "currency",
      "method",
      "reference",
      "status",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createPaymentsColumns("receivable-1", true);
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        PAYMENTS_COLUMN_LABELS[column.id as keyof typeof PAYMENTS_COLUMN_LABELS],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createPaymentsColumns("receivable-1", true);
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});

describe("formatPaymentDate", () => {
  it("formats an ISO date using es-CR conventions", () => {
    expect(formatPaymentDate("2026-01-15")).toMatch(/2026/);
  });
});
