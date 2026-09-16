"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocumentWorkspaceSection } from "../components/DocumentWorkspaceHeader";

function resolveSection(
  raw: string | null,
  persisted: boolean,
  notarialUnlocked: boolean,
): DocumentWorkspaceSection {
  if (raw === "notarial") return notarialUnlocked ? "notarial" : "completar";
  if (raw === "revisar" || raw === "finalizar") return "completar";
  if (raw === "cobro" && !persisted) return "completar";
  return raw === "cobro" ? raw : "completar";
}

export function useDocumentWorkspaceSection(
  persisted: boolean,
  notarialUnlocked: boolean,
  initialSection: DocumentWorkspaceSection,
) {
  const [section, setSection] = useState(initialSection);
  const searchParams = useSearchParams();
  const resolvedSection = resolveSection(
    searchParams.get("section"),
    persisted,
    notarialUnlocked,
  );
  const [lastSearchParams, setLastSearchParams] = useState(searchParams);

  if (searchParams !== lastSearchParams) {
    setLastSearchParams(searchParams);
    if (resolvedSection !== section) setSection(resolvedSection);
  }

  const goToSection = useCallback((next: DocumentWorkspaceSection) => {
    setSection(next);
    if (typeof window === "undefined") return;
    const url =
      next === "completar"
        ? window.location.pathname
        : `${window.location.pathname}?section=${next}`;
    window.history.pushState(null, "", url);
  }, []);

  return { section, goToSection };
}
