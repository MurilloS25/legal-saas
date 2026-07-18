/**
 * Etiquetas y estilo de badge de los estados de una escritura.
 *
 * Los estados válidos evolucionan por migración (`draft` inicialmente;
 * `ready`/`final` se agregan en el ciclo de vida). Este mapa centraliza la
 * presentación para el listado, el detalle y el compositor. Un estado
 * desconocido cae de forma segura al propio valor / estilo neutro.
 */

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  ready: "Revisión pendiente (histórico)",
  final: "Finalizada",
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABEL[status] ?? status;
}

// "Finalizada" es un estado positivo real (la escritura quedó lista) →
// verde semántico, no el acento decorativo.
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-amber-50 text-amber-700 border border-amber-200",
  final: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export function documentStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? "bg-slate-100 text-slate-600";
}
