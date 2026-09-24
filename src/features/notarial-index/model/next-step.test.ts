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

const complete: Pick<NotarialNextStepInput, "complete" | "missingFields"> = {
  complete: true,
  missingFields: [],
};

describe("notarialNextStep", () => {
  it("Pendiente: explains what is missing; nothing to save until something changes", () => {
    const step = notarialNextStep(base);
    expect(step.primary).toBe("save");
    expect(step.saveEnabled).toBe(false);
    expect(step.confirmAvailable).toBe(false);
    expect(step.guidance).toBe(
      "Faltan datos: número de instrumento y tomo. Complétalos y guarda.",
    );
  });

  it("with unsaved changes, Guardar is enabled and Confirmar Índice is never offered", () => {
    for (const state of ["pending", "ready_to_confirm", "review_required"] as const) {
      const step = notarialNextStep({ ...base, ...complete, state, dirty: true });
      expect(step.primary).toBe("save");
      expect(step.saveEnabled).toBe(true);
      expect(step.confirmAvailable).toBe(false);
      expect(step.guidance).toBe(
        "Tienes cambios sin guardar. Guárdalos con “Guardar”; después podrás confirmar el Índice.",
      );
    }
  });

  it("unsaved changes while still incomplete mention what is missing", () => {
    const step = notarialNextStep({ ...base, dirty: true });
    expect(step.saveEnabled).toBe(true);
    expect(step.guidance).toBe(
      "Tienes cambios sin guardar. Faltan datos: número de instrumento y tomo.",
    );
  });

  it("Listo: all saved and complete → Confirmar Índice, nothing to save", () => {
    const step = notarialNextStep({ ...base, ...complete, state: "ready_to_confirm" });
    expect(step).toEqual({
      primary: "confirm",
      saveEnabled: false,
      confirmAvailable: true,
      correctAvailable: false,
      guidance: "Todos los datos están guardados. Falta confirmar el Índice.",
    });
  });

  it("Confirmado: only Corregir, no save and no confirm", () => {
    const step = notarialNextStep({ ...base, ...complete, state: "confirmed" });
    expect(step).toEqual({
      primary: "correct",
      saveEnabled: false,
      confirmAvailable: false,
      correctAvailable: true,
      guidance: "Índice confirmado. Si necesitas cambiar algo, usa “Corregir datos”.",
    });
  });

  it("Revisión requerida explains the correction/reopen before confirming again", () => {
    const ready = notarialNextStep({ ...base, ...complete, state: "review_required" });
    expect(ready.confirmAvailable).toBe(true);
    expect(ready.guidance).toBe(
      "Hubo una corrección o reapertura. Revisa los datos antes de confirmar nuevamente el Índice.",
    );
    const incomplete = notarialNextStep({ ...base, state: "review_required" });
    expect(incomplete.confirmAvailable).toBe(false);
    expect(incomplete.guidance).toBe(
      "Hubo una corrección o reapertura. Faltan datos: número de instrumento y tomo.",
    );
  });

  it("a content change to review enables Guardar even without edits, and blocks Confirmar", () => {
    const step = notarialNextStep({ ...base, ...complete, state: "ready_to_confirm", contentChanged: true });
    expect(step.saveEnabled).toBe(true);
    expect(step.confirmAvailable).toBe(false);
    expect(step.guidance).toBe("Revisa estos datos y guárdalos antes de confirmar el Índice.");
  });

  it("a confirmed Índice ignores later content changes until someone corrects it", () => {
    const step = notarialNextStep({ ...base, ...complete, state: "confirmed", contentChanged: true });
    expect(step.correctAvailable).toBe(true);
    expect(step.saveEnabled).toBe(false);
  });

  it("without permission to confirm, complete data waits for someone who can", () => {
    const ready = notarialNextStep({ ...base, ...complete, state: "ready_to_confirm", canConfirm: false });
    expect(ready.confirmAvailable).toBe(false);
    expect(ready.guidance).toBe(
      "Todos los datos están guardados. Falta que alguien con permiso confirme el Índice.",
    );
    const confirmed = notarialNextStep({ ...base, ...complete, state: "confirmed", canConfirm: false });
    expect(confirmed.correctAvailable).toBe(false);
    expect(confirmed.primary).toBeNull();
  });

  it("without edit permission there is never a Guardar action", () => {
    for (const dirty of [false, true]) {
      const step = notarialNextStep({ ...base, canEdit: false, dirty });
      expect(step.primary).toBeNull();
      expect(step.saveEnabled).toBe(false);
    }
  });

  it("does not repeat the missing-field list when the screen already shows it", () => {
    expect(notarialNextStep({ ...base, listMissing: false }).guidance).toBe(
      "Faltan datos para completar el Índice. Complétalos y guarda.",
    );
  });
});
