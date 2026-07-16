import { describe, expect, it } from "vitest";
import { createClientsColumns, CLIENTS_COLUMN_LABELS } from "./clients-columns";

describe("createClientsColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createClientsColumns();
    expect(columns.map((c) => c.id)).toEqual([
      "full_name",
      "identification_number",
      "occupation",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createClientsColumns();
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        CLIENTS_COLUMN_LABELS[column.id as keyof typeof CLIENTS_COLUMN_LABELS],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createClientsColumns();
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});
