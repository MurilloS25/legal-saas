"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { documentFieldInputId } from "../model/composer";

export type DocumentMobileView = "data" | "document";

export function useDocumentLayout() {
  const [mobileView, setMobileView] = useState<DocumentMobileView>("data");
  const [focusedKey, setFocusedKey] = useState<string | undefined>();

  function focusField(key: string) {
    flushSync(() => setMobileView("data"));
    const input = globalThis.document.getElementById(documentFieldInputId(key));
    if (input instanceof HTMLElement) {
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  return {
    focusedKey,
    focusField,
    mobileView,
    setFocusedKey,
    setMobileView,
  };
}
