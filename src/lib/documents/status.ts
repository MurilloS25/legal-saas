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
  ready: "Listo para revisar",
  final: "Finalizado",
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABEL[status] ?? status;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-amber-50 text-amber-700 border border-amber-200",
  final: "bg-teal-50 text-teal-700 border border-teal-200",
};

export function documentStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? "bg-slate-100 text-slate-600";
}
