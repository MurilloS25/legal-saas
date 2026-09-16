import type { ReceivableEntry } from "../model/types";
import { ReceivableMiniList } from "./ReceivableMiniList";

type Props = {
  clientId: string;
  receivables: ReceivableEntry[];
  canManage: boolean;
};

export function ClientReceivablesSection({
  clientId,
  receivables,
  canManage,
}: Props) {
  return (
    <section aria-label="Cuentas por cobrar del cliente" className="mt-8">
      <ReceivableMiniList
        receivables={receivables}
        newHref={
          canManage
            ? `/dashboard/receivables/new?client=${clientId}`
            : undefined
        }
        emptyText="Este cliente todavía no tiene cuentas por cobrar."
      />
    </section>
  );
}
