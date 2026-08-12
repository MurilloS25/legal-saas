import "server-only";

import { contentDispositionAttachment, DOCX_MIME } from "@/lib/documents/docx/http";
import { loadDocumentFormattingPreferences } from "@/lib/documents/docx/settings-loader";
import { requireApiWorkspace } from "@/lib/server/auth";
import { throwDataAccessError, ValidationError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import type { Database } from "@/lib/supabase/database.types";
import { generateNotarialIndexDocx } from "../export/notarial-docx";
import {
  fortnightDateBounds,
  parseFortnightSelection,
} from "../model/fortnight";
import { parseNotarialQuery, type RawNotarialQuery } from "../model/query";
import { notarialIndexFilename } from "../model/formatters";
import { queryNotarialIndexForExport } from "./export-queries";

export type RawNotarialExportQuery = Pick<
  RawNotarialQuery,
  "year" | "month" | "half" | "search" | "completeness" | "act_type"
>;

export type NotarialDocxExport = {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
  contentDisposition: string;
};

export async function prepareNotarialDocxExport(
  rawQuery: RawNotarialExportQuery,
): Promise<NotarialDocxExport> {
  const selection = parseFortnightSelection(rawQuery);
  if (!selection) {
    throw new ValidationError("Selecciona un año, mes y quincena válidos.");
  }
  const query = parseNotarialQuery(rawQuery);

  const { supabase, workspaceId, role } = await requireApiWorkspace();
  if (!hasPermission(role, "notarial_index.generate")) {
    throw new ValidationError(
      "Solo el propietario o un administrador puede generar el Índice Notarial.",
    );
  }
  const [{ data: profile, error: profileError }, exportData, formatting] =
    await Promise.all([
      supabase
        .from("lawyer_profiles")
        .select("full_name")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      queryNotarialIndexForExport(supabase, workspaceId, query),
      loadDocumentFormattingPreferences(supabase, workspaceId),
    ]);
  if (profileError) throwDataAccessError("load notary profile for export", profileError);
  const notaryName = profile?.full_name?.trim();
  if (!notaryName) {
    throw new ValidationError(
      "Completa tu nombre en Configuración antes de generar el índice.",
    );
  }

  const buffer = await generateNotarialIndexDocx({
    rows: exportData.rows,
    selection: query.selection,
    notaryName,
    formatting,
  });
  const bounds = fortnightDateBounds(
    query.selection.year,
    query.selection.month,
    query.selection.half,
  );

  type LogExportArgs =
    Database["public"]["Functions"]["log_notarial_index_export"]["Args"];
  const args = {
    p_format: "docx",
    p_from: bounds.from,
    p_to: bounds.to,
    p_row_count: exportData.total,
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

  const filename = notarialIndexFilename(query.selection);
  return {
    body: new Uint8Array(buffer),
    contentType: DOCX_MIME,
    contentDisposition: contentDispositionAttachment(filename),
  };
}
