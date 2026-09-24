import { describe, expect, it } from "vitest";
import { notarialNextStep, type NotarialNextStepInput } from "./next-step";

const base: NotarialNextStepInput = {
  state: "pending",
  dirty: false,
  complete: false,
  missingFields: ["instrument_number", "protocol_book"],
  canEdit: true,
  canConfirm: true,
  contentChanged: false,
};

describe("notarialNextStep — una acción principal por estado", () => {
  it("Pendiente: faltan datos → Guardar, explicando qué falta", () => {
    const step = notarialNextStep(base);
    expect(step.primary).toBe("save");
    expect(step.guidance).toBe(
      "Faltan datos: número de instrumento y tomo. Complétalos y guarda.",
    );
  });

  it("with unsaved changes the primary action is always Guardar, never Confirmar", () => {
    for (const state of ["pending", "ready_to_confirm", "review_required"] as const) {
      const step = notarialNextStep({ ...base, state, dirty: true, complete: true, missingFields: [] });
      expect(step.primary).toBe("save");
      expect(step.guidance).toBe(
        "Tienes cambios sin guardar. Guárdalos y después confirma los datos.",
      );
    }
  });

  it("unsaved changes while data is still incomplete mention what is missing", () => {
    expect(notarialNextStep({ ...base, dirty: true }).guidance).toBe(
      "Tienes cambios sin guardar. Faltan datos: número de instrumento y tomo.",
    );
  });

  it("Listo: complete and saved → Confirmar", () => {
    const step = notarialNextStep({ ...base, state: "ready_to_confirm", complete: true, missingFields: [] });
    expect(step.primary).toBe("confirm");
    expect(step.guidance).toBe(
      "Todos los datos están completos y guardados. Falta confirmarlos.",
    );
  });

  it("Confirmado → Corregir (secundaria), nada más que hacer", () => {
    const step = notarialNextStep({ ...base, state: "confirmed", complete: true, missingFields: [] });
    expect(step.primary).toBe("correct");
    expect(step.guidance).toBe(
      "Listo. Los datos están confirmados y bloqueados; usa “Corregir datos” si necesitas cambiarlos.",
    );
  });

  it("Revisión requerida: explains that a correction/reopen invalidated the confirmation", () => {
    const ready = notarialNextStep({ ...base, state: "review_required", complete: true, missingFields: [] });
    expect(ready.primary).toBe("confirm");
    expect(ready.guidance).toBe(
      "Una corrección o reapertura invalidó la confirmación. Revisa los datos y confírmalos de nuevo.",
    );
    const incomplete = notarialNextStep({ ...base, state: "review_required" });
    expect(incomplete.primary).toBe("save");
    expect(incomplete.guidance).toMatch(/^Una corrección o reapertura invalidó la confirmación\. Faltan datos: /);
  });

  it("without permission to confirm, complete data waits for someone who can", () => {
    const step = notarialNextStep({ ...base, state: "ready_to_confirm", complete: true, missingFields: [], canConfirm: false });
    expect(step.primary).toBeNull();
    expect(step.guidance).toBe(
      "Todos los datos están completos y guardados. Falta que alguien con permiso los confirme.",
    );
    const confirmed = notarialNextStep({ ...base, state: "confirmed", complete: true, missingFields: [], canConfirm: false });
    expect(confirmed.primary).toBeNull();
  });

  it("without edit permission there is never a Guardar action", () => {
    expect(notarialNextStep({ ...base, canEdit: false }).primary).toBeNull();
    expect(notarialNextStep({ ...base, canEdit: false, dirty: true }).primary).toBeNull();
  });

  it("when the Escritura content changed after the last save, the primary action is Guardar (to mark them reviewed), even without edits", () => {
    const step = notarialNextStep({
      ...base,
      state: "ready_to_confirm",
      complete: true,
      missingFields: [],
      contentChanged: true,
    });
    expect(step.primary).toBe("save");
    expect(step.guidance).toBe(
      "Revisa los datos y guárdalos para marcarlos como revisados; después podrás confirmarlos.",
    );
  });

  it("a confirmed Índice ignores later content changes until someone corrects it", () => {
    expect(
      notarialNextStep({ ...base, state: "confirmed", complete: true, missingFields: [], contentChanged: true })
        .primary,
    ).toBe("correct");
  });

  it("does not repeat the missing-field list when the screen already shows it", () => {
    expect(notarialNextStep({ ...base, listMissing: false }).guidance).toBe(
      "Faltan datos para completar el Índice. Complétalos y guarda.",
    );
  });
});
