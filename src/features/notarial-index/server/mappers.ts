import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { throwDataAccessError } from "@/lib/server/errors";
import type { NotarialIndexRow } from "../model/notarial-index-row";

export const NOTARIAL_INDEX_SELECT =
  "document_id, title, client_name, instrument_number, authorized_at, protocol_book, initial_folio, final_folio, act_name, parties, period_year, period_month, period_half, version, has_metadata, is_complete";

type ViewRow = Pick<
  Database["public"]["Views"]["notarial_index_entries"]["Row"],
  | "document_id"
  | "title"
  | "client_name"
  | "instrument_number"
  | "authorized_at"
  | "protocol_book"
  | "initial_folio"
  | "final_folio"
  | "act_name"
  | "parties"
  | "period_year"
  | "period_month"
  | "period_half"
  | "version"
  | "has_metadata"
  | "is_complete"
>;

export function mapNotarialIndexRows(rows: ViewRow[]): NotarialIndexRow[] {
  return rows.map((row) => {
    if (
      !row.document_id ||
      !row.title ||
      row.has_metadata === null ||
      row.is_complete === null
    ) {
      throwDataAccessError("map notarial index row", {
        code: "invalid_view_row",
      });
    }
    return {
      document_id: row.document_id,
      title: row.title,
      client_name: row.client_name,
      instrument_number: row.instrument_number,
      authorized_at: row.authorized_at,
      protocol_book: row.protocol_book,
      initial_folio: row.initial_folio,
      final_folio: row.final_folio,
      act_name: row.act_name,
      parties: row.parties,
      period_year: row.period_year,
      period_month: row.period_month,
      period_half: row.period_half,
      version: row.version,
      has_metadata: row.has_metadata,
      is_complete: row.is_complete,
    };
  });
}
