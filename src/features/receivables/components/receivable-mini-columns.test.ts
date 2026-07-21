import { describe, expect, it } from "vitest";
import {
  createReceivableMiniColumns,
  RECEIVABLE_MINI_COLUMN_LABELS,
} from "./receivable-mini-columns";

describe("createReceivableMiniColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createReceivableMiniColumns();
    expect(columns.map((c) => c.id)).toEqual([
      "concept",
      "amount_total",
      "balance_due",
      "status",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createReceivableMiniColumns();
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        RECEIVABLE_MINI_COLUMN_LABELS[
          column.id as keyof typeof RECEIVABLE_MINI_COLUMN_LABELS
        ],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createReceivableMiniColumns();
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});
