"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FortnightSelection } from "../model/fortnight";
import {
  applyNotarialNavigationChanges,
  type NotarialNavigationChanges,
} from "../model/navigation";

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
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initial.search);
  const [isPending, startTransition] = useTransition();
  const currentQuery = searchParams.toString();

  const navigate = useCallback(
    (next: NotarialNavigationChanges, replace = false) => {
      const params = applyNotarialNavigationChanges(
        new URLSearchParams(currentQuery),
        next,
      );
      const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
      startTransition(() => {
        if (replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [currentQuery, pathname, router],
  );

  useEffect(() => {
    if (search.trim() === initial.search) return;
    const timeout = window.setTimeout(() => {
      navigate({ search }, true);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [initial.search, navigate, search]);

  return (
    <div
      role="group"
      aria-label="Filtros del índice notarial"
      className="mb-6 space-y-3"
      aria-busy={isPending}
    >
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
            navigate({ search }, true);
          }}
        >
          <label htmlFor="ni-search" className="mb-1 block text-xs font-medium text-slate-600">
            Buscar
          </label>
          <div className="relative">
            <input
              id="ni-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, acto, partes"
              className={`${controlClass} w-full pr-10`}
            />
            {search !== "" && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
                onClick={() => {
                  setSearch("");
                  navigate({ search: "" }, true);
                }}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-lg text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          >
            Limpiar filtros
          </button>
        )}
        <span
          role="status"
          aria-live="polite"
          className={`pb-2 text-xs text-slate-500 ${isPending ? "visible" : "invisible"}`}
        >
          Actualizando resultados…
        </span>
      </div>
    </div>
  );
}
