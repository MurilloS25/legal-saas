"use client";

/**
 * Búsqueda del directorio de clientes. Lo aplicado vive en el query string
 * (`?q=`, compartible y sobrevive al reload) y el servidor hace el filtrado;
 * el texto que se escribe se mantiene local hasta pulsar "Buscar" o Enter,
 * igual que en Escrituras. Buscar reinicia la paginación a la página 1.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CLIENTS_MAX_SEARCH_LENGTH,
  clientsQueryToParams,
} from "../model/workspace-query";
import type { PageSizeOption } from "@/lib/pagination";

type Props = {
  /** Búsqueda aplicada actualmente (la de la URL). */
  q: string;
  /** Tamaño de página vigente: se conserva al buscar o limpiar. */
  pageSize: PageSizeOption;
};

/** Enlace de una búsqueda: siempre página 1, conservando el tamaño de página. */
function searchHref(q: string, pageSize: PageSizeOption): string {
  const qs = new URLSearchParams(clientsQueryToParams({ q, pageSize })).toString();
  return qs ? `/clients?${qs}` : "/clients";
}

export function ClientsToolbar({ q, pageSize }: Props) {
  const router = useRouter();
  const [text, setText] = useState(q);

  return (
    <form
      role="search"
      aria-label="Buscar clientes"
      className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(searchHref(text.trim(), pageSize));
      }}
    >
      <div className="flex-1">
        <label
          htmlFor="clients-search"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Buscar
        </label>
        <input
          id="clients-search"
          type="search"
          value={text}
          maxLength={CLIENTS_MAX_SEARCH_LENGTH}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nombre, razón social o cédula"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        >
          Buscar
        </button>
        {q !== "" && (
          <Link
            href={searchHref("", pageSize)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          >
            Limpiar búsqueda
          </Link>
        )}
      </div>
    </form>
  );
}
