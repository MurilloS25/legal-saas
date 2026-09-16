"use client";

import { useCallback, useEffect, useState } from "react";
import type { TemplateWorkspaceSection } from "../components/TemplateWorkspaceHeader";

function resolveSection(raw: string | null): TemplateWorkspaceSection {
  return raw === "document" ||
    raw === "variables" ||
    raw === "notarial" ||
    raw === "publish"
    ? raw
    : "information";
}

export function useTemplateWorkspaceSection(
  isEdit: boolean,
  initialSection: TemplateWorkspaceSection,
) {
  const [section, setSection] = useState(initialSection);

  useEffect(() => {
    function onPopState() {
      const next = resolveSection(
        new URLSearchParams(window.location.search).get("section"),
      );
      setSection(next === "notarial" && !isEdit ? "document" : next);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isEdit]);

  const goToSection = useCallback((next: TemplateWorkspaceSection) => {
    setSection(next);
    if (typeof window === "undefined") return;
    const url =
      next === "information"
        ? window.location.pathname
        : `${window.location.pathname}?section=${next}`;
    window.history.pushState(null, "", url);
  }, []);

  return { section, goToSection };
}
