import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { throwDataAccessError } from "@/lib/server/errors";

export const NOTARIAL_INDEX_SELECT =
  "document_id, title, client_name, instrument_number, authorized_at, act_type, book_reference, folio_reference, appearing_parties_summary, has_metadata, is_complete";

export type NotarialIndexRow = {
  document_id: string;
  title: string;
  client_name: string | null;
  instrument_number: string | null;
  authorized_at: string | null;
  act_type: string | null;
  book_reference: string | null;
  folio_reference: string | null;
  appearing_parties_summary: string | null;
  has_metadata: boolean;
  is_complete: boolean;
};

type ViewRow = Pick<
  Database["public"]["Views"]["notarial_index_entries"]["Row"],
  | "document_id"
  | "title"
  | "client_name"
  | "instrument_number"
  | "authorized_at"
  | "act_type"
  | "book_reference"
  | "folio_reference"
  | "appearing_parties_summary"
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
      act_type: row.act_type,
      book_reference: row.book_reference,
      folio_reference: row.folio_reference,
      appearing_parties_summary: row.appearing_parties_summary,
      has_metadata: row.has_metadata,
      is_complete: row.is_complete,
    };
  });
}
