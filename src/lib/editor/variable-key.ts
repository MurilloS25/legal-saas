/** Formato compartido de claves usadas por variables del editor. */
export const FIELD_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

/** Placeholder textual legacy con espacios opcionales dentro de las llaves. */
export const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;

/**
 * Segmento base de una clave válida — sin llaves, sin anclas — compartido
 * por `FIELD_KEY_PATTERN` y por las reglas de entrada/pegado del editor
 * (`tiptap.ts`) que convierten texto `{{clave}}` en una variable real.
 */
const FIELD_KEY_SOURCE = "[a-z0-9_]+(?:\\.[a-z0-9_]+)*";

/**
 * Placeholder `{{clave}}` con una clave sintácticamente válida, anclado al
 * final (`$`) para usarse como regla de entrada: se dispara justo después de
 * escribir el `}}` de cierre. Un placeholder con una clave inválida (mayúsculas,
 * espacios, llaves vacías, etc.) simplemente no coincide y permanece como
 * texto plano — no hay conversión parcial ni sustitución silenciosa.
 */
export const VARIABLE_INPUT_RULE_PATTERN = new RegExp(
  `\\{\\{(${FIELD_KEY_SOURCE})\\}\\}$`,
);

/**
 * Misma sintaxis que `VARIABLE_INPUT_RULE_PATTERN`, pero global y sin ancla:
 * usada como regla de pegado para convertir todas las ocurrencias válidas de
 * un texto pegado de una sola vez.
 */
export const VARIABLE_PASTE_RULE_PATTERN = new RegExp(
  `\\{\\{(${FIELD_KEY_SOURCE})\\}\\}`,
  "g",
);
