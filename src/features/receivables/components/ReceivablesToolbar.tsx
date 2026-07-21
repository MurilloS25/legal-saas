"use client";

/**
 * Controles de búsqueda, filtros y orden del workspace de cuentas por cobrar.
 * Todo se refleja en query params (compartibles, sobreviven al reload); el
 * servidor filtra. Cualquier cambio reinicia la paginación a 1.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

type Patch = {
  search?: string;
  status?: string | null;
  currency?: string | null;
  doc?: string | null;
  client?: string | null;
  issued_from?: string | null;
  issued_to?: string | null;
  due_from?: string | null;
  due_to?: string | null;
  sort?: string;
};

type Props = {
  initial: {
    search: string;
    status: string | null;
    currency: string | null;
    docPresence: string | null;
    clientId: string | null;
    issuedFrom: string | null;
    issuedTo: string | null;
    dueFrom: string | null;
    dueTo: string | null;
    sort: string;
  };
  clients: { id: string; full_name: string }[];
  statusOptions: Option[];
  currencyOptions: Option[];
  sortOptions: Option[];
  hasActiveFilters: boolean;
};

const controlClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";
const fieldLabel = "block text-xs font-medium text-slate-600 mb-1";

const DEFAULT_SORT = "recent";

export function ReceivablesToolbar({
  initial,
  clients,
  statusOptions,
  currencyOptions,
  sortOptions,
  hasActiveFilters,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.search);

  function navigate(patch: Patch) {
    const merged = {
      search: (patch.search ?? initial.search).trim(),
      status: patch.status !== undefined ? patch.status : initial.status,
      currency:
        patch.currency !== undefined ? patch.currency : initial.currency,
      doc: patch.doc !== undefined ? patch.doc : initial.docPresence,
      client: patch.client !== undefined ? patch.client : initial.clientId,
      issued_from:
        patch.issued_from !== undefined ? patch.issued_from : initial.issuedFrom,
      issued_to:
        patch.issued_to !== undefined ? patch.issued_to : initial.issuedTo,
      due_from: patch.due_from !== undefined ? patch.due_from : initial.dueFrom,
      due_to: patch.due_to !== undefined ? patch.due_to : initial.dueTo,
      sort: patch.sort ?? initial.sort,
    };

    const params = new URLSearchParams();
    if (merged.search) params.set("search", merged.search);
    if (merged.status) params.set("status", merged.status);
    if (merged.currency) params.set("currency", merged.currency);
    if (merged.doc) params.set("doc", merged.doc);
    if (merged.client) params.set("client", merged.client);
    if (merged.issued_from) params.set("issued_from", merged.issued_from);
    if (merged.issued_to) params.set("issued_to", merged.issued_to);
    if (merged.due_from) params.set("due_from", merged.due_from);
    if (merged.due_to) params.set("due_to", merged.due_to);
    if (merged.sort && merged.sort !== DEFAULT_SORT) params.set("sort", merged.sort);

    const qs = params.toString();
    router.push(qs ? `/dashboard/receivables?${qs}` : "/dashboard/receivables");
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {/* Búsqueda */}
        <form
          className="flex-1 min-w-[12rem]"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search });
          }}
        >
          <label htmlFor="rec-search" className={fieldLabel}>
            Buscar
          </label>
          <div className="flex gap-2">
            <input
              id="rec-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Concepto, cliente o escritura"
              className={`${controlClass} w-full`}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Estado */}
        <div>
          <label htmlFor="rec-status" className={fieldLabel}>
            Estado
          </label>
          <select
            id="rec-status"
            value={initial.status ?? ""}
            onChange={(e) => navigate({ status: e.target.value || null })}
            className={controlClass}
          >
            <option value="">Todos</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Moneda */}
        <div>
          <label htmlFor="rec-currency" className={fieldLabel}>
            Moneda
          </label>
          <select
            id="rec-currency"
            value={initial.currency ?? ""}
            onChange={(e) => navigate({ currency: e.target.value || null })}
            className={controlClass}
          >
            <option value="">Todas</option>
            {currencyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Escritura (con / sin) */}
        <div>
          <label htmlFor="rec-doc" className={fieldLabel}>
            Escritura
          </label>
          <select
            id="rec-doc"
            value={initial.docPresence ?? ""}
            onChange={(e) => navigate({ doc: e.target.value || null })}
            className={controlClass}
          >
            <option value="">Todas</option>
            <option value="with">Con escritura</option>
            <option value="without">Sin escritura</option>
          </select>
        </div>

        {/* Cliente */}
        <div>
          <label htmlFor="rec-client" className={fieldLabel}>
            Cliente
          </label>
          <select
            id="rec-client"
            value={initial.clientId ?? ""}
            onChange={(e) => navigate({ client: e.target.value || null })}
            className={controlClass}
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Orden */}
        <div>
          <label htmlFor="rec-sort" className={fieldLabel}>
            Orden
          </label>
          <select
            id="rec-sort"
            value={initial.sort}
            onChange={(e) => navigate({ sort: e.target.value })}
            className={controlClass}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rangos de fecha */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label htmlFor="rec-issued-from" className={fieldLabel}>
            Emitidas desde
          </label>
          <input
            id="rec-issued-from"
            type="date"
            defaultValue={initial.issuedFrom ?? ""}
            onChange={(e) => navigate({ issued_from: e.target.value || null })}
            className={controlClass}
          />
        </div>
        <div>
          <label htmlFor="rec-issued-to" className={fieldLabel}>
            Emitidas hasta
          </label>
          <input
            id="rec-issued-to"
            type="date"
            defaultValue={initial.issuedTo ?? ""}
            onChange={(e) => navigate({ issued_to: e.target.value || null })}
            className={controlClass}
          />
        </div>
        <div>
          <label htmlFor="rec-due-from" className={fieldLabel}>
            Vencen desde
          </label>
          <input
            id="rec-due-from"
            type="date"
            defaultValue={initial.dueFrom ?? ""}
            onChange={(e) => navigate({ due_from: e.target.value || null })}
            className={controlClass}
          />
        </div>
        <div>
          <label htmlFor="rec-due-to" className={fieldLabel}>
            Vencen hasta
          </label>
          <input
            id="rec-due-to"
            type="date"
            defaultValue={initial.dueTo ?? ""}
            onChange={(e) => navigate({ due_to: e.target.value || null })}
            className={controlClass}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              router.push("/dashboard/receivables");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
