"use client";

/**
 * Selector de filas por página. Aislado como su propio Client Component
 * (en vez de convertir `TablePagination` entero en cliente) porque
 * `TablePagination` se renderiza desde Server Components que le pasan
 * `pageHref` como una función real — pasar una función a un componente
 * cliente rompe la serialización RSC ("Functions cannot be passed directly
 * to Client Components"). Aquí solo cruzan datos planos: el tamaño actual y
 * un array de { value, href } ya resueltos en el servidor.
 */

import { useRouter } from "next/navigation";
import type { PageSizeOption } from "@/lib/pagination";

type Props = {
  pageSize: PageSizeOption;
  options: { value: PageSizeOption; href: string }[];
};

export function PageSizeSelect({ pageSize, options }: Props) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      Filas por página
      <select
        value={pageSize}
        onChange={(event) => {
          const target = options.find(
            (option) => String(option.value) === event.target.value,
          );
          if (target) router.push(target.href);
        }}
        aria-label="Filas por página"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
    </label>
  );
}
