import type { ReceivableStatus } from "./status";

export type ReceivableEntry = {
  id: string;
  client_id: string;
  document_id: string | null;
  concept: string;
  currency: string;
  amount_total: string;
  issued_at: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  document_title: string | null;
  paid_amount: string;
  balance_due: string;
  status: ReceivableStatus;
};

export type ReceivableRow = {
  id: string;
  client_id: string;
  document_id: string | null;
  concept: string;
  currency: string;
  amount_total: string;
  issued_at: string;
  due_at: string | null;
  notes: string | null;
};

export type CurrencyTotal = {
  currency: string;
  count: number;
  total: string;
  paid: string;
  balance: string;
};

export type ReceivablesWorkspacePage = {
  rows: ReceivableEntry[];
  totalCount: number;
  page: number;
  pageCount: number;
  totals: CurrencyTotal[];
};

export type ReceivablePayment = {
  id: string;
  amount: string;
  currency: string;
  paid_at: string;
  method: string;
  reference: string | null;
  status: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

export type ClientOption = { id: string; full_name: string };
export type DocumentOption = {
  id: string;
  title: string;
  client_id: string | null;
};
