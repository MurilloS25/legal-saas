"use client";

/**
 * Paso "Cobro" dentro del stepper de la Escritura — operaciones
 * contextuales sin salir del workspace: crear la primera cuenta por cobrar
 * y registrar pagos, ambas vía modal. La administración completa (editar,
 * eliminar, historial, anular pagos) sigue viviendo en Cuentas por cobrar —
 * "Ver cuenta completa" lleva ahí explícitamente.
 *
 * Reutiliza `CreateReceivableDialog`/`RegisterPaymentDialog` (mismas
 * Server Actions, RPCs y reglas de inmutabilidad financiera de siempre) —
 * cero lógica de negocio nueva aquí, solo presentación y sincronización
 * local del resumen tras cada acción.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CreateReceivableDialog,
  RegisterPaymentDialog,
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
  type ClientOption,
  type DocumentOption,
  type ReceivableEntry,
  type ReceivableState,
} from "@/features/receivables";
import { useToast } from "@/components/feedback/Toast";

type Props = {
  documentId: string;
  documentTitle: string;
  receivables: ReceivableEntry[];
  clientOptions: ClientOption[];
  defaultClientId?: string;
  /** receivables.manage — controla si se ofrecen las acciones contextuales. */
  canManage: boolean;
  /**
   * Resuelve el paso "Cobro" explícitamente y avanza a "Índice" — Cobro es
   * legítimamente opcional, así que esta es la única forma de marcarlo como
   * resuelto sin haber creado una cuenta.
   */
  onContinue: () => void;
};

export function DocumentReceivableStep({
  documentId,
  documentTitle,
  receivables: initialReceivables,
  clientOptions,
  defaultClientId,
  canManage,
  onContinue,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [receivables, setReceivables] = useState(initialReceivables);
  // `router.refresh()` le entrega props frescas a este componente, pero
  // `useState(initialReceivables)` solo usa ese valor una vez, al montar —
  // sin este ajuste durante el render (mismo patrón que la sincronización
  // de `searchParams` en `DocumentComposer`), un pago registrado quedaría
  // invisible en el resumen hasta recargar la página a mano, aunque el
  // servidor ya tenga el saldo actualizado.
  const [lastInitialReceivables, setLastInitialReceivables] =
    useState(initialReceivables);
  if (initialReceivables !== lastInitialReceivables) {
    setLastInitialReceivables(initialReceivables);
    setReceivables(initialReceivables);
  }

  function handleCreated(
    receivable: NonNullable<ReceivableState["receivable"]>,
  ) {
    setReceivables((current) => [...current, receivable]);
    showToast("Cuenta por cobrar creada.");
    router.refresh();
  }

  function handleRegistered() {
    showToast("Pago registrado.");
    router.refresh();
  }

  const documents: DocumentOption[] = [
    { id: documentId, title: documentTitle, client_id: defaultClientId ?? null },
  ];

  return (
    <section aria-label="Cuentas por cobrar de la escritura">
      {receivables.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500 mb-4">
            Esta escritura todavía no tiene cuentas por cobrar.
          </p>
          {canManage && (
            <CreateReceivableDialog
              clients={clientOptions}
              documents={documents}
              defaults={{ client_id: defaultClientId, document_id: documentId }}
              onCreated={handleCreated}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {receivables.map((receivable) => (
            <ReceivableSummaryCard
              key={receivable.id}
              receivable={receivable}
              documentId={documentId}
              canManage={canManage}
              onRegistered={handleRegistered}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
        >
          {receivables.length === 0 ? "Continuar sin cobro" : "Continuar a Índice"}
        </button>
      </div>
    </section>
  );
}

function ReceivableSummaryCard({
  receivable,
  documentId,
  canManage,
  onRegistered,
}: {
  receivable: ReceivableEntry;
  documentId: string;
  canManage: boolean;
  onRegistered: () => void;
}) {
  const isSettled =
    receivable.status === "paid" || Number(receivable.balance_due) <= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {receivable.client_name}
          </p>
          <p className="text-xs text-slate-500">{receivable.concept}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${receivableStatusBadgeClass(receivable.status)}`}
        >
          {receivableStatusLabel(receivable.status)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Monto</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(receivable.amount_total, receivable.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Moneda</dt>
          <dd className="font-medium text-slate-900">{receivable.currency}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Pagado</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(receivable.paid_amount, receivable.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Saldo</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(receivable.balance_due, receivable.currency)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canManage && !isSettled && (
          <RegisterPaymentDialog
            embedded
            documentId={documentId}
            receivableId={receivable.id}
            currency={receivable.currency}
            balanceDue={receivable.balance_due}
            onRegistered={onRegistered}
          />
        )}
        <Link
          href={`/dashboard/receivables/${receivable.id}`}
          className="text-sm font-medium text-accent-700 hover:text-accent-800 focus:outline-none focus:underline"
        >
          Ver cuenta completa
        </Link>
      </div>
    </div>
  );
}
