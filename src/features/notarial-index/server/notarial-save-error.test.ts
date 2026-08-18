import { describe, expect, it } from "vitest";
import { notarialSaveErrorMessage } from "./notarial-save-error";

/**
 * `saveNotarialMetadataAction` en sí requiere una sesión Supabase real (ver
 * `docs/TESTING.md` — cobertura de Server Actions con efectos de BD vive en
 * E2E, no mockeando el cliente). Lo que sí es lógica pura y aislable es el
 * mapeo de errores de guardado a mensajes — incluyendo la carrera de
 * inserción concurrente (23505 en `dnm_document_id_key`) y la duplicación de
 * número de instrumento (23505 en `dnm_owner_year_instrument_key`), que es
 * exactamente el caso que un doble clic o dos pestañas pueden disparar.
 */
describe("notarialSaveErrorMessage", () => {
  it("treats a document_id race (two concurrent first saves) as benign, not a scary failure", () => {
    const message = notarialSaveErrorMessage({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "dnm_document_id_key"',
      details: "Key (document_id)=(11111111-1111-1111-1111-111111111111) already exists.",
    });
    expect(message).toBe(
      "Estos datos ya se guardaron desde otra pestaña o sesión. Recarga la página para verlos.",
    );
  });

  it("reports a duplicate instrument number as a real, correctable validation error", () => {
    const message = notarialSaveErrorMessage({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "dnm_owner_year_instrument_key"',
      details: "Key (owner_id, ..., instrument_number)=(..., 2026, 100) already exists.",
    });
    expect(message).toBe(
      "Ya existe otro instrumento con este número para este año. Verifica el número de instrumento.",
    );
  });

  it("falls back to a generic message for an unrecognized unique violation", () => {
    const message = notarialSaveErrorMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "some_other_key"',
      details: null,
    });
    expect(message).toBe(
      "No fue posible guardar los datos del índice. Intenta de nuevo.",
    );
  });

  it("falls back to a generic message for a non-unique-violation error", () => {
    const message = notarialSaveErrorMessage({
      code: "42501",
      message: "permission denied",
    });
    expect(message).toBe(
      "No fue posible guardar los datos del índice. Intenta de nuevo.",
    );
  });

  it("handles a code-less error object without throwing", () => {
    expect(notarialSaveErrorMessage({})).toBe(
      "No fue posible guardar los datos del índice. Intenta de nuevo.",
    );
  });
});
