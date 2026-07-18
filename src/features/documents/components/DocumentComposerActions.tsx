"use client";

import type { DocumentStatus } from "../model/lifecycle";
import { DocumentStatusControls } from "./DocumentStatusControls";
import { DownloadDocxButton } from "./DownloadDocxButton";

type Props = {
  dirty: boolean;
  documentId: string | null;
  pending: boolean;
  pendingVariableCount: number;
  readOnly: boolean;
  saveStatusText: string;
  status: DocumentStatus;
};

export function DocumentComposerActions({
  dirty,
  documentId,
  pending,
  pendingVariableCount,
  readOnly,
  saveStatusText,
  status,
}: Props) {
  return (
    <div className="border-t border-slate-100 px-6 py-4 space-y-3">
      {readOnly ? (
        <p role="status" className="text-xs text-slate-500">
          Esta escritura está finalizada (solo lectura). Reábrela para editarla
          de nuevo.
        </p>
      ) : (
        <>
          <p
            role="status"
            className={`text-xs ${
              dirty && !pending
                ? "text-amber-700 font-medium"
                : "text-slate-500"
            }`}
          >
            {saveStatusText}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      )}

      {documentId && (
        <DocumentStatusControls
          key={status}
          documentId={documentId}
          status={status}
          dirty={dirty}
        />
      )}
      {documentId && (
        <DownloadDocxButton
          documentId={documentId}
          disabled={dirty}
          pendingVariableCount={pendingVariableCount}
        />
      )}

    </div>
  );
}
