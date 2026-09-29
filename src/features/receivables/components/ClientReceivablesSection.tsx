import type { CurrencyTotal, ReceivableEntry } from "../model/types";
import { formatMoney } from "../model/status";
import { ReceivableMiniList } from "./ReceivableMiniList";

type Props = {
  clientId: string;
  /** Las cuentas más recientes (el resumen no las trae todas). */
  receivables: ReceivableEntry[];
  /** Totales por moneda de TODAS las cuentas del cliente (`receivables_summary`). */
  totals: CurrencyTotal[];
  canManage: boolean;
};

export function ClientReceivablesSection({
  clientId,
  receivables,
  totals,
  canManage,
}: Props) {
  const count = totals.reduce((sum, row) => sum + row.count, 0);
  // Saldo pendiente por moneda; las monedas sin saldo no se listan.
  const pending = totals.filter((row) => Number(row.balance) > 0);
  const summary =
    count === 0 ? undefined : (
      <>
        {count === 1 ? "1 cuenta en total" : `${count} cuentas en total`}
        {" · "}
        {pending.length === 0
          ? "Sin saldo pendiente"
          : `Saldo pendiente: ${pending
              .map((row) => formatMoney(row.balance, row.currency))
              .join(" + ")}`}
      </>
    );

  return (
    <section aria-label="Cuentas por cobrar del cliente">
      <ReceivableMiniList
        summary={summary}
        receivables={receivables}
        newHref={
          canManage
            ? `/receivables/new?client=${clientId}`
            : undefined
        }
        emptyText="Este cliente todavía no tiene cuentas por cobrar."
        allHref={`/receivables?client=${clientId}`}
      />
    </section>
  );
}
