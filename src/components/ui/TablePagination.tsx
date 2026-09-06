import Link from "next/link";
import { PageSizeSelect } from "./PageSizeSelect";
import type { PageSizeOption } from "@/lib/pagination";

/**
 * Pie de paginación compartido por los listados server-paginados (Clientes,
 * Machotes, Escrituras, Cuentas por cobrar, Índice Notarial). El
 * conteo/rango se compone en el llamador porque el formato varía ("1–20 de
 * 45" vs. "45 cuentas"); este componente resuelve la navegación
 * anterior/siguiente y, cuando se le pasan `pageSize`/`pageSizeOptions`, el
 * selector de filas por página (aislado en `PageSizeSelect`, el único bit
 * interactivo — este componente sigue siendo un Server Component normal,
 * por eso `pageHref` puede seguir siendo una función real).
 */

type Props = {
  page: number;
  pageCount: number;
  countLabel: string;
  pageHref: (page: number) => string;
  /** Presentes juntos habilitan el selector de filas por página. */
  pageSize?: PageSizeOption;
  pageSizeOptions?: { value: PageSizeOption; href: string }[];
};

const linkClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors";
const disabledClass =
  "rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400";

export function TablePagination({
  page,
  pageCount,
  countLabel,
  pageHref,
  pageSize,
  pageSizeOptions,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-xs text-slate-500">{countLabel}</p>
        {pageSize !== undefined && pageSizeOptions && (
          <PageSizeSelect pageSize={pageSize} options={pageSizeOptions} />
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={linkClass}>
              Anterior
            </Link>
          ) : (
            <span className={disabledClass}>Anterior</span>
          )}
          <span className="text-xs text-slate-500">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={linkClass}>
              Siguiente
            </Link>
          ) : (
            <span className={disabledClass}>Siguiente</span>
          )}
        </nav>
      )}
    </div>
  );
}
