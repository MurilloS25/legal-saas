"use client";

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
          const option = options.find(
            ({ value }) => String(value) === event.target.value,
          );
          if (option) router.push(option.href);
        }}
        aria-label="Filas por página"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        {options.map(({ value }) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}
