"use client";

import { useMemo } from "react";
import { buildDocumentModel } from "@/lib/editor/render";
import { validateTemplateDocument } from "@/lib/editor/validate";
import { extractTemplateVariablesFromDocument } from "@/lib/editor/variables";

export function useTemplatePreview(documentJson: unknown) {
  const document = useMemo(() => {
    const validation = validateTemplateDocument(documentJson);
    return validation.ok ? validation.document : null;
  }, [documentJson]);

  const contentKeys = useMemo(
    () => (document ? extractTemplateVariablesFromDocument(document) : []),
    [document],
  );

  const model = useMemo(
    () => (document ? buildDocumentModel(document) : []),
    [document],
  );

  return { contentKeys, model };
}
