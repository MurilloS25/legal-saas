/**
 * Precedencia genérica entre un valor derivado automáticamente y una
 * corrección manual, para cualquier campo del Índice Notarial que pueda
 * derivarse del Machote/Escritura (fecha, hora, tomo, folios, número de
 * instrumento, acto, partes).
 *
 * Compara TRES valores:
 * - `effective`: lo que está persistido como valor real del campo ahora
 *   mismo (lo que ve el usuario, lo que exporta el Word).
 * - `lastDerivedSnapshot`: lo que la derivación automática produjo la
 *   última vez que se guardó este campo — nunca se muestra directamente,
 *   solo sirve para saber si `effective` coincide con lo derivado o
 *   diverge de eso (ver migración `20260827120000...`).
 * - `derivedNow`: lo que la derivación automática produce en este momento,
 *   a partir del estado actual del documento.
 *
 * Con eso, sin ambigüedad:
 * - `effective === lastDerivedSnapshot` (incluye el caso "nunca se guardó
 *   nada": ambos `null`) -> nadie lo tocó a mano nunca. Seguro refrescar a
 *   `derivedNow` sin preguntar.
 * - `effective !== lastDerivedSnapshot` -> alguien lo corrigió a mano en
 *   algún momento. Se preserva `effective` SIEMPRE, nunca se sobrescribe
 *   silenciosamente. Si además `derivedNow !== lastDerivedSnapshot` (la
 *   fuente también cambió desde esa corrección), se marca `sourceChanged`
 *   para que la UI pueda sugerir revisión sin tocar el valor.
 */
export type DerivedPrecedenceResult<T> = {
  value: T | null;
  isManualOverride: boolean;
  /** Solo relevante junto con `isManualOverride`: la derivación actual ya
   * no coincide con lo que era cuando se hizo la corrección manual. */
  sourceChanged: boolean;
};

export function resolveDerivedPrecedence<T>(
  effective: T | null,
  lastDerivedSnapshot: T | null,
  derivedNow: T | null,
): DerivedPrecedenceResult<T> {
  const untouched = effective === lastDerivedSnapshot;
  if (untouched) {
    return { value: derivedNow, isManualOverride: false, sourceChanged: false };
  }
  return {
    value: effective,
    isManualOverride: true,
    sourceChanged: derivedNow !== lastDerivedSnapshot,
  };
}
