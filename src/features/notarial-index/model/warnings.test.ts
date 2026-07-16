import { describe, expect, it } from "vitest";
import { notarialIndexWarnings } from "./warnings";
import type { NotarialIndexRow } from "./notarial-index-row";

const complete: NotarialIndexRow = {
  document_id: "10000000-0000-0000-0000-000000000001",
  title: "Escritura fake",
  client_name: null,
  instrument_number: 1,
  authorized_at: "2026-07-01T16:00:00.000Z",
  protocol_book: "01",
  initial_folio: "01F",
  final_folio: "01V",
  act_name: "COMPRAVENTA",
  parties: "PERSONA FAKE",
  period_year: 2026,
  period_month: 7,
  period_half: "FIRST_HALF",
  version: 1,
  has_metadata: true,
  is_complete: true,
};

describe("notarial index warnings", () => {
  it("counts incomplete rows and groups missing fields", () => {
    const result = notarialIndexWarnings([
      complete,
      {
        ...complete,
        document_id: "10000000-0000-0000-0000-000000000002",
        final_folio: null,
        parties: null,
        is_complete: false,
      },
    ]);
    expect(result.incompleteCount).toBe(1);
    expect(result.missingFields).toEqual(["Folio final", "Partes"]);
  });
});
