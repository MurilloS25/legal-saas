/**
 * Máquina de estados del ciclo de vida de una escritura.
 *
 * Estados: draft (borrador) → ready (listo para revisar) → final (finalizado).
 * Transiciones permitidas:
 *
 *   draft  → ready
 *   ready  → draft
 *   ready  → final
 *   final  → ready   (reabrir)
 *
 * No se permite draft → final directo (debe pasar por ready). No hay bloqueo
 * irreversible: un documento finalizado puede reabrirse a ready. `final` no
 * implica firma ni validez legal.
 */

export const DOCUMENT_STATUSES = ["draft", "ready", "final"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["ready"],
  ready: ["draft", "final"],
  final: ["ready"],
};

export function isDocumentStatus(value: string): value is DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Un documento finalizado es de solo lectura hasta reabrirse. */
export function isReadOnlyStatus(status: string): boolean {
  return status === "final";
}

export type DocumentAction = "mark_ready" | "return_to_draft" | "mark_final" | "reopen";

/** Estado destino de cada acción del ciclo de vida. */
export const ACTION_TARGET: Record<DocumentAction, DocumentStatus> = {
  mark_ready: "ready",
  return_to_draft: "draft",
  mark_final: "final",
  reopen: "ready",
};

const ACTION_ALLOWED_FROM: Record<DocumentAction, DocumentStatus> = {
  mark_ready: "draft",
  return_to_draft: "ready",
  mark_final: "ready",
  reopen: "final",
};

export function isActionAllowed(
  status: DocumentStatus,
  action: DocumentAction,
): boolean {
  return status === ACTION_ALLOWED_FROM[action] &&
    canTransition(status, ACTION_TARGET[action]);
}
