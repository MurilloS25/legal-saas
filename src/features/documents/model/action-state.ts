export type DocumentDraftState = {
  /** Errores por field_key del machote. */
  errors?: Record<string, string>;
  titleError?: string;
  message?: string;
  success?: boolean;
  updatedAt?: string;
  conflictUpdatedAt?: string;
};

export type DeleteDocumentState = {
  message?: string;
  success?: boolean;
};

export type DuplicateDocumentState = {
  message?: string;
};

export type DocumentStatusState = {
  message?: string;
  success?: boolean;
  /** Cantidad de variables pendientes cuando bloquean finalizar. */
  pendingCount?: number;
};
