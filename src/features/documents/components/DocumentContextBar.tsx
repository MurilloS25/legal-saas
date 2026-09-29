"use client";

/**
 * Tira compacta de contexto de la Escritura: un chip por Cliente principal y
 * uno por cada rol autollenable ("Partes"), cada uno con su propio popover.
 *
 * No reemplaza ninguna lógica real — envuelve exactamente lo que ya existía
 * en `DocumentFormPanel`/`RoleAutofillPanel`: el `<select>` de Cliente
 * principal + `CreateClientDialog`, y por cada rol el combobox de
 * autollenado + confirmación de sobrescritura (`RoleAutofillFields`). Los
 * mismos handlers (`onClientChange`, `onClientCreated`, `onApplyRoleAutofill`)
 * se pasan sin cambios desde el compositor.
 *
 * Crear un Cliente nuevo desde el chip de una Parte nunca lo convierte en
 * Cliente principal — solo alimenta ese rol (ver `RoleAutofillFields`).
 */

import type { CreatedClient } from "@/features/clients";
import { CreateClientDialog } from "@/features/clients";
import { useState } from "react";
import { Popover } from "@/components/document/Popover";
import type { DocumentClientOption, RoleVariableGroup } from "../model/role-autofill";
import { RoleAutofillFields, roleLabel } from "./RoleAutofillPanel";

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-60";

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type Props = {
  clientId: string;
  clients: DocumentClientOption[];
  roleGroups: RoleVariableGroup[];
  values: Record<string, string>;
  readOnly: boolean;
  onClientChange: (value: string) => void;
  /** Crea el Cliente Y lo fija como Cliente principal — solo para ese chip. */
  onClientCreated: (client: CreatedClient) => void;
  /** Solo registra el Cliente en la lista compartida, sin tocar el Cliente
   * principal — usado por los chips de Partes, para no convertir nunca a un
   * rol en el Cliente principal de la Escritura. */
  onClientRegistered: (client: CreatedClient) => void;
  onApplyRoleAutofill: (fieldValues: Record<string, string>) => void;
};

export function DocumentContextBar({
  clientId,
  clients,
  roleGroups,
  values,
  readOnly,
  onClientChange,
  onClientCreated,
  onClientRegistered,
  onApplyRoleAutofill,
}: Props) {
  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const autofillableGroups = roleGroups.filter((group) => group.hasClientAutofill);
  // Cliente asignado por Parte: referencia visual de la sesión. Vive aquí (no
  // en el popover, que desmonta su contenido al cerrarse) para que el chip lo
  // muestre siempre. Se guarda solo el id y se resuelve contra la lista
  // compartida de Clientes.
  const [assignedIds, setAssignedIds] = useState<Record<string, string>>({});

  return (
    <section aria-label="Cliente principal y Partes" className="flex flex-wrap gap-2">
      {/* El `<select>` real vive dentro del popover, que solo monta su
          contenido mientras está abierto — este input oculto, siempre
          montado, es la única fuente real de `client_id` en el FormData. */}
      <input type="hidden" name="client_id" value={clientId} />
      <Popover
        panelLabel="Seleccionar o cambiar Cliente principal"
        triggerClassName={chipClass}
        triggerLabel={
          <>
            {selectedClient ? (
              <>
                Cliente principal: {selectedClient.full_name}
                <ChevronIcon />
              </>
            ) : (
              <>Cliente principal +</>
            )}
          </>
        }
      >
        {() => (
          <div>
            <label htmlFor="context-bar-client" className="mb-1 block text-xs font-medium text-slate-700">
              Cliente principal <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <select
              id="context-bar-client"
              value={clientId}
              aria-label="Cliente principal"
              disabled={readOnly}
              onChange={(event) => onClientChange(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
            >
              <option value="">Sin cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
            {!readOnly && (
              <div className="mt-2">
                <CreateClientDialog onCreated={onClientCreated} />
              </div>
            )}
          </div>
        )}
      </Popover>

      {autofillableGroups.map((group) => {
        const complete = group.variables.every(
          (variable) => (values[variable.field_key] ?? "").trim() !== "",
        );
        const label = roleLabel(group.role);
        const assignedId = assignedIds[group.role];
        const assigned =
          (assignedId && clients.find((client) => client.id === assignedId)) ||
          null;
        return (
          <Popover
            key={group.role}
            panelLabel={`Completar ${label} desde un Cliente registrado`}
            triggerClassName={chipClass}
            triggerLabel={
              assigned ? (
                <>
                  <span>{label}:</span>
                  <span className="max-w-[12rem] truncate font-normal">
                    {assigned.full_name}
                  </span>
                  <ChevronIcon />
                </>
              ) : complete ? (
                <>
                  {label}
                  <ChevronIcon />
                </>
              ) : (
                <>{label} +</>
              )
            }
          >
            {() => (
              <RoleAutofillFields
                group={group}
                clients={clients}
                values={values}
                readOnly={readOnly}
                assignedClient={assigned}
                onAssign={(client) =>
                  setAssignedIds((current) => {
                    const next = { ...current };
                    if (client) next[group.role] = client.id;
                    else delete next[group.role];
                    return next;
                  })
                }
                onApply={onApplyRoleAutofill}
                onClientCreated={onClientRegistered}
              />
            )}
          </Popover>
        );
      })}
    </section>
  );
}
