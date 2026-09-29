"use client";

/**
 * "Completar desde Clientes": para cada rol (`rol.dato`) detectado —
 * automáticamente por alias conocidos o por configuración explícita del
 * Machote— muestra un selector searchable de Cliente y copia sus datos
 * hacia las variables de ese rol.
 *
 * El Cliente asignado ("Cliente asignado: X") es solo una referencia
 * visual de la sesión: no crea ninguna relación formal, no reemplaza el
 * Cliente principal de la Escritura y no dispara actualizaciones futuras.
 * Vive en `DocumentContextBar` (este componente es controlado) porque el
 * popover desmonta su contenido al cerrarse. Todos los campos copiados
 * quedan editables de inmediato; al recargar persisten los valores, no la
 * asignación visual. Cambiar de Cliente pide confirmación; "Quitar cliente"
 * solo desvincula, nunca borra los valores copiados.
 *
 * `RoleAutofillFields` renderiza un único rol — es lo que `DocumentContextBar`
 * incrusta dentro del popover de cada Parte. Creando un Cliente nuevo desde
 * aquí ("+ Crear nuevo cliente") reutiliza exactamente el mismo
 * `handleSelect` que la selección por combobox, así la confirmación de
 * sobrescritura de campos ya llenos aplica igual en ambos caminos — nunca
 * convierte al nuevo Cliente en el Cliente principal de la Escritura.
 */

import { useId, useState } from "react";
import { CreateClientDialog, type CreatedClient } from "@/features/clients";
import type {
  DocumentClientOption,
  RoleVariableGroup,
} from "../model/role-autofill";
import { classifyClientAssignment, planRoleAutofill } from "../model/role-autofill";
import { ClientCombobox } from "./ClientCombobox";

type PendingConfirmation = {
  kind: "change" | "overwrite";
  client: DocumentClientOption;
  values: Record<string, string>;
  overwriteFields: string[];
  /** Subconjunto de `overwriteFields` que se vacía (no aplica a una sociedad). */
  clearedFields: string[];
  /** Subconjunto de `overwriteFields` que se vacía (el Cliente nuevo no tiene el dato). */
  missingFields: string[];
};

type Props = {
  group: RoleVariableGroup;
  clients: DocumentClientOption[];
  values: Record<string, string>;
  readOnly: boolean;
  /** Cliente hoy asignado a esta Parte (referencia visual de la sesión). */
  assignedClient: DocumentClientOption | null;
  onAssign: (client: DocumentClientOption | null) => void;
  onApply: (fieldValues: Record<string, string>) => void;
  /** Registra el Cliente recién creado en la lista compartida del compositor. */
  onClientCreated: (client: CreatedClient) => void;
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).replaceAll("_", " ");
}

export function RoleAutofillFields({
  group,
  clients,
  values,
  readOnly,
  assignedClient,
  onAssign,
  onApply,
  onClientCreated,
}: Props) {
  const dialogId = useId();
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [notApplicable, setNotApplicable] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  function handleSelect(client: DocumentClientOption) {
    // Incluye el vaciado de datos personales que no aplican a una persona
    // jurídica (p. ej. el estado civil de la persona elegida antes).
    const plan = planRoleAutofill(
      client,
      group.variables,
      values,
      assignedClient !== null && assignedClient.id !== client.id,
    );

    setIncomplete(plan.incomplete);
    setNotApplicable(plan.notApplicable);
    const kind = classifyClientAssignment(assignedClient, client, plan);
    if (kind !== "apply") {
      setConfirmation({
        kind,
        client,
        values: plan.values,
        overwriteFields: plan.overwriteFields,
        clearedFields: plan.clearedFields,
        missingFields: plan.missingFields,
      });
      return;
    }

    onApply(plan.values);
    onAssign(client);
  }

  function handleCreated(client: CreatedClient) {
    onClientCreated(client);
    handleSelect(client);
  }

  function confirmOverwrite() {
    if (!confirmation) return;
    onApply(confirmation.values);
    onAssign(confirmation.client);
    setConfirmation(null);
  }

  function cancelOverwrite() {
    setConfirmation(null);
  }

  const dialogTitleId = `${dialogId}-confirm-title`;
  const dialogDescId = `${dialogId}-confirm-desc`;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">
        {roleLabel(group.role)}
      </h3>

      <ClientCombobox
        clients={clients}
        selectedClient={assignedClient}
        disabled={readOnly}
        label="Completar desde Cliente registrado"
        onSelect={handleSelect}
        onClear={() => onAssign(null)}
      />

      {!readOnly && (
        <div className="mt-2">
          <CreateClientDialog onCreated={handleCreated} />
        </div>
      )}

      {assignedClient && (
        <p className="mt-2 text-xs text-slate-500">
          Cliente asignado:{" "}
          <span className="font-medium text-slate-700">
            {assignedClient.full_name}
          </span>
        </p>
      )}

      {incomplete.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Algunos campos no se pudieron completar: {incomplete.join(", ")}.
        </p>
      )}

      {notApplicable.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          No aplican a una persona jurídica y quedaron sin completar:{" "}
          {notApplicable.join(", ")}.
        </p>
      )}

      {confirmation && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={cancelOverwrite}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="px-6 pt-6 pb-4 text-center">
                <h2
                  id={dialogTitleId}
                  className="text-base font-semibold text-slate-900 mb-2"
                >
                  {confirmation.kind === "change"
                    ? "Cambiar cliente"
                    : "Este rol ya contiene información"}
                </h2>
                <p
                  id={dialogDescId}
                  className="text-sm text-slate-600 leading-relaxed"
                >
                  {confirmation.kind === "change" && assignedClient && (
                    <>
                      {`Esta Parte está asociada actualmente con ${assignedClient.full_name}. ¿Quieres reemplazarla por ${confirmation.client.full_name}? `}
                      {confirmation.overwriteFields.length === 0 &&
                        "Se actualizarán los datos vinculados al Cliente. "}
                    </>
                  )}
                  {(() => {
                    const replaced = confirmation.overwriteFields.filter(
                      (key) =>
                        !confirmation.clearedFields.includes(key) &&
                        !confirmation.missingFields.includes(key),
                    );
                    return (
                      <>
                        {replaced.length > 0 &&
                          `Al continuar se reemplazarán únicamente los campos que puedan completarse con el Cliente seleccionado: ${replaced.join(", ")}.`}
                        {replaced.length > 0 && confirmation.clearedFields.length > 0 && " "}
                        {confirmation.clearedFields.length > 0 &&
                          `Se vaciarán porque no aplican a una persona jurídica: ${confirmation.clearedFields.join(", ")}. `}
                        {confirmation.missingFields.length > 0 &&
                          `Se vaciarán porque el Cliente seleccionado no tiene ese dato: ${confirmation.missingFields.join(", ")}.`}
                      </>
                    );
                  })()}
                </p>
              </div>
              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={cancelOverwrite}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmOverwrite}
                  className="flex-1 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  {confirmation.overwriteFields.length > 0
                    ? "Reemplazar campos"
                    : "Cambiar cliente"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
