/**
 * Siguiente paso de los datos del Índice de una Escritura: UNA acción
 * principal por estado y una frase que explica qué falta, para que el
 * usuario no tenga que entender el ciclo interno.
 *
 * No cambia ninguna regla de dominio — se apoya en el estado derivado
 * existente (`notarialConfirmationState`) y mantiene separados los
 * conceptos: Guardar persiste datos (nunca confirma); Confirmar es una
 * acción explícita aparte que bloquea la edición normal y solo se ofrece
 * con los datos visibles ya guardados; Corregir reabre datos confirmados.
 */

import {
  joinMissingFieldLabels,
  type NotarialConfirmationState,
  type NotarialMissingField,
} from "./notarial";

export type NotarialNextStepInput = {
  state: NotarialConfirmationState;
  /** Los datos visibles difieren de los guardados. */
  dirty: boolean;
  complete: boolean;
  missingFields: NotarialMissingField[];
  /** documents.edit */
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
  primary: "save" | "confirm" | "correct" | null;
  guidance: string;
};

const INVALIDATED = "Una corrección o reapertura invalidó la confirmación.";

export function notarialNextStep(input: NotarialNextStepInput): NotarialNextStep {
  const missing =
    input.listMissing === false
      ? "Faltan datos para completar el Índice."
      : `Faltan datos: ${joinMissingFieldLabels(input.missingFields)}.`;

  if (input.state === "confirmed") {
    return input.canConfirm
      ? {
          primary: "correct",
          guidance:
            "Listo. Los datos están confirmados y bloqueados; usa “Corregir datos” si necesitas cambiarlos.",
        }
      : {
          primary: null,
          guidance:
            "Listo. Los datos están confirmados y bloqueados; solo alguien con permiso puede corregirlos.",
        };
  }

  const prefix = input.state === "review_required" ? `${INVALIDATED} ` : "";
  const save = input.canEdit ? ("save" as const) : null;

  if (input.dirty) {
    return {
      primary: save,
      guidance: input.complete
        ? "Tienes cambios sin guardar. Guárdalos y después confirma los datos."
        : `Tienes cambios sin guardar. ${missing}`,
    };
  }

  if (input.contentChanged) {
    return {
      primary: save,
      guidance: input.complete
        ? "Revisa los datos y guárdalos para marcarlos como revisados; después podrás confirmarlos."
        : `Revisa los datos y guárdalos para marcarlos como revisados. ${missing}`,
    };
  }

  if (!input.complete) {
    return {
      primary: save,
      guidance: `${prefix}${missing}${prefix ? "" : " Complétalos y guarda."}`,
    };
  }

  if (!input.canConfirm) {
    return {
      primary: null,
      guidance:
        "Todos los datos están completos y guardados. Falta que alguien con permiso los confirme.",
    };
  }

  return {
    primary: "confirm",
    guidance:
      input.state === "review_required"
        ? `${INVALIDATED} Revisa los datos y confírmalos de nuevo.`
        : "Todos los datos están completos y guardados. Falta confirmarlos.",
  };
}
