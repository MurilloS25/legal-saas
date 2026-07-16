import { describe, expect, it } from "vitest";
import {
  createTemplatesColumns,
  TEMPLATES_COLUMN_LABELS,
  formatTemplateDate,
} from "./templates-columns";

describe("createTemplatesColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createTemplatesColumns();
    expect(columns.map((c) => c.id)).toEqual([
      "name",
      "status",
      "updated_at",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createTemplatesColumns();
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        TEMPLATES_COLUMN_LABELS[column.id as keyof typeof TEMPLATES_COLUMN_LABELS],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createTemplatesColumns();
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});

describe("formatTemplateDate", () => {
  it("formats an ISO date using es-CR conventions", () => {
    expect(formatTemplateDate("2026-01-15T00:00:00.000Z")).toMatch(/2026/);
  });
});
