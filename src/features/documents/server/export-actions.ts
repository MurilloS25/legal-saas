import "server-only";

import { requireApiWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import {
  buildEscrituraDocx,
  DEFAULT_MARGIN_PROFILE,
  contentDispositionAttachment,
  DOCX_MIME,
  DocxGenerationError,
  loadDocumentFormattingPreferences,
  type MarginProfile,
} from "@/lib/documents/docx";
import {
  DocumentIdSchema,
  DocumentOptionSelectionsSchema,
  DocumentValuesSchema,
} from "../model/document-schema";
import type { VariableTransformsMap } from "@/lib/editor/render";
import { resolveDocumentTemplateSnapshot } from "../model/document-template-snapshot";

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

async function prepareDocumentDocxExportInternal(
  documentId: string,
  recordActivity: boolean,
  marginProfile: MarginProfile,
): Promise<BinaryExport> {
  const { supabase, workspaceId, role } = await requireApiWorkspace();
  if (!hasPermission(role, "documents.export")) {
    throw new DocumentExportError(403);
  }
  if (!DocumentIdSchema.safeParse(documentId).success) {
    throw new DocumentExportError(404);
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, title, field_values, option_selections, rendered_content, template_snapshot")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (documentError) throwDataAccessError("load document export", documentError);
  if (!document) throw new DocumentExportError(404);

  const values = DocumentValuesSchema.safeParse(document.field_values ?? {});
  if (!values.success) throw new DocumentExportError(422);

  const optionSelections = DocumentOptionSelectionsSchema.safeParse(
    document.option_selections ?? {},
  );
  if (!optionSelections.success) throw new DocumentExportError(422);

  let snapshot;
  try {
    snapshot = resolveDocumentTemplateSnapshot(
      document.template_snapshot,
      document.rendered_content,
    );
  } catch {
    throw new DocumentExportError(422);
  }

  const transforms: VariableTransformsMap = {};
  for (const field of snapshot.fields) {
    if (field.output_transform !== "none") {
      transforms[field.field_key] = field.output_transform;
    }
  }

  const formatting = await loadDocumentFormattingPreferences(supabase, workspaceId);

  let result;
  try {
    result = await buildEscrituraDocx({
      document: snapshot.document,
      fieldValues: values.data,
      title: document.title,
      transforms,
      optionSelections: optionSelections.data,
      formatting,
      marginProfile,
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

  if (recordActivity) {
    const { error: activityError } = await supabase.rpc(
      "log_document_word_generated",
      { p_document_id: documentId },
    );
    if (activityError) {
      console.error(
        `[docx] activity logging failed (${activityError.code ?? "unknown"})`,
      );
    }
  }

  const body = new Uint8Array(result.buffer.byteLength);
  body.set(new Uint8Array(result.buffer));

  return {
    body,
    contentType: DOCX_MIME,
    contentDisposition: contentDispositionAttachment(result.filename),
  };
}

/**
 * Read-only preparation used by GET; it never writes audit activity.
 * `marginProfile` (Frente por defecto) elige qué márgenes de Configuración
 * se aplican al Word generado.
 */
export function prepareDocumentDocxExport(
  documentId: string,
  marginProfile: MarginProfile = DEFAULT_MARGIN_PROFILE,
): Promise<BinaryExport> {
  return prepareDocumentDocxExportInternal(documentId, false, marginProfile);
}

/** Explicit user export command used by POST; records one activity event. */
export function prepareAndRecordDocumentDocxExport(
  documentId: string,
  marginProfile: MarginProfile = DEFAULT_MARGIN_PROFILE,
): Promise<BinaryExport> {
  return prepareDocumentDocxExportInternal(documentId, true, marginProfile);
}
