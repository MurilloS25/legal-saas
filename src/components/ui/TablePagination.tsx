import Link from "next/link";

/**
 * Pie de paginación compartido por los listados server-paginados
 * (Escrituras, Cuentas por cobrar). El conteo/rango se compone en el
 * llamador porque el formato varía ("1–20 de 45" vs. "45 cuentas"); este
 * componente solo resuelve la navegación anterior/siguiente.
 */

type Props = {
  page: number;
  pageCount: number;
  countLabel: string;
  pageHref: (page: number) => string;
};

const linkClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors";
const disabledClass =
  "rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400";

export function TablePagination({ page, pageCount, countLabel, pageHref }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
      <p className="text-xs text-slate-500">{countLabel}</p>
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
