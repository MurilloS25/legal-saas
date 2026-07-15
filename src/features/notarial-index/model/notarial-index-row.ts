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
