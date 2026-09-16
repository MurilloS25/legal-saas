"use client";

import type { ReactNode } from "react";
import type { DocumentModel } from "@/lib/editor/render";
import { FieldError } from "@/components/forms/FieldError";
import { ResizableSplitPane } from "@/components/document/ResizableSplitPane";
import type { DocumentMobileView } from "../hooks/use-document-layout";
import { DocumentMobileViewToggle } from "./DocumentMobileViewToggle";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import { PendingFieldsDialog, type PendingField } from "./PendingFieldsDialog";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type Props = {
  hidden: boolean;
  readOnly: boolean;
  canEdit: boolean;
  isEdit: boolean;
  contextBar: ReactNode;
  title: string;
  titleError?: string;
  onTitleChange: (value: string) => void;
  completedCount: number;
  totalCount: number;
  pendingFields: PendingField[];
  onGoToField: (key: string) => void;
  onGoToNextPending: () => void;
  dirty: boolean;
  mobileView: DocumentMobileView;
  onMobileViewChange: (value: DocumentMobileView) => void;
  onExpand: () => void;
  model: DocumentModel;
  templateName: string;
  values?: Record<string, string>;
  editingNodeId?: string;
  onStartEdit?: (nodeId: string, variableKey: string) => void;
  onChangeValue?: (key: string, value: string) => void;
  onStopEdit?: () => void;
  onSelectVariant?: (blockId: string, variantId: string) => void;
};

export function DocumentCompletarPanel(props: Props) {
  const details = (
    <section aria-label="Datos de la Escritura" className="space-y-5">
      {!props.readOnly && props.contextBar}
      <div>
        <label htmlFor="composer-title" className={labelClass}>
          Título de la escritura
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          id="composer-title"
          name="title"
          type="text"
          required
          value={props.title}
          disabled={props.readOnly}
          onChange={(event) => props.onTitleChange(event.target.value)}
          className={inputClass}
          aria-invalid={!!props.titleError}
          aria-describedby={props.titleError ? "composer-title-error" : undefined}
        />
        <FieldError id="composer-title-error" message={props.titleError} />
      </div>

      {props.totalCount > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1.5">Progreso</h3>
          <p role="status" className="text-xs font-medium text-slate-600">
            {props.completedCount} de {props.totalCount} campos completos
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent-600 transition-all"
              style={{ width: `${Math.round((props.completedCount / props.totalCount) * 100)}%` }}
            />
          </div>
          <div className="mt-2">
            <PendingFieldsDialog pendingFields={props.pendingFields} onGoToField={props.onGoToField} />
          </div>
          {!props.readOnly && (
            <button
              type="button"
              onClick={props.onGoToNextPending}
              disabled={props.pendingFields.length === 0}
              className="mt-2 w-full rounded-lg border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm font-medium text-accent-800 transition-colors hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente pendiente →
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Este machote no tiene variables: el documento es texto fijo y solo
          necesita un título.
        </p>
      )}

      {props.readOnly && (
        <p role="status" className="text-xs text-slate-500">
          {props.isEdit && props.canEdit
            ? "Esta escritura está finalizada (solo lectura). Reábrela para editarla de nuevo."
            : "Tu rol no permite editar escrituras. La ves en modo lectura."}
        </p>
      )}
    </section>
  );

  return (
    <div
      id="document-panel-completar"
      role="tabpanel"
      aria-labelledby="document-step-completar"
      hidden={props.hidden}
    >
      <DocumentMobileViewToggle value={props.mobileView} onChange={props.onMobileViewChange} />
      <ResizableSplitPane
        secondaryTitle="Datos de la Escritura"
        onExpand={props.onExpand}
        primaryClassName={props.mobileView === "data" ? "hidden xl:block" : ""}
        secondaryClassName={props.mobileView === "document" ? "hidden xl:block" : ""}
        defaultSecondaryPercent={35}
        primary={
          <DocumentPreviewPanel
            dirty={props.dirty}
            mobileView="document"
            model={props.model}
            templateName={props.templateName}
            values={props.values}
            editingNodeId={props.editingNodeId}
            onStartEdit={props.onStartEdit}
            onChangeValue={props.onChangeValue}
            onStopEdit={props.onStopEdit}
            onSelectVariant={props.onSelectVariant}
          />
        }
        secondary={details}
      />
    </div>
  );
}
