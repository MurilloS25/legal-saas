"use client";

/**
 * Controles del workspace del índice notarial: búsqueda, rango de fechas,
 * completitud, tipo de acto y orden. Reflejados en query params (server-side).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

type Props = {
  initial: {
    search: string;
    completeness: string | null;
    actType: string | null;
    from: string | null;
    to: string | null;
    sort: string;
  };
  actTypes: string[];
  sortOptions: Option[];
  hasActiveFilters: boolean;
};

const controlClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";
const DEFAULT_SORT = "recent";

export function NotarialToolbar({
  initial,
  actTypes,
  sortOptions,
  hasActiveFilters,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.search);

  function navigate(next: Partial<Props["initial"]>) {
    const merged = { ...initial, search, ...next };
    const params = new URLSearchParams();
    if (merged.search.trim()) params.set("search", merged.search.trim());
    if (merged.completeness) params.set("completeness", merged.completeness);
    if (merged.actType) params.set("act_type", merged.actType);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.sort && merged.sort !== DEFAULT_SORT) params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(qs ? `/dashboard/notarial-index?${qs}` : "/dashboard/notarial-index");
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        className="flex-1 min-w-[12rem]"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({});
        }}
      >
        <label htmlFor="ni-search" className="block text-xs font-medium text-slate-600 mb-1">
          Buscar
        </label>
        <div className="flex gap-2">
          <input
            id="ni-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, tipo, comparecientes"
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

      <div>
        <label htmlFor="ni-from" className="block text-xs font-medium text-slate-600 mb-1">
          Desde
        </label>
        <input
          id="ni-from"
          type="date"
          defaultValue={initial.from ?? ""}
          onChange={(e) => navigate({ from: e.target.value || null })}
          className={controlClass}
        />
      </div>

      <div>
        <label htmlFor="ni-to" className="block text-xs font-medium text-slate-600 mb-1">
          Hasta
        </label>
        <input
          id="ni-to"
          type="date"
          defaultValue={initial.to ?? ""}
          onChange={(e) => navigate({ to: e.target.value || null })}
          className={controlClass}
        />
      </div>

      <div>
        <label htmlFor="ni-completeness" className="block text-xs font-medium text-slate-600 mb-1">
          Completitud
        </label>
        <select
          id="ni-completeness"
          value={initial.completeness ?? ""}
          onChange={(e) => navigate({ completeness: e.target.value || null })}
          className={controlClass}
        >
          <option value="">Todas</option>
          <option value="complete">Completo</option>
          <option value="incomplete">Incompleto</option>
          <option value="missing">Sin datos</option>
        </select>
      </div>

      <div>
        <label htmlFor="ni-act" className="block text-xs font-medium text-slate-600 mb-1">
          Tipo de acto
        </label>
        <select
          id="ni-act"
          value={initial.actType ?? ""}
          onChange={(e) => navigate({ actType: e.target.value || null })}
          className={controlClass}
        >
          <option value="">Todos</option>
          {actTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ni-sort" className="block text-xs font-medium text-slate-600 mb-1">
          Orden
        </label>
        <select
          id="ni-sort"
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

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push("/dashboard/notarial-index");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
