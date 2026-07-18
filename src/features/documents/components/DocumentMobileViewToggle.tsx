"use client";

import type { DocumentMobileView } from "../hooks/use-document-layout";

type Props = {
  value: DocumentMobileView;
  onChange: (value: DocumentMobileView) => void;
};

function tabClass(active: boolean) {
  return `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 ${
    active
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
  }`;
}

export function DocumentMobileViewToggle({ value, onChange }: Props) {
  return (
    <div className="mb-6 flex gap-2 xl:hidden" role="group" aria-label="Vista">
      <button
        type="button"
        onClick={() => onChange("data")}
        aria-pressed={value === "data"}
        className={tabClass(value === "data")}
      >
        Datos
      </button>
      <button
        type="button"
        onClick={() => onChange("document")}
        aria-pressed={value === "document"}
        className={tabClass(value === "document")}
      >
        Documento
      </button>
    </div>
  );
}
