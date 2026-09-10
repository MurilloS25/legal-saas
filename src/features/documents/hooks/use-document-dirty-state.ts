"use client";

import { useEffect, useRef } from "react";
import { useSaveRevision } from "@/lib/forms/use-save-revision";
import type { DocumentDraftState } from "../server/content-actions";

export function useDocumentDirtyState(state: DocumentDraftState) {
  const { dirty, markDirty, captureRevision, completeSave } = useSaveRevision();
  const submitted = useRef(0);
  const lastSuccess = useRef<DocumentDraftState | null>(null);

  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      completeSave(submitted.current);
    }
    // Each response acknowledges the revision captured by its submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { dirty, markDirty, startSave: () => { submitted.current = captureRevision(); } };
}
