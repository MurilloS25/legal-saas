"use client";

/**
 * Controles de búsqueda, filtros y orden del workspace de Escrituras.
 *
 * Todo se refleja en query params (compartibles, sobreviven al reload); el
 * servidor hace el filtrado. Al cambiar cualquier control se reinicia la
 * página a 1. La búsqueda se envía con Enter o el botón; los selects se
 * aplican al cambiar.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

type Props = {
  initial: {
    search: string;
    status: string | null;
    clientId: string | null;
    templateId: string | null;
    sort: string;
  };
  clients: { id: string; full_name: string }[];
  templates: { id: string; name: string }[];
  statusOptions: Option[];
  sortOptions: Option[];
  hasActiveFilters: boolean;
};

const controlClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";

const DEFAULT_SORT = "recent";

export function DocumentsToolbar({
  initial,
  clients,
  templates,
  statusOptions,
  sortOptions,
  hasActiveFilters,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.search);

  function navigate(next: {
    search?: string;
    status?: string | null;
    client?: string | null;
    template?: string | null;
    sort?: string;
  }) {
    const params = new URLSearchParams();
    const search_ = (next.search ?? initial.search).trim();
    const status_ = next.status !== undefined ? next.status : initial.status;
    const client_ = next.client !== undefined ? next.client : initial.clientId;
    const template_ =
      next.template !== undefined ? next.template : initial.templateId;
    const sort_ = next.sort ?? initial.sort;

    if (search_) params.set("search", search_);
    if (status_) params.set("status", status_);
    if (client_) params.set("client", client_);
    if (template_) params.set("template", template_);
    if (sort_ && sort_ !== DEFAULT_SORT) params.set("sort", sort_);
    // Cualquier cambio reinicia la paginación (no se conserva `page`).

    const qs = params.toString();
    router.push(qs ? `/dashboard/documents?${qs}` : "/dashboard/documents");
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {/* Búsqueda */}
      <form
        className="flex-1 min-w-[12rem]"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search });
        }}
        role="search"
      >
        <label
          htmlFor="documents-search"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Buscar
        </label>
        <div className="flex gap-2">
          <input
            id="documents-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Título, cliente o machote"
            className={`${controlClass} w-full`}
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* Estado */}
      <div>
        <label
          htmlFor="documents-status"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Estado
        </label>
        <select
          id="documents-status"
          value={initial.status ?? ""}
          onChange={(event) =>
            navigate({ status: event.target.value || null })
          }
          className={controlClass}
        >
          <option value="">Todos</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cliente */}
      <div>
        <label
          htmlFor="documents-client"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Cliente
        </label>
        <select
          id="documents-client"
          value={initial.clientId ?? ""}
          onChange={(event) =>
            navigate({ client: event.target.value || null })
          }
          className={controlClass}
        >
          <option value="">Todos</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Machote */}
      <div>
        <label
          htmlFor="documents-template"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Machote
        </label>
        <select
          id="documents-template"
          value={initial.templateId ?? ""}
          onChange={(event) =>
            navigate({ template: event.target.value || null })
          }
          className={controlClass}
        >
          <option value="">Todos</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {/* Orden */}
      <div>
        <label
          htmlFor="documents-sort"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Orden
        </label>
        <select
          id="documents-sort"
          value={initial.sort}
          onChange={(event) => navigate({ sort: event.target.value })}
          className={controlClass}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push("/dashboard/documents");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
