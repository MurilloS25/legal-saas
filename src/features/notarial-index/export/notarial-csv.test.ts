import { describe, expect, it } from "vitest";
import {
  NOTARIAL_CSV_HEADERS,
  buildNotarialCsv,
  notarialExportFilename,
  notarialRowToCsvCells,
  type NotarialExportRow,
} from "./notarial-csv";

const complete: NotarialExportRow = {
  title: "Escritura Uno",
  instrument_number: 125,
  authorized_at: "2026-07-15T16:35:00.000Z", // 10:35 CR
  act_name: "Compraventa",
  protocol_book: "Tomo 3",
  initial_folio: "12F",
  final_folio: "12V",
  parties: "Ana, Beto",
  has_metadata: true,
  is_complete: true,
};

describe("notarialRowToCsvCells", () => {
  it("maps a complete row to the expected columns", () => {
    const cells = notarialRowToCsvCells(complete);
    expect(cells[0]).toBe("125");
    expect(cells[1]).toMatch(/2026/);
    expect(cells[2]).toBe("10:35");
    expect(cells[3]).toBe("Compraventa");
    expect(cells[7]).toBe("Completo");
    expect(cells[8]).toBe("Escritura Uno");
    expect(cells).toHaveLength(NOTARIAL_CSV_HEADERS.length);
  });

  it("labels missing and incomplete rows", () => {
    expect(
      notarialRowToCsvCells({
        ...complete,
        has_metadata: false,
        is_complete: false,
      })[7],
    ).toBe("Sin datos");
    expect(
      notarialRowToCsvCells({ ...complete, is_complete: false })[7],
    ).toBe("Incompleto");
  });
});

describe("buildNotarialCsv", () => {
  it("includes the header, a BOM and neutralizes text injection", () => {
    const csv = buildNotarialCsv([
      { ...complete, parties: "=HYPERLINK(1)" },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Número,Fecha,Hora");
    // La celda con '=' se neutraliza con apóstrofo.
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});

describe("notarialExportFilename", () => {
  it("uses the date range when present", () => {
    expect(notarialExportFilename("2026-07-01", "2026-07-31")).toBe(
      "indice-notarial-2026-07-01-a-2026-07-31.csv",
    );
  });

  it("falls back safely and ignores malformed dates", () => {
    expect(notarialExportFilename(null, null)).toBe("indice-notarial.csv");
    expect(notarialExportFilename("../etc", "x")).toBe("indice-notarial.csv");
    expect(notarialExportFilename("2026-07-01", null)).toBe(
      "indice-notarial-desde-2026-07-01.csv",
    );
  });
});
