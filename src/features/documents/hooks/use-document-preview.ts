"use client";

import { useMemo } from "react";
import {
  buildDocumentModel,
  type OptionSelectionsMap,
  type VariableTransformsMap,
} from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import type { TemplateDocument } from "@/lib/editor/types";

export function useDocumentPreview(
  document: TemplateDocument,
  values: Record<string, string>,
  persistedValues?: Record<string, string>,
  transforms?: VariableTransformsMap,
  optionSelections?: OptionSelectionsMap,
  persistedOptionSelections?: OptionSelectionsMap,
) {
  const model = useMemo(
    () => buildDocumentModel(document, values, transforms, optionSelections),
    [document, values, transforms, optionSelections],
  );
  const persistedPendingCount = persistedValues
    ? findUnresolvedDocumentVariables(
        document,
        persistedValues,
        persistedOptionSelections,
      ).length
    : 0;

  return { model, persistedPendingCount };
}
