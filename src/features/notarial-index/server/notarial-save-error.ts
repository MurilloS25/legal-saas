/**
 * Mapea un error de guardado de metadata del índice a un mensaje amigable.
 * Función pura, sin `"use server"` — un archivo con esa directiva solo
 * puede exportar funciones async (todo export se vuelve una Server Action),
 * así que este helper vive aparte para poder importarlo y probarlo
 * directamente.
 *
 * `23505` (unique violation) cubre dos restricciones reales y distintas —
 * hay que diferenciarlas por el nombre de constraint en el mensaje de
 * Postgres, no asumir cuál fue:
 * - `dnm_document_id_key` (UNIQUE(document_id)): una segunda pestaña/click
 *   perdió la carrera del primer guardado (no existía fila, dos inserts
 *   concurrentes) — la fila ya quedó guardada por el otro request, así que
 *   esto es benigno, no una pérdida de datos.
 * - `dnm_owner_year_instrument_key`: mismo número de instrumento para el
 *   mismo notario (owner_id) en el mismo año — violación real de una regla
 *   de negocio ya existente, el usuario debe corregir el número.
 */
export function notarialSaveErrorMessage(error: {
  code?: string;
  message?: string;
  details?: string | null;
}): string {
  if (error.code === "23505") {
    const detail = `${error.message ?? ""} ${error.details ?? ""}`;
    if (detail.includes("dnm_owner_year_instrument_key")) {
      return "Ya existe otro instrumento con este número para este año. Verifica el número de instrumento.";
    }
    if (detail.includes("dnm_document_id_key")) {
      return "Estos datos ya se guardaron desde otra pestaña o sesión. Recarga la página para verlos.";
    }
  }
  return "No fue posible guardar los datos del índice. Intenta de nuevo.";
}
