import "server-only";

import { requireApiUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildEscrituraDocx,
  contentDispositionAttachment,
  DOCX_MIME,
  DocxGenerationError,
} from "@/lib/documents/docx";
import {
  buildNotarialCsv,
  notarialExportFilename,
} from "../model/notarial-export";
import {
  parseNotarialQuery,
  type RawNotarialQuery,
} from "../model/notarial-query";
import {
  DocumentIdSchema,
  DocumentValuesSchema,
} from "../model/document-schema";
import { queryNotarialIndexForExport } from "./notarial-index-queries";

export class DocumentExportError extends Error {
  constructor(readonly status: number) {
    super("Document export failed");
    this.name = "DocumentExportError";
  }
}

export type BinaryExport = {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
  contentDisposition: string;
};

export async function prepareDocumentDocxExport(
  documentId: string,
): Promise<BinaryExport> {
  const { supabase, user } = await requireApiUser();
  if (!DocumentIdSchema.safeParse(documentId).success) {
    throw new DocumentExportError(404);
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, title, template_id, field_values, rendered_content")
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (documentError) throwDataAccessError("load document export", documentError);
  if (!document) throw new DocumentExportError(404);

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("content_json")
    .eq("id", document.template_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (templateError) throwDataAccessError("load document export template", templateError);
  if (!template) throw new DocumentExportError(422);

  const values = DocumentValuesSchema.safeParse(document.field_values ?? {});
  if (!values.success) throw new DocumentExportError(422);

  let result;
  try {
    result = await buildEscrituraDocx({
      contentJson: template.content_json,
      fieldValues: values.data,
      renderedContent: document.rendered_content,
      title: document.title,
    });
  } catch (error) {
    if (error instanceof DocxGenerationError) {
      console.error(`[docx] generation failed: ${error.code}`);
      throw new DocumentExportError(
        error.code === "generation_failed" ? 500 : 413,
      );
    }
    console.error("[docx] unexpected generation error");
    throw new DocumentExportError(500);
  }

  const { error: activityError } = await supabase.rpc(
    "log_document_word_generated",
    { p_document_id: documentId },
  );
  if (activityError) {
    console.error(
      `[docx] activity logging failed (${activityError.code ?? "unknown"})`,
    );
  }

  const body = new Uint8Array(result.buffer.byteLength);
  body.set(new Uint8Array(result.buffer));

  return {
    body,
    contentType: DOCX_MIME,
    contentDisposition: contentDispositionAttachment(result.filename),
  };
}

export async function prepareNotarialCsvExport(
  rawQuery: RawNotarialQuery,
): Promise<BinaryExport> {
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

  // The generated type does not encode nullable SQL date arguments.
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
