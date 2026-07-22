"use client";

import { DocumentSheet } from "@/components/document/DocumentSheet";
import type { DocumentModel } from "@/lib/editor/render";
import type { DocumentMobileView } from "../hooks/use-document-layout";

type Props = {
  dirty: boolean;
  mobileView: DocumentMobileView;
  model: DocumentModel;
  templateName: string;
  /** Ausentes cuando la escritura es de solo lectura: sin edición inline. */
  values?: Record<string, string>;
  editingNodeId?: string;
  onStartEdit?: (nodeId: string, variableKey: string) => void;
  onChangeValue?: (key: string, value: string) => void;
  onStopEdit?: () => void;
  onSelectVariant?: (blockId: string, variantId: string) => void;
};

export function DocumentPreviewPanel({
  dirty,
  mobileView,
  model,
  templateName,
  values,
  editingNodeId,
  onStartEdit,
  onChangeValue,
  onStopEdit,
  onSelectVariant,
}: Props) {
  return (
    <section
      aria-labelledby="composer-document-heading"
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${
        mobileView === "data" ? "hidden xl:block" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h2
            id="composer-document-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Documento
          </h2>
          <p className="text-xs text-slate-500">Machote: {templateName}</p>
        </div>
        {dirty && (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Cambios sin guardar
          </span>
        )}
      </div>
      <div className="p-4">
        <DocumentSheet
          model={model}
          pendingVariableDisplay="placeholder"
          emptyMessage="El machote no tiene contenido."
          aria-labelledby="composer-document-heading"
          values={values}
          editingNodeId={editingNodeId}
          onStartEdit={onStartEdit}
          onChangeValue={onChangeValue}
          onStopEdit={onStopEdit}
          onSelectVariant={onSelectVariant}
        />
      </div>
    </section>
  );
}
