import { describe, expect, it } from "vitest";
import {
  formatActivityEvent,
  type ActivityEvent,
} from "./activity-format";

function event(
  event_type: string,
  metadata: Record<string, unknown> = {},
  summary: string | null = null,
): ActivityEvent {
  return {
    id: "1",
    event_type,
    summary,
    metadata,
    created_at: "2026-07-13T10:35:00Z",
    actor_user_id: "u1",
  };
}

describe("formatActivityEvent", () => {
  it("formats creation", () => {
    expect(formatActivityEvent(event("document_created"))).toEqual({
      title: "Escritura creada",
      lines: [],
    });
  });

  it("formats a status change with human labels", () => {
    expect(
      formatActivityEvent(
        event("document_status_changed", {
          previousStatus: "draft",
          newStatus: "ready",
        }),
      ),
    ).toEqual({
      title: "Estado actualizado",
      lines: ["De Borrador a Revisión pendiente (histórico)"],
    });
  });

  it("formats finalized and reopened with their own titles", () => {
    expect(
      formatActivityEvent(
        event("document_finalized", { previousStatus: "ready", newStatus: "final" }),
      ),
    ).toEqual({
      title: "Escritura finalizada",
      lines: ["De Revisión pendiente (histórico) a Finalizada"],
    });

    expect(
      formatActivityEvent(
        event("document_reopened", { previousStatus: "final", newStatus: "ready" }),
      ).title,
    ).toBe("Escritura reabierta");
  });

  it("formats client assignment, change and removal by name (no UUIDs)", () => {
    expect(
      formatActivityEvent(
        event("document_client_assigned", {
          newClientId: "uuid-hidden",
          newClientName: "María Rodríguez",
        }),
      ),
    ).toEqual({ title: "Cliente asociado", lines: ["Cliente: María Rodríguez"] });

    const changed = formatActivityEvent(
      event("document_client_changed", {
        previousClientName: "Juan Pérez",
        newClientName: "María Rodríguez",
      }),
    );
    expect(changed.title).toBe("Cliente cambiado");
    expect(changed.lines).toEqual(["Anterior: Juan Pérez", "Nuevo: María Rodríguez"]);

    expect(
      formatActivityEvent(
        event("document_client_removed", { previousClientName: "Juan Pérez" }),
      ),
    ).toEqual({ title: "Cliente desasociado", lines: ["Anterior: Juan Pérez"] });
  });

  it("never surfaces raw UUIDs from metadata", () => {
    const formatted = formatActivityEvent(
      event("document_client_changed", {
        previousClientId: "11111111-1111-1111-1111-111111111111",
        previousClientName: "Juan Pérez",
        newClientId: "22222222-2222-2222-2222-222222222222",
        newClientName: "María Rodríguez",
      }),
    );
    const text = [formatted.title, ...formatted.lines].join(" ");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it("formats title change and content update", () => {
    expect(
      formatActivityEvent(
        event("document_title_changed", {
          previousTitle: "Doc A",
          newTitle: "Doc B",
        }),
      ),
    ).toEqual({
      title: "Título actualizado",
      lines: ["Anterior: Doc A", "Nuevo: Doc B"],
    });

    expect(formatActivityEvent(event("document_content_updated")).title).toBe(
      "Contenido de la escritura actualizado",
    );
  });

  it("formats word generation", () => {
    expect(formatActivityEvent(event("document_word_generated")).title).toBe(
      "Documento Word generado",
    );
  });

  it("falls back to summary then a generic label for unknown types", () => {
    expect(
      formatActivityEvent(event("future_event", {}, "Algo pasó")).title,
    ).toBe("Algo pasó");
    expect(formatActivityEvent(event("future_event")).title).toBe(
      "Actividad registrada",
    );
  });

  it("tolerates missing metadata fields", () => {
    expect(formatActivityEvent(event("document_client_changed"))).toEqual({
      title: "Cliente cambiado",
      lines: [],
    });
  });
});
