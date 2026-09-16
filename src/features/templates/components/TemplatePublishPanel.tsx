"use client";

import type { TemplateWorkspaceState } from "../model/action-state";
import { TemplateMetadataForm } from "./TemplateMetadataForm";

type Props = {
  hidden: boolean;
  name: string;
  description: string;
  status: string;
  variableCount: number;
  variablesPendingCount: number;
  isEdit: boolean;
  indexComplete: boolean;
  canWrite: boolean;
  errors: TemplateWorkspaceState["errors"];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
};

export function TemplatePublishPanel(props: Props) {
  return (
    <div
      id="template-panel-publish"
      role="tabpanel"
      aria-labelledby="template-tab-publish"
      hidden={props.hidden}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">
              Resumen antes de publicar
            </h2>
            <p className="text-xs text-slate-500">
              Publicar solo cambia el estado — no exige que las variables o el
              Índice Notarial estén completos.
            </p>
          </div>
          <div className="px-6 py-5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Nombre</span>
              <span className="font-medium text-slate-900">
                {props.name || "Sin nombre"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Variables configuradas</span>
              <span className="font-medium text-slate-900">
                {props.variableCount - props.variablesPendingCount} de {props.variableCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Índice notarial</span>
              <span className="font-medium text-slate-900">
                {props.isEdit
                  ? props.indexComplete
                    ? "Completo"
                    : "Parcial u opcional"
                  : "Disponible después de guardar"}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Estado</h2>
          </div>
          <div className="px-6 py-5 max-w-xs">
            <TemplateMetadataForm
              name={props.name}
              description={props.description}
              status={props.status}
              errors={props.errors}
              disabled={!props.canWrite}
              fieldset="publish"
              onNameChange={props.onNameChange}
              onDescriptionChange={props.onDescriptionChange}
              onStatusChange={props.onStatusChange}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
