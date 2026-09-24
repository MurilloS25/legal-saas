"use client";

/**
 * "Completar desde Clientes": para cada rol (`rol.dato`) detectado —
 * automáticamente por alias conocidos o por configuración explícita del
 * Machote— muestra un selector searchable de Cliente y copia sus datos
 * hacia las variables de ese rol.
 *
 * El Cliente elegido aquí es solo una referencia visual de la sesión
 * ("Datos copiados desde Cliente: X"): no crea ninguna relación formal, no
 * reemplaza el Cliente principal de la Escritura y no dispara
 * actualizaciones futuras. Todos los campos copiados quedan editables de
 * inmediato; al recargar persisten los valores, no la selección visual.
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
import { fieldsToOverwrite, mapClientToRoleVariables } from "../model/role-autofill";
import { ClientCombobox } from "./ClientCombobox";

type PendingConfirmation = {
  client: DocumentClientOption;
  values: Record<string, string>;
  overwriteFields: string[];
};

type Props = {
  group: RoleVariableGroup;
  clients: DocumentClientOption[];
  values: Record<string, string>;
  readOnly: boolean;
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
  onApply,
  onClientCreated,
}: Props) {
  const dialogId = useId();
  const [referenceClient, setReferenceClient] = useState<DocumentClientOption | null>(
    null,
  );
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [notApplicable, setNotApplicable] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  function handleSelect(client: DocumentClientOption) {
    const result = mapClientToRoleVariables(client, group.variables);
    const overwriteFields = fieldsToOverwrite(result.values, values);

    setIncomplete(result.incomplete);
    setNotApplicable(result.notApplicable);
    if (overwriteFields.length > 0) {
      setConfirmation({ client, values: result.values, overwriteFields });
      return;
    }

    onApply(result.values);
    setReferenceClient(client);
  }

  function handleCreated(client: CreatedClient) {
    onClientCreated(client);
    handleSelect(client);
  }

  function confirmOverwrite() {
    if (!confirmation) return;
    onApply(confirmation.values);
    setReferenceClient(confirmation.client);
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
        selectedClient={referenceClient}
        disabled={readOnly}
        label="Completar desde Cliente registrado"
        onSelect={handleSelect}
        onClear={() => setReferenceClient(null)}
      />

      {!readOnly && (
        <div className="mt-2">
          <CreateClientDialog onCreated={handleCreated} />
        </div>
      )}

      {referenceClient && (
        <p className="mt-2 text-xs text-slate-500">
          Datos copiados desde Cliente: {referenceClient.full_name}
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
                  Este rol ya contiene información
                </h2>
                <p
                  id={dialogDescId}
                  className="text-sm text-slate-600 leading-relaxed"
                >
                  Al continuar se reemplazarán únicamente los campos que
                  puedan completarse con el Cliente seleccionado:{" "}
                  {confirmation.overwriteFields.join(", ")}.
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
                  Reemplazar campos
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
