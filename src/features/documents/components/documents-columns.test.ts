import { describe, expect, it } from "vitest";
import {
  createDocumentsColumns,
  DOCUMENTS_COLUMN_IDS,
  DOCUMENTS_COLUMN_LABELS,
  formatDocumentDate,
} from "./documents-columns";

describe("createDocumentsColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createDocumentsColumns(true);
    expect(columns.map((c) => c.id)).toEqual([...DOCUMENTS_COLUMN_IDS]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createDocumentsColumns(true);
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        DOCUMENTS_COLUMN_LABELS[column.id as keyof typeof DOCUMENTS_COLUMN_LABELS],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createDocumentsColumns(true);
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    // Header is a render function (accessible sr-only label), not plain text.
    expect(typeof actions?.header).toBe("function");
  });
});

describe("formatDocumentDate", () => {
  it("formats an ISO date using es-CR conventions", () => {
    expect(formatDocumentDate("2026-01-15T00:00:00.000Z")).toMatch(/2026/);
  });
});
