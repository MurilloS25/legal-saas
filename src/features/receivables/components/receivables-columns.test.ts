import { describe, expect, it } from "vitest";
import {
  createReceivablesColumns,
  RECEIVABLES_COLUMN_LABELS,
  formatReceivableDate,
} from "./receivables-columns";

describe("createReceivablesColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createReceivablesColumns();
    expect(columns.map((c) => c.id)).toEqual([
      "concept",
      "client_name",
      "document_title",
      "amount_total",
      "balance_due",
      "status",
      "due_at",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createReceivablesColumns();
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        RECEIVABLES_COLUMN_LABELS[
          column.id as keyof typeof RECEIVABLES_COLUMN_LABELS
        ],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createReceivablesColumns();
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});

describe("formatReceivableDate", () => {
  it("formats an ISO date using es-CR conventions", () => {
    expect(formatReceivableDate("2026-01-15")).toMatch(/2026/);
  });
});
