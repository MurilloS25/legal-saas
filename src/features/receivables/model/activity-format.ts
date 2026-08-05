/**
 * Formateo de eventos de actividad de una cuenta por cobrar a texto legible.
 *
 * La fuente de verdad es `event_type` + `metadata`; el texto visible se deriva
 * aquí (nunca se muestran UUIDs ni JSON crudo). Un `event_type` desconocido
 * cae a un texto genérico.
 */

import { formatMoney } from "./status";

export type ReceivableActivityEvent = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_user_id: string;
  /** Nombre legible del actor (nunca su UUID) — "Tú" o "email (rol)". */
  actorName: string;
};

export type FormattedReceivableActivity = {
  title: string;
  lines: string[];
};

function money(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function formatReceivableActivityEvent(
  event: ReceivableActivityEvent,
  currency?: string,
): FormattedReceivableActivity {
  const meta = event.metadata ?? {};

  switch (event.event_type) {
    case "receivable_created":
      return { title: "Cuenta por cobrar creada", lines: [] };

    case "receivable_updated":
      return { title: "Cuenta actualizada", lines: [] };

    case "receivable_client_changed":
      return { title: "Cliente cambiado", lines: [] };

    case "receivable_document_linked":
      return { title: "Escritura vinculada", lines: [] };

    case "receivable_document_unlinked":
      return { title: "Escritura desvinculada", lines: [] };

    case "receivable_amount_changed": {
      const lines: string[] = [];
      const prev = money(meta, "previous");
      const next = money(meta, "new");
      if (prev) lines.push(`Anterior: ${fmt(prev, currency)}`);
      if (next) lines.push(`Nuevo: ${fmt(next, currency)}`);
      return { title: "Monto actualizado", lines };
    }

    case "receivable_due_date_changed":
      return { title: "Fecha de vencimiento actualizada", lines: [] };

    case "payment_registered": {
      const amount = money(meta, "amount");
      return {
        title: "Pago registrado",
        lines: amount ? [`Monto: ${fmt(amount, currency)}`] : [],
      };
    }

    case "payment_voided":
      return { title: "Pago anulado", lines: [] };

    case "receivable_paid":
      return { title: "Cuenta saldada", lines: [] };

    case "receivable_reopened_after_void":
      return { title: "Cuenta reabierta tras anulación", lines: [] };

    default:
      return { title: "Actividad registrada", lines: [] };
  }
}

function fmt(amount: string, currency?: string): string {
  return currency ? formatMoney(amount, currency) : amount;
}

/** Fecha y hora legible en español de Costa Rica. */
export function formatReceivableActivityTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
