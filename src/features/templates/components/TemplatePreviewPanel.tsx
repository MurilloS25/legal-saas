"use client";

import { useId } from "react";
import { DocumentSheet } from "@/components/document/DocumentSheet";
import type { DocumentModel } from "@/lib/editor/render";

type Props = {
  model: DocumentModel;
  /**
   * Cuando es `true`, omite la tarjeta/encabezado propios ("Vista previa" +
   * descripción) y el límite de alto con scroll interno — se usa dentro de
   * `ResizableSplitPane`/`ExpandableDocumentPanel`, que ya aportan su
   * propio encabezado (título + Ocultar/Expandir) y su propio manejo de
   * alto/scroll, para no duplicar chrome.
   */
  bare?: boolean;
};

export function TemplatePreviewPanel({ model, bare = false }: Props) {
  const headingId = useId();

  if (bare) {
    return (
      <DocumentSheet
        model={model}
        pendingVariableDisplay="label"
        emptyMessage="Escribe el contenido para ver la vista previa."
      />
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 id={headingId} className="text-sm font-semibold text-slate-900">
          Vista previa
        </h2>
        <p className="text-xs text-slate-500">
          Así se verá el documento; las variables aparecen resaltadas.
        </p>
      </div>
      <div className="p-4 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto">
        <DocumentSheet
          model={model}
          pendingVariableDisplay="label"
          emptyMessage="Escribe el contenido para ver la vista previa."
          aria-labelledby={headingId}
        />
      </div>
    </section>
  );
}
