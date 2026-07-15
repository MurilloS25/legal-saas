import "server-only";

import { requireApiUser } from "@/lib/server/auth";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildNotarialCsv,
  notarialExportFilename,
} from "../export/notarial-csv";
import { parseNotarialQuery, type RawNotarialQuery } from "../model/query";
import { queryNotarialIndexForExport } from "./export-queries";

export type NotarialCsvExport = {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
  contentDisposition: string;
};

export async function prepareNotarialCsvExport(
  rawQuery: RawNotarialQuery,
): Promise<NotarialCsvExport> {
  const { supabase, user } = await requireApiUser();
  const query = parseNotarialQuery(rawQuery);
  const rows = await queryNotarialIndexForExport(supabase, user.id, query);
  const csv = buildNotarialCsv(rows);
  const filename = notarialExportFilename(query.from, query.to);

  type LogExportArgs =
    Database["public"]["Functions"]["log_notarial_index_export"]["Args"];
  const args = {
    p_format: "csv",
    p_from: query.from,
    p_to: query.to,
    p_row_count: rows.length,
  };

  const { error: activityError } = await supabase.rpc(
    "log_notarial_index_export",
    args as LogExportArgs,
  );
  if (activityError) {
    console.error(
      `[notarial-export] activity logging failed (${activityError.code ?? "unknown"})`,
    );
  }

  const body = Uint8Array.from(new TextEncoder().encode(csv));
  return {
    body,
    contentType: "text/csv; charset=utf-8",
    contentDisposition: `attachment; filename="${filename}"`,
  };
}
