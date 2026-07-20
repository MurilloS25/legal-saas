"use client";

import { useState } from "react";

export type DocumentMobileView = "data" | "document";

export function useDocumentLayout() {
  const [mobileView, setMobileView] = useState<DocumentMobileView>("data");
  const [focusedKey, setFocusedKey] = useState<string | undefined>();

  return {
    focusedKey,
    mobileView,
    setFocusedKey,
    setMobileView,
  };
}
