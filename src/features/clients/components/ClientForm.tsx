"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createClientAction,
  updateClientAction,
} from "../server/actions";
import type { ClientState } from "../model/action-state";
import type { ClientRow } from "../model/types";
import { ClientFields } from "./ClientFields";
import { DeleteClientButton } from "./DeleteClientButton";

// ------------------------------------------------------------------ props

type Props =
  | { mode: "create" }
  | { mode: "edit"; client: ClientRow; canWrite: boolean };

const initialState: ClientState = {};

// ------------------------------------------------------------------ component

export function ClientForm(props: Props) {
  const isEdit = props.mode === "edit";
  const client = isEdit ? props.client : null;
  // El modo "create" solo se alcanza si la página ya validó clients.write
  // (ver /clients/new); "edit" sí puede llegar aquí con
  // canWrite=false, porque la página de detalle es de lectura para
  // cualquier miembro activo.
  const canWrite = isEdit ? props.canWrite : true;

  const action = isEdit
    ? updateClientAction.bind(null, client!.id)
    : createClientAction;

  // Éxito nunca resuelve en cliente: `createClientAction`/`updateClientAction`
  // redirigen server-side antes de que este componente pudiera leer
  // `state.success` — el toast de confirmación lo dispara
  // `ClientLifecycleToast` en la página de listado tras el redirect
  // (`?event=created|updated`), no un efecto aquí.
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ---- Card header ---- */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent-700"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Información básica
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios.
          </p>
        </div>
        {isEdit && client && canWrite && (
          <div className="ml-auto shrink-0">
            <DeleteClientButton
              clientId={client.id}
              clientName={client.full_name}
              variant="icon"
            />
          </div>
        )}
      </div>

      {/* ---- Form body ---- */}
      <form action={formAction} noValidate className="px-6 py-6">
        {!canWrite && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
          >
            Tu rol no permite editar clientes. Lo ves en modo lectura.
          </div>
        )}
        {/* Global feedback */}
        {state.message && !state.success && !state.errors && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <div className="space-y-5">
          <ClientFields
            client={client}
            errors={state.errors}
            disabled={!canWrite}
          />
        </div>

        {/* ---- Buttons ---- */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <Link
            href="/clients"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </Link>
          {canWrite && (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Guardando…
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear cliente"
            )}
          </button>
          )}
        </div>
      </form>
    </div>
  );
}
