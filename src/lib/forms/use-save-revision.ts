"use client";

import { useRef, useState } from "react";

/** Only the submitted revision becomes saved; later edits remain dirty. */
export function useSaveRevision() {
  const revision = useRef(0);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(0);

  return {
    dirty: current !== saved,
    markDirty() { setCurrent(++revision.current); },
    captureRevision() { return revision.current; },
    completeSave(submitted: number) { setSaved(submitted); },
  };
}
