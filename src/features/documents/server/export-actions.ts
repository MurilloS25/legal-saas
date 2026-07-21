import "server-only";

import { requireApiUser } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import {
  buildEscrituraDocx,
  contentDispositionAttachment,
  DOCX_MIME,
  DocxGenerationError,
  loadDocumentFormattingPreferences,
} from "@/lib/documents/docx";
import {
  DocumentIdSchema,
  DocumentOptionSelectionsSchema,
  DocumentValuesSchema,
} from "../model/document-schema";
import { toVariableOutputTransform } from "@/features/templates/model/variable-autofill";
import type { VariableTransformsMap } from "@/lib/editor/render";

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
    .select("id, title, template_id, field_values, option_selections, rendered_content")
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

  const optionSelections = DocumentOptionSelectionsSchema.safeParse(
    document.option_selections ?? {},
  );
  if (!optionSelections.success) throw new DocumentExportError(422);

  const { data: templateFields, error: fieldsError } = await supabase
    .from("template_fields")
    .select("field_key, output_transform")
    .eq("template_id", document.template_id)
    .eq("owner_id", user.id);
  if (fieldsError) throwDataAccessError("load document export fields", fieldsError);

  const transforms: VariableTransformsMap = {};
  for (const field of templateFields ?? []) {
    const transform = toVariableOutputTransform(field.output_transform);
    if (transform !== "none") transforms[field.field_key] = transform;
  }

  const formatting = await loadDocumentFormattingPreferences(supabase, user.id);

  let result;
  try {
    result = await buildEscrituraDocx({
      contentJson: template.content_json,
      fieldValues: values.data,
      renderedContent: document.rendered_content,
      title: document.title,
      transforms,
      optionSelections: optionSelections.data,
      formatting,
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
