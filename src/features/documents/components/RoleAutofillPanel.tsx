"use client";

/**
 * Autollenado por rol en la Escritura: para cada rol (`rol.dato`) con al
 * menos una variable configurada con origen de Cliente, permite elegir un
 * Cliente registrado y copiar sus datos hacia las variables del rol.
 *
 * El Cliente elegido aquí es solo una referencia visual ("Datos copiados
 * desde: X"): no crea ninguna relación formal, no reemplaza el Cliente
 * principal de la Escritura y no dispara actualizaciones futuras. Todos los
 * campos copiados quedan editables de inmediato.
 */

import { useId, useState } from "react";
import type { RoleVariableGroup, DocumentClientOption } from "../model/role-autofill";
import { fieldsToOverwrite, mapClientToRoleVariables } from "../model/role-autofill";

type PendingConfirmation = {
  role: string;
  client: DocumentClientOption;
  values: Record<string, string>;
  overwriteFields: string[];
};

type Props = {
  groups: RoleVariableGroup[];
  clients: DocumentClientOption[];
  values: Record<string, string>;
  readOnly: boolean;
  onApply: (fieldValues: Record<string, string>) => void;
};

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).replaceAll("_", " ");
}

function RoleBlock({
  group,
  clients,
  values,
  readOnly,
  onApply,
}: {
  group: RoleVariableGroup;
  clients: DocumentClientOption[];
  values: Record<string, string>;
  readOnly: boolean;
  onApply: (fieldValues: Record<string, string>) => void;
}) {
  const selectId = useId();
  const [referenceClient, setReferenceClient] = useState<DocumentClientOption | null>(
    null,
  );
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  function selectClient(clientId: string) {
    if (clientId === "") return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const result = mapClientToRoleVariables(client, group.variables);
    const overwriteFields = fieldsToOverwrite(result.values, values);

    setIncomplete(result.incomplete);
    if (overwriteFields.length > 0) {
      setConfirmation({
        role: group.role,
        client,
        values: result.values,
        overwriteFields,
      });
      return;
    }

    onApply(result.values);
    setReferenceClient(client);
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

  const dialogTitleId = `${selectId}-confirm-title`;
  const dialogDescId = `${selectId}-confirm-desc`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-3">
      <h3 className="text-sm font-semibold text-slate-900">
        {roleLabel(group.role)}
      </h3>
      <label htmlFor={selectId} className="mt-1.5 block text-xs text-slate-600">
        Completar desde Cliente registrado
      </label>
      <select
        id={selectId}
        value=""
        disabled={readOnly}
        onChange={(event) => selectClient(event.target.value)}
        className={`${selectClass} mt-1`}
      >
        <option value="">Seleccionar Cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.full_name}
          </option>
        ))}
      </select>

      {referenceClient && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Datos copiados desde: {referenceClient.full_name}
          </p>
          <button
            type="button"
            onClick={() => setReferenceClient(null)}
            className="text-xs font-medium text-accent-700 hover:underline focus:outline-none focus:ring-2 focus:ring-accent-500 rounded"
          >
            Quitar referencia de autollenado
          </button>
        </div>
      )}

      {incomplete.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Algunos campos no se pudieron completar: {incomplete.join(", ")}.
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
                  Este rol ya tiene información
                </h2>
                <p
                  id={dialogDescId}
                  className="text-sm text-slate-600 leading-relaxed"
                >
                  ¿Deseas reemplazar los campos disponibles con los datos del
                  Cliente seleccionado? Se reemplazarán:{" "}
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
                  Reemplazar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function RoleAutofillPanel({ groups, clients, values, readOnly, onApply }: Props) {
  if (groups.length === 0 || clients.length === 0) return null;

  return (
    <section aria-label="Autollenado por rol" className="space-y-3">
      {groups.map((group) => (
        <RoleBlock
          key={group.role}
          group={group}
          clients={clients}
          values={values}
          readOnly={readOnly}
          onApply={(fieldValues) => onApply(fieldValues)}
        />
      ))}
    </section>
  );
}
