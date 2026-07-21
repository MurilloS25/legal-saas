"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentDraftState } from "../server/content-actions";

export function useDocumentDirtyState(state: DocumentDraftState) {
  const [dirty, setDirty] = useState(false);
  const lastSuccess = useRef<DocumentDraftState | null>(null);

  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      setDirty(false);
    }
  }, [state]);

  return { dirty, markDirty: () => setDirty(true) };
}
