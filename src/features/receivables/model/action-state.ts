import type { ReceivableEntry } from "./types";

export type ReceivableState = {
  errors?: {
    client_id?: string;
    client_name?: string;
    document_id?: string;
    concept?: string;
    currency?: string;
    amount_total?: string;
    issued_at?: string;
    due_at?: string;
    notes?: string;
  };
  message?: string;
  success?: boolean;
  /** Solo poblado por `createReceivableForDialogAction` (modo diálogo,
   * creación contextual desde una Escritura, que nunca redirige). */
  receivable?: ReceivableEntry;
};

export type DeleteReceivableState = {
  message?: string;
};

export type PaymentState = {
  errors?: {
    amount?: string;
    paid_at?: string;
    method?: string;
    reference?: string;
  };
  message?: string;
  /** Solo poblado por `registerPaymentForDialogAction` (modo diálogo,
   * registro contextual desde una Escritura, que nunca redirige). */
  success?: boolean;
};

export type VoidPaymentState = {
  error?: string;
};
