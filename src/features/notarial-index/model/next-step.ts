/**
 * Siguiente paso de los datos del Índice de una Escritura: qué se puede
 * hacer ahora y una frase que explica qué falta, para que el usuario no
 * tenga que entender el ciclo interno.
 *
 * No cambia ninguna regla de dominio — se apoya en el estado derivado
 * existente (`notarialConfirmationState`) y mantiene separados los
 * conceptos: Guardar persiste datos (nunca confirma); Confirmar Índice es
 * una acción de ciclo de vida aparte que bloquea la edición normal y solo
 * se ofrece con los datos completos y ya guardados; Corregir reabre datos
 * confirmados.
 *
 * La misma regla alimenta el dock de la Escritura (Guardar + Confirmar
 * Índice) y la revisión en línea del listado del Índice (una acción
 * principal por estado, `primary`).
 */

import {
  joinMissingFieldLabels,
  type NotarialConfirmationState,
  type NotarialMissingField,
} from "./notarial";

export type NotarialNextStepInput = {
  state: NotarialConfirmationState;
  /** Los datos visibles difieren de los guardados (o nunca se guardaron). */
  dirty: boolean;
  complete: boolean;
  missingFields: NotarialMissingField[];
  /** Puede editar/guardar los datos del Índice. */
  canEdit: boolean;
  /** notarial_index.generate — confirmar/corregir. */
  canConfirm: boolean;
  /**
   * El contenido de la Escritura cambió después del último guardado de
   * estos datos (aviso "revísalos"): guardarlos es lo que los marca como
   * revisados, aunque no se haya editado ningún valor.
   */
  contentChanged?: boolean;
  /**
   * false cuando la pantalla ya lista los datos faltantes en otro lugar
   * (resumen de la sección): la guía no repite la lista.
   */
  listMissing?: boolean;
};

export type NotarialNextStep = {
  /** Una acción principal por estado (pantallas sin dock). */
  primary: "save" | "confirm" | "correct" | null;
  /** Hay algo que persistir: Guardar está habilitado. */
  saveEnabled: boolean;
  /** Confirmar Índice disponible (completo, guardado, con permiso). */
  confirmAvailable: boolean;
  /** Corregir datos disponible (confirmado, con permiso). */
  correctAvailable: boolean;
  guidance: string;
};

const REVIEW = "Hubo una corrección o reapertura.";

export function notarialNextStep(input: NotarialNextStepInput): NotarialNextStep {
  const missing =
    input.listMissing === false
      ? "Faltan datos para completar el Índice."
      : `Faltan datos: ${joinMissingFieldLabels(input.missingFields)}.`;
  const none = { saveEnabled: false, confirmAvailable: false, correctAvailable: false };

  if (input.state === "confirmed") {
    return input.canConfirm
      ? {
          ...none,
          primary: "correct",
          correctAvailable: true,
          guidance: "Índice confirmado. Si necesitas cambiar algo, usa “Corregir datos”.",
        }
      : {
          ...none,
          primary: null,
          guidance: "Índice confirmado. Solo alguien con permiso puede corregirlo.",
        };
  }

  const reviewing = input.state === "review_required";
  const somethingToSave = input.canEdit && (input.dirty || !!input.contentChanged);
  const saveStep = (guidance: string): NotarialNextStep => ({
    ...none,
    primary: input.canEdit ? "save" : null,
    saveEnabled: somethingToSave,
    guidance,
  });

  if (input.dirty) {
    return saveStep(
      input.complete
        ? "Tienes cambios sin guardar. Guárdalos con “Guardar”; después podrás confirmar el Índice."
        : `Tienes cambios sin guardar. ${missing}`,
    );
  }

  if (input.contentChanged) {
    return saveStep(
      input.complete
        ? "Revisa estos datos y guárdalos antes de confirmar el Índice."
        : `Revisa estos datos y guárdalos. ${missing}`,
    );
  }

  if (!input.complete) {
    return saveStep(reviewing ? `${REVIEW} ${missing}` : `${missing} Complétalos y guarda.`);
  }

  if (!input.canConfirm) {
    return {
      ...none,
      primary: null,
      guidance:
        "Todos los datos están guardados. Falta que alguien con permiso confirme el Índice.",
    };
  }

  return {
    ...none,
    primary: "confirm",
    confirmAvailable: true,
    guidance: reviewing
      ? `${REVIEW} Revisa los datos antes de confirmar nuevamente el Índice.`
      : "Todos los datos están guardados. Falta confirmar el Índice.",
  };
}
