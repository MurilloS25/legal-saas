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
      "act_type",
      "appearing_parties_summary",
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
      "Completitud",
      "Acciones",
    ]);
  });

  it("preserves the current visual columns and allows optional context", () => {
    expect(DEFAULT_NOTARIAL_COLUMN_VISIBILITY).toEqual({
      client_name: false,
      title: false,
    });
  });

  it("allows only the server-whitelisted date order", () => {
    expect(NOTARIAL_SORTABLE_COLUMN_IDS).toEqual(["authorized_at"]);
    expect(notarialTableState("recent", 3)).toEqual({
      pagination: { pageIndex: 2, pageSize: 15 },
      sorting: [{ id: "authorized_at", desc: true }],
    });
    expect(notarialTableState("oldest", 1).sorting).toEqual([
      { id: "authorized_at", desc: false },
    ]);
  });

  it("keeps filtering, pagination, and sorting on the server", () => {
    expect(NOTARIAL_MANUAL_TABLE_OPTIONS).toEqual({
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
    });
  });
});
