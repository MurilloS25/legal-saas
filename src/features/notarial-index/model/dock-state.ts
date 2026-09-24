/**
 * Estado del Índice que la sección expone al dock de la Escritura, para
 * que el dock sea el único lugar de "Guardar" y ofrezca "Confirmar Índice"
 * como acción de ciclo de vida. Solo existe con la Escritura finalizada: el
 * Índice solo es editable entonces y el contenido de la Escritura ya es de
 * solo lectura, así que el dock nunca tiene dos cosas distintas que guardar.
 */
export type NotarialDockState = {
  /** id del `<form>` del Índice que envía el botón Guardar del dock. */
  formId: string;
  /** El usuario puede guardar datos del Índice (y no están confirmados). */
  canSave: boolean;
  /** Hay algo que persistir (cambios o revisión pendiente). */
  saveEnabled: boolean;
  /** Cambios sin guardar: bloquea Reabrir para no perderlos. */
  unsaved: boolean;
  /** Guardado de los datos del Índice en curso. */
  saving: boolean;
  /** Confirmación/corrección en curso (no es un guardado). */
  confirming: boolean;
  /** Error del último guardado (sin descartar los cambios locales). */
  errorMessage?: string;
  confirmAvailable: boolean;
  /** Abre el diálogo de "Confirmar Índice" de la sección. */
  requestConfirm: () => void;
};
