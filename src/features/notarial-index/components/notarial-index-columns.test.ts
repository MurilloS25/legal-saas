import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTARIAL_COLUMN_VISIBILITY,
  NOTARIAL_COLUMN_IDS,
  NOTARIAL_COLUMN_LABELS,
  NOTARIAL_MANUAL_TABLE_OPTIONS,
  NOTARIAL_SORTABLE_COLUMN_IDS,
  notarialTableState,
} from "./notarial-index-columns";

describe("notarial index table contract", () => {
  it("defines the eight user-facing columns without private identifiers", () => {
    expect(NOTARIAL_COLUMN_IDS).toEqual([
      "instrument_number",
      "authorized_at",
      "act_name",
      "parties",
      "client_name",
      "title",
      "completeness",
      "actions",
    ]);
    expect(Object.values(NOTARIAL_COLUMN_LABELS)).toEqual([
      "Número",
      "Fecha y hora",
      "Tipo de acto",
      "Comparecientes",
      "Cliente",
      "Escritura",
      "Estado",
      "Acciones",
    ]);
  });

  it("preserves the current visual columns and allows optional context", () => {
    expect(DEFAULT_NOTARIAL_COLUMN_VISIBILITY).toEqual({
      client_name: false,
      title: false,
    });
  });

  it("uses the fixed instrument number order", () => {
    expect(NOTARIAL_SORTABLE_COLUMN_IDS).toEqual(["instrument_number"]);
    expect(notarialTableState(3, 10)).toEqual({
      pagination: { pageIndex: 2, pageSize: 10 },
      sorting: [{ id: "instrument_number", desc: false }],
    });
    expect(notarialTableState(1, 25)).toEqual({
      pagination: { pageIndex: 0, pageSize: 25 },
      sorting: [{ id: "instrument_number", desc: false }],
    });
  });

  it("keeps filtering, pagination, and sorting on the server", () => {
    expect(NOTARIAL_MANUAL_TABLE_OPTIONS).toEqual({
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
    });
  });
});
