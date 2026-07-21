/**
 * Máquina de estados del ciclo de vida de una escritura.
 *
 * La experiencia visible usa Borrador ↔ Finalizada. `ready` se conserva
 * únicamente para documentos históricos y puede resolverse a draft o final.
 * `final` no implica firma, presentación ni validez legal.
 */

export const DOCUMENT_STATUSES = ["draft", "ready", "final"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["ready", "final"],
  ready: ["draft", "final"],
  final: ["draft"],
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
  reopen: "draft",
};

const ACTION_ALLOWED_FROM: Record<DocumentAction, readonly DocumentStatus[]> = {
  mark_ready: ["draft"],
  return_to_draft: ["ready"],
  mark_final: ["draft", "ready"],
  reopen: ["final"],
};

export function isActionAllowed(
  status: DocumentStatus,
  action: DocumentAction,
): boolean {
  return ACTION_ALLOWED_FROM[action].includes(status) &&
    canTransition(status, ACTION_TARGET[action]);
}
