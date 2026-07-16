"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FortnightSelection } from "../model/fortnight";

type Props = {
  initial: {
    search: string;
    completeness: string | null;
    actType: string | null;
    selection: FortnightSelection;
  };
  actTypes: string[];
  hasActiveFilters: boolean;
};

const controlClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function NotarialToolbar({ initial, actTypes, hasActiveFilters }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.search);

  function navigate(next: {
    search?: string;
    completeness?: string | null;
    actType?: string | null;
    selection?: FortnightSelection;
  }) {
    const merged = { ...initial, search, ...next };
    const params = new URLSearchParams({
      year: String(merged.selection.year),
      month: String(merged.selection.month),
      half: merged.selection.half,
    });
    if (merged.search.trim()) params.set("search", merged.search.trim());
    if (merged.completeness) params.set("completeness", merged.completeness);
    if (merged.actType) params.set("act_type", merged.actType);
    router.push(`/dashboard/notarial-index?${params.toString()}`);
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ni-year" className="mb-1 block text-xs font-medium text-slate-600">
            Año
          </label>
          <input
            id="ni-year"
            type="number"
            min={2000}
            max={2100}
            value={initial.selection.year}
            onChange={(event) => {
              const year = Number(event.target.value);
              if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
                navigate({ selection: { ...initial.selection, year } });
              }
            }}
            className={`${controlClass} w-full`}
          />
        </div>
        <div>
          <label htmlFor="ni-month" className="mb-1 block text-xs font-medium text-slate-600">
            Mes
          </label>
          <select
            id="ni-month"
            value={initial.selection.month}
            onChange={(event) =>
              navigate({
                selection: {
                  ...initial.selection,
                  month: Number(event.target.value),
                },
              })
            }
            className={`${controlClass} w-full`}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ni-half" className="mb-1 block text-xs font-medium text-slate-600">
            Quincena
          </label>
          <select
            id="ni-half"
            value={initial.selection.half}
            onChange={(event) =>
              navigate({
                selection: {
                  ...initial.selection,
                  half:
                    event.target.value === "SECOND_HALF"
                      ? "SECOND_HALF"
                      : "FIRST_HALF",
                },
              })
            }
            className={`${controlClass} w-full`}
          >
            <option value="FIRST_HALF">Primera quincena (1–15)</option>
            <option value="SECOND_HALF">Segunda quincena (16–fin)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <form
          className="min-w-[12rem] flex-1"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({});
          }}
        >
          <label htmlFor="ni-search" className="mb-1 block text-xs font-medium text-slate-600">
            Buscar
          </label>
          <div className="flex gap-2">
            <input
              id="ni-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, acto, partes"
              className={`${controlClass} w-full`}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              Buscar
            </button>
          </div>
        </form>

        <div>
          <label htmlFor="ni-completeness" className="mb-1 block text-xs font-medium text-slate-600">
            Completitud
          </label>
          <select
            id="ni-completeness"
            value={initial.completeness ?? ""}
            onChange={(event) =>
              navigate({ completeness: event.target.value || null })
            }
            className={controlClass}
          >
            <option value="">Todas</option>
            <option value="complete">Completo</option>
            <option value="incomplete">Incompleto</option>
            <option value="missing">Sin datos</option>
          </select>
        </div>

        <div>
          <label htmlFor="ni-act" className="mb-1 block text-xs font-medium text-slate-600">
            Acto o contrato
          </label>
          <select
            id="ni-act"
            value={initial.actType ?? ""}
            onChange={(event) => navigate({ actType: event.target.value || null })}
            className={controlClass}
          >
            <option value="">Todos</option>
            {actTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              navigate({ search: "", completeness: null, actType: null });
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
