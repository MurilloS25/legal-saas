/**
 * Formateo de eventos de actividad a texto legible.
 *
 * La fuente de verdad es `event_type` + `metadata`; el texto visible se deriva
 * aquí (nunca se muestran UUIDs ni JSON crudo). Un `event_type` desconocido
 * cae al `summary` guardado o a un texto genérico.
 */

import { documentStatusLabel } from "./status";

export type ActivityEvent = {
  id: string;
  event_type: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_user_id: string;
};

export type FormattedActivity = {
  /** Título legible del evento. */
  title: string;
  /** Líneas de detalle (p. ej. "Anterior: …", "Nuevo: …"). */
  lines: string[];
};

function str(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function formatActivityEvent(event: ActivityEvent): FormattedActivity {
  const meta = event.metadata ?? {};

  switch (event.event_type) {
    case "document_created":
      return { title: "Escritura creada", lines: [] };

    case "document_title_changed": {
      const lines: string[] = [];
      const prev = str(meta, "previousTitle");
      const next = str(meta, "newTitle");
      if (prev) lines.push(`Anterior: ${prev}`);
      if (next) lines.push(`Nuevo: ${next}`);
      return { title: "Título actualizado", lines };
    }

    case "document_content_updated":
      return { title: "Contenido de la escritura actualizado", lines: [] };

    case "document_client_assigned": {
      const name = str(meta, "newClientName");
      return {
        title: "Cliente asociado",
        lines: name ? [`Cliente: ${name}`] : [],
      };
    }

    case "document_client_changed": {
      const lines: string[] = [];
      const prev = str(meta, "previousClientName");
      const next = str(meta, "newClientName");
      if (prev) lines.push(`Anterior: ${prev}`);
      if (next) lines.push(`Nuevo: ${next}`);
      return { title: "Cliente cambiado", lines };
    }

    case "document_client_removed": {
      const prev = str(meta, "previousClientName");
      return {
        title: "Cliente desasociado",
        lines: prev ? [`Anterior: ${prev}`] : [],
      };
    }

    case "document_status_changed":
    case "document_finalized":
    case "document_reopened": {
      const prev = str(meta, "previousStatus");
      const next = str(meta, "newStatus");
      const title =
        event.event_type === "document_finalized"
          ? "Escritura finalizada"
          : event.event_type === "document_reopened"
            ? "Escritura reabierta"
            : "Estado actualizado";
      const lines: string[] = [];
      if (prev && next) {
        lines.push(
          `De ${documentStatusLabel(prev)} a ${documentStatusLabel(next)}`,
        );
      }
      return { title, lines };
    }

    case "document_word_generated":
      return { title: "Documento Word generado", lines: [] };

    case "notarial_metadata_created":
      return { title: "Datos para índice creados", lines: [] };

    case "notarial_metadata_updated":
      return { title: "Datos para índice actualizados", lines: [] };

    case "notarial_metadata_completed":
      return { title: "Datos para índice completos", lines: [] };

    case "notarial_metadata_marked_incomplete":
      return { title: "Datos para índice marcados como incompletos", lines: [] };

    default:
      return {
        title: event.summary?.trim() || "Actividad registrada",
        lines: [],
      };
  }
}

/** Fecha y hora legible en español de Costa Rica. */
export function formatActivityTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
