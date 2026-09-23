/**
 * Estado de la indicación de IA en un Machote generado con "Crear con IA".
 *
 * Señal de revisión humana (la más simple y segura del lifecycle actual):
 * el Machote fue guardado con cambios DESPUÉS de terminar la generación, es
 * decir `templates.updated_at > ai_template_generations.finished_at`.
 *
 * - La generación crea el borrador y luego cierra el libro (`finished_at`
 *   posterior a la creación), así que un Machote recién generado nunca
 *   cuenta como revisado.
 * - `save_template_workspace` solo actualiza la fila cuando algo cambió, y
 *   el trigger `templates_set_updated_at` fija `updated_at`; publicar
 *   (cambiar el estado) también cuenta. Abrir el Machote o guardar sin
 *   cambios no cuenta.
 * - Guardar solo la configuración del Índice no toca `templates`, por lo
 *   que no cuenta como revisión del contenido.
 *
 * La trazabilidad (fila del libro, proveedor, modelo, fecha, auditoría)
 * nunca cambia: esto solo decide la presentación.
 */

export type AiNoticeState = "pending_review" | "reviewed";

export function aiNoticeState(input: {
  templateUpdatedAt: string;
  generatedAt: string;
}): AiNoticeState {
  const updated = Date.parse(input.templateUpdatedAt);
  const generated = Date.parse(input.generatedAt);
  if (Number.isNaN(updated) || Number.isNaN(generated)) return "pending_review";
  return updated > generated ? "reviewed" : "pending_review";
}
