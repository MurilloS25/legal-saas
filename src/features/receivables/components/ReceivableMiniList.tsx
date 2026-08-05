import Link from "next/link";
import type { ReceivableEntry } from "../model/types";
import { ReceivableMiniTable } from "./ReceivableMiniTable";

/**
 * Listado compacto de cuentas por cobrar para incrustar en el detalle de un
 * cliente o de una escritura. Server component (sin estado). El enlace de
 * "nueva cuenta" prellena el contexto vía query params.
 */

type Props = {
  receivables: ReceivableEntry[];
  /** Omitido (undefined) cuando el rol no tiene receivables.manage — oculta
   * el enlace de "Nueva cuenta" en vez de mostrar un enlace que fallaría. */
  newHref?: string;
  emptyText: string;
  /** Presente solo cuando se incrusta en una Escritura; habilita el enlace
   * de regreso en cada fila hacia esa Escritura. */
  returnTo?: string;
};

export function ReceivableMiniList({
  receivables,
  newHref,
  emptyText,
  returnTo,
}: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Cuentas por cobrar
        </h2>
        {newHref && (
          <Link
            href={newHref}
            className="text-sm font-medium text-accent-700 hover:text-accent-800 focus:outline-none focus:underline"
          >
            Nueva cuenta
          </Link>
        )}
      </div>

      {receivables.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ReceivableMiniTable rows={receivables} returnTo={returnTo} />
        </div>
      )}
    </div>
  );
}
