"use client";

import { useEffect, useRef, useState } from "react";
import { useSaveRevision } from "@/lib/forms/use-save-revision";
import type { DocumentDraftState } from "../server/content-actions";

export function useDocumentDirtyState(
  state: DocumentDraftState,
  draftUpdatedAt: string,
  pending: boolean,
) {
  const { dirty, markDirty, captureRevision, completeSave } = useSaveRevision();
  const submitted = useRef(0);
  const lastSuccess = useRef<DocumentDraftState | null>(null);
  const [expectedVersion, setExpectedVersion] = useState(draftUpdatedAt);
  const [observedDraftVersion, setObservedDraftVersion] = useState(draftUpdatedAt);
  const [versionState, setVersionState] = useState(state);

  if (versionState !== state) {
    setVersionState(state);
    if (state.success && state.updatedAt) {
      setExpectedVersion(state.updatedAt);
      setObservedDraftVersion(draftUpdatedAt);
    }
  } else if (
    !dirty &&
    !pending &&
    draftUpdatedAt &&
    draftUpdatedAt !== observedDraftVersion
  ) {
    setObservedDraftVersion(draftUpdatedAt);
    setExpectedVersion(draftUpdatedAt);
  }

  useEffect(() => {
    if (state.success && lastSuccess.current !== state) {
      lastSuccess.current = state;
      completeSave(submitted.current);
    }
    // Each response acknowledges the revision captured by its submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return {
    dirty,
    markDirty,
    expectedVersion,
    acceptConflictVersion: setExpectedVersion,
    startSave: () => { submitted.current = captureRevision(); },
  };
}
