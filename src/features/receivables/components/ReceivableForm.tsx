"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createReceivableAction,
  updateReceivableAction,
  type ReceivableState,
} from "../server/actions";
import type {
  ClientOption,
  DocumentOption,
  ReceivableRow,
} from "../model/types";
import { RECEIVABLE_CURRENCIES } from "../model/status";
import { CLIENT_MODES, type ClientMode } from "../model/receivables";
import { FieldError } from "@/components/forms/FieldError";
import { CreateClientDialog, type CreatedClient } from "@/features/clients";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const requiredMark = (
  <span aria-hidden="true" className="text-red-500 ml-0.5">
    *
  </span>
);

type Props = {
  clients: ClientOption[];
  documents: DocumentOption[];
} & (
  | {
      mode: "create";
      defaults?: { client_id?: string; document_id?: string };
      /** Ruta ya validada (ver context-return.ts) para volver a la
       * Escritura de origen; ausente cuando se crea desde otro lugar. */
      returnTo?: string | null;
    }
  | { mode: "edit"; receivable: ReceivableRow }
);

const initialState: ReceivableState = {};

export function ReceivableForm(props: Props) {
  const isEdit = props.mode === "edit";
  const receivable = isEdit ? props.receivable : null;
  const defaults = !isEdit ? props.defaults : undefined;
  const returnTo = !isEdit ? (props.returnTo ?? null) : null;

  const action = isEdit
    ? updateReceivableAction.bind(null, receivable!.id)
    : createReceivableAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [clientMode, setClientMode] = useState<ClientMode>(() =>
    isEdit && !receivable!.client_id ? "free" : "registered",
  );
  const [clientId, setClientId] = useState<string>(
    receivable?.client_id ?? defaults?.client_id ?? "",
  );
  const [clientOptions, setClientOptions] = useState<ClientOption[]>(
    props.clients,
  );

  // El cliente creado desde el diálogo contextual queda seleccionado de
  // inmediato, sin recargar la página ni tocar el resto del formulario.
  function handleClientCreated(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
    setClientId(client.id);
  }

  // Solo se ofrecen Escrituras del cliente seleccionado (o sin cliente),
  // para no vincular una cuenta a una Escritura de otra persona.
  const availableDocuments = useMemo(() => {
    if (!clientId) return props.documents;
    return props.documents.filter(
      (d) => d.client_id === clientId || d.client_id === null,
    );
  }, [clientId, props.documents]);

  const defaultDocumentId =
    receivable?.document_id ?? defaults?.document_id ?? "";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Datos de la cuenta
          </p>
          <p className="text-xs text-slate-500">
            Los campos marcados con{" "}
            <span aria-hidden="true" className="text-red-500 font-semibold">
              *
            </span>{" "}
            son obligatorios.
          </p>
        </div>
      </div>

      <form action={formAction} noValidate className="px-6 py-6">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        {state.message && !state.errors && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <div className="space-y-5">
          {/* Cliente */}
          <div>
            <p className={labelClass}>Cliente de la cuenta{requiredMark}</p>
            <div
              role="radiogroup"
              aria-label="Cliente de la cuenta"
              className="mb-3 flex flex-wrap gap-4"
            >
              {CLIENT_MODES.map((mode) => (
                <label
                  key={mode}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="client_mode"
                    value={mode}
                    checked={clientMode === mode}
                    onChange={() => setClientMode(mode)}
                    className="h-4 w-4 border-slate-300 text-accent-700 focus:ring-accent-500"
                  />
                  {mode === "registered" ? "Cliente registrado" : "Escribir nombre"}
                </label>
              ))}
            </div>

            {clientMode === "registered" ? (
              <>
                <label htmlFor="client_id" className="sr-only">
                  Cliente
                </label>
                <select
                  id="client_id"
                  name="client_id"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputClass}
                  aria-describedby={
                    state.errors?.client_id ? "client_id-error" : undefined
                  }
                  aria-invalid={!!state.errors?.client_id}
                >
                  <option value="" disabled>
                    Seleccionar cliente…
                  </option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="client_id-error"
                  message={state.errors?.client_id}
                />
                <div className="mt-2">
                  <CreateClientDialog onCreated={handleClientCreated} />
                </div>
              </>
            ) : (
              <>
                <label htmlFor="client_name" className="sr-only">
                  Nombre del cliente
                </label>
                <input
                  id="client_name"
                  name="client_name"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={
                    isEdit && !receivable!.client_id
                      ? receivable!.client_name_snapshot
                      : ""
                  }
                  className={inputClass}
                  placeholder="Nombre del cliente"
                  aria-describedby={
                    state.errors?.client_name ? "client_name-error" : undefined
                  }
                  aria-invalid={!!state.errors?.client_name}
                />
                <FieldError
                  id="client_name-error"
                  message={state.errors?.client_name}
                />
              </>
            )}
          </div>

          {/* Escritura */}
          <div>
            <label htmlFor="document_id" className={labelClass}>
              Escritura{" "}
              <span className="text-xs font-normal text-slate-400">
                (opcional)
              </span>
            </label>
            <select
              id="document_id"
              name="document_id"
              defaultValue={defaultDocumentId}
              className={inputClass}
              aria-describedby={
                state.errors?.document_id ? "document_id-error" : undefined
              }
              aria-invalid={!!state.errors?.document_id}
            >
              <option value="">Sin escritura</option>
              {availableDocuments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <FieldError
              id="document_id-error"
              message={state.errors?.document_id}
            />
          </div>

          {/* Concepto */}
          <div>
            <label htmlFor="concept" className={labelClass}>
              Concepto{requiredMark}
            </label>
            <input
              id="concept"
              name="concept"
              type="text"
              required
              maxLength={200}
              defaultValue={receivable?.concept ?? ""}
              className={inputClass}
              placeholder="Honorarios por escritura de compraventa"
              aria-describedby={
                state.errors?.concept ? "concept-error" : undefined
              }
              aria-invalid={!!state.errors?.concept}
            />
            <FieldError id="concept-error" message={state.errors?.concept} />
          </div>

          {/* Moneda + Monto */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="currency" className={labelClass}>
                Moneda{requiredMark}
              </label>
              <select
                id="currency"
                name="currency"
                required
                defaultValue={receivable?.currency ?? "CRC"}
                className={inputClass}
                aria-describedby={
                  state.errors?.currency ? "currency-error" : undefined
                }
                aria-invalid={!!state.errors?.currency}
              >
                {RECEIVABLE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code === "CRC" ? "Colones (CRC)" : "Dólares (USD)"}
                  </option>
                ))}
              </select>
              <FieldError
                id="currency-error"
                message={state.errors?.currency}
              />
            </div>

            <div>
              <label htmlFor="amount_total" className={labelClass}>
                Monto total{requiredMark}
              </label>
              <input
                id="amount_total"
                name="amount_total"
                type="text"
                inputMode="decimal"
                required
                defaultValue={receivable?.amount_total ?? ""}
                className={inputClass}
                placeholder="150000.00"
                aria-describedby={
                  state.errors?.amount_total
                    ? "amount_total-error"
                    : "amount_total-hint"
                }
                aria-invalid={!!state.errors?.amount_total}
              />
              {state.errors?.amount_total ? (
                <FieldError
                  id="amount_total-error"
                  message={state.errors.amount_total}
                />
              ) : (
                <p id="amount_total-hint" className="mt-1 text-xs text-slate-400">
                  Hasta dos decimales. Sin conversión entre monedas.
                </p>
              )}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="issued_at" className={labelClass}>
                Fecha de emisión{requiredMark}
              </label>
              <input
                id="issued_at"
                name="issued_at"
                type="date"
                required
                defaultValue={receivable?.issued_at ?? today()}
                className={inputClass}
                aria-describedby={
                  state.errors?.issued_at ? "issued_at-error" : undefined
                }
                aria-invalid={!!state.errors?.issued_at}
              />
              <FieldError
                id="issued_at-error"
                message={state.errors?.issued_at}
              />
            </div>

            <div>
              <label htmlFor="due_at" className={labelClass}>
                Vencimiento{" "}
                <span className="text-xs font-normal text-slate-400">
                  (opcional)
                </span>
              </label>
              <input
                id="due_at"
                name="due_at"
                type="date"
                defaultValue={receivable?.due_at ?? ""}
                className={inputClass}
                aria-describedby={
                  state.errors?.due_at ? "due_at-error" : undefined
                }
                aria-invalid={!!state.errors?.due_at}
              />
              <FieldError id="due_at-error" message={state.errors?.due_at} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="notes" className={labelClass}>
              Notas internas{" "}
              <span className="text-xs font-normal text-slate-400">
                (opcional)
              </span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={receivable?.notes ?? ""}
              className={inputClass}
              placeholder="Acuerdo de pago, referencias, recordatorios…"
              aria-describedby={state.errors?.notes ? "notes-error" : undefined}
              aria-invalid={!!state.errors?.notes}
            />
            <FieldError id="notes-error" message={state.errors?.notes} />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <Link
            href={returnTo ?? "/dashboard/receivables"}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}

function today(): string {
  // Fecha local en formato YYYY-MM-DD para el valor por defecto de emisión.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
