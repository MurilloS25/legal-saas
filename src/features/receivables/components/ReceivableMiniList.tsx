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
  newHref: string;
  emptyText: string;
};

export function ReceivableMiniList({ receivables, newHref, emptyText }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Cuentas por cobrar
        </h2>
        <Link
          href={newHref}
          className="text-sm font-medium text-teal-700 hover:text-teal-800 focus:outline-none focus:underline"
        >
          Nueva cuenta
        </Link>
      </div>

      {receivables.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ReceivableMiniTable rows={receivables} />
        </div>
      )}
    </div>
  );
}
