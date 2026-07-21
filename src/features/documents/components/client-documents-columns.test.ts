import { describe, expect, it } from "vitest";
import {
  createClientDocumentsColumns,
  CLIENT_DOCUMENTS_COLUMN_LABELS,
  formatClientDocumentDate,
} from "./client-documents-columns";

describe("createClientDocumentsColumns", () => {
  it("declares exactly the expected columns, in order", () => {
    const columns = createClientDocumentsColumns();
    expect(columns.map((c) => c.id)).toEqual([
      "title",
      "status",
      "updated_at",
      "actions",
    ]);
  });

  it("uses the same header label for every data column as the header/body model", () => {
    const columns = createClientDocumentsColumns();
    for (const column of columns) {
      if (column.id === "actions") continue;
      expect(column.header).toBe(
        CLIENT_DOCUMENTS_COLUMN_LABELS[
          column.id as keyof typeof CLIENT_DOCUMENTS_COLUMN_LABELS
        ],
      );
    }
  });

  it("declares an explicit, non-hideable actions column", () => {
    const columns = createClientDocumentsColumns();
    const actions = columns.find((c) => c.id === "actions");
    expect(actions).toBeDefined();
    expect(actions?.enableHiding).toBe(false);
    expect(typeof actions?.header).toBe("function");
  });
});

describe("formatClientDocumentDate", () => {
  it("formats an ISO date using es-CR conventions", () => {
    expect(formatClientDocumentDate("2026-01-15T00:00:00.000Z")).toMatch(/2026/);
  });
});
