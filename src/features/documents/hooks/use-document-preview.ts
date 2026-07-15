"use client";

import { useMemo } from "react";
import { buildDocumentModel } from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import type { TemplateDocument } from "@/lib/editor/types";

export function useDocumentPreview(
  document: TemplateDocument,
  values: Record<string, string>,
  persistedValues?: Record<string, string>,
) {
  const model = useMemo(
    () => buildDocumentModel(document, values),
    [document, values],
  );
  const persistedPendingCount = persistedValues
    ? findUnresolvedDocumentVariables(document, persistedValues).length
    : 0;

  return { model, persistedPendingCount };
}
