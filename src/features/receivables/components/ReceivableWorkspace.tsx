"use client";

/**
 * Workspace del detalle de una cuenta por cobrar.
 *
 * El resumen financiero permanece siempre visible (no vive dentro de una
 * pestaña); el resto del detalle se organiza en dos secciones navegables
 * (Datos de la cuenta / Pagos) igual que el workspace de machotes: ambas
 * permanecen montadas y solo se ocultan con CSS, así que cambiar de pestaña
 * nunca reinicia el formulario ni descarta el estado del formulario de pago.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  ReceivableActivityEvent,
} from "../model/activity-format";
import type {
  ClientOption,
  DocumentOption,
  ReceivableEntry,
  ReceivablePayment,
  ReceivableRow,
} from "../model/types";
import {
  formatMoney,
  receivableStatusBadgeClass,
  receivableStatusLabel,
} from "../model/status";
import { DeleteReceivableButton } from "./DeleteReceivableButton";
import { PaymentsSection } from "./PaymentsSection";
import { ReceivableForm } from "./ReceivableForm";
import { ReceivableHistoryDialog } from "./ReceivableHistoryDialog";
import {
  ReceivableWorkspaceHeader,
  type ReceivableWorkspaceSection,
} from "./ReceivableWorkspaceHeader";

type Props = {
  entry: ReceivableEntry;
  editable: ReceivableRow;
  clients: ClientOption[];
  documents: DocumentOption[];
  activity: ReceivableActivityEvent[];
  payments: ReceivablePayment[];
  initialSection?: ReceivableWorkspaceSection;
  createdJustNow?: boolean;
};

function resolveSection(raw: string | null): ReceivableWorkspaceSection {
  return raw === "payments" ? "payments" : "account";
}

export function ReceivableWorkspace({
  entry,
  editable,
  clients,
  documents,
  activity,
  payments,
  initialSection,
  createdJustNow,
}: Props) {
  const [section, setSection] = useState<ReceivableWorkspaceSection>(
    initialSection ?? "account",
  );

  // Mantiene la URL sincronizada con la sección activa sin disparar una
  // navegación real. `popstate` cubre atrás/adelante del navegador.
  useEffect(() => {
    function onPopState() {
      setSection(
        resolveSection(new URLSearchParams(window.location.search).get("section")),
      );
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goToSection = useCallback((next: ReceivableWorkspaceSection) => {
    setSection(next);
    if (typeof window === "undefined") return;
    const url =
      next === "account"
        ? window.location.pathname
        : `${window.location.pathname}?section=${next}`;
    window.history.pushState(null, "", url);
  }, []);

  return (
    <div>
      <ReceivableWorkspaceHeader
        concept={entry.concept}
        statusBadge={
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(entry.status)}`}
          >
            {receivableStatusLabel(entry.status)}
          </span>
        }
        clientName={entry.client_name}
        clientId={entry.client_id}
        documentTitle={entry.document_title}
        documentId={entry.document_id}
        section={section}
        onSectionChange={goToSection}
        actions={
          <>
            <ReceivableHistoryDialog activity={activity} currency={entry.currency} />
            <DeleteReceivableButton receivableId={entry.id} concept={entry.concept} />
          </>
        }
      />

      {createdJustNow && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800"
        >
          Cuenta creada.
        </div>
      )}

      {/* Resumen de montos — siempre visible, fuera de las pestañas. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Monto total</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.amount_total, entry.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pagado</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.paid_amount, entry.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Saldo pendiente</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(entry.balance_due, entry.currency)}
          </p>
        </div>
      </div>

      {/* ================= Datos de la cuenta ================= */}
      <div
        id="receivable-panel-account"
        role="tabpanel"
        aria-labelledby="receivable-tab-account"
        hidden={section !== "account"}
      >
        <ReceivableForm
          mode="edit"
          receivable={editable}
          clients={clients}
          documents={documents}
        />
      </div>

      {/* ================= Pagos ================= */}
      <div
        id="receivable-panel-payments"
        role="tabpanel"
        aria-labelledby="receivable-tab-payments"
        hidden={section !== "payments"}
      >
        <PaymentsSection
          receivableId={entry.id}
          currency={entry.currency}
          balanceDue={entry.balance_due}
          status={entry.status}
          payments={payments}
        />
      </div>
    </div>
  );
}
