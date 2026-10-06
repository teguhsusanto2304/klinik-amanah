import { CashSessionSummary, Payment } from './bill.model';
import { IdName, ReferenceOption } from './visit.model';

export type CashSessionStatus = 'open' | 'closed';
export type CashTransactionType = 'in' | 'out';
export type CashTransactionMethod = 'cash' | 'transfer';
export type CashTransactionStatus = 'completed' | 'cancelled';

export interface CashSessionDetail {
  id: number;
  number: string;
  status: CashSessionStatus;
  status_label: string;
  opened_at: string;
  opening_balance: number;
  opening_notes: string | null;
  closed_at: string | null;
  /** Diisi saat sesi ditutup. */
  expected_cash: number | null;
  counted_cash: number | null;
  /** counted_cash - expected_cash; positif = lebih, negatif = kurang. */
  difference: number | null;
  closing_notes: string | null;
  clinic?: IdName | null;
  user?: IdName | null;
  /** Hanya ada di detail sesi. */
  summary?: CashSessionSummary;
  payments?: Payment[];
  cash_transactions?: CashTransaction[];
  /** Hanya kasir pemilik sesi yang masih berjalan. */
  can_close?: boolean;
  created_at: string;
}

export interface CashSessionListParams {
  date?: string;
  status?: CashSessionStatus;
  per_page?: number;
  page?: number;
}

export interface OpenCashSessionRequest {
  opening_balance: number;
  opening_notes?: string;
}

export interface CloseCashSessionRequest {
  counted_cash: number;
  closing_notes?: string;
}

export interface CashTransaction {
  id: number;
  number: string;
  type: CashTransactionType;
  type_label: string;
  category: string;
  category_label: string;
  method: CashTransactionMethod;
  method_label: string;
  status: CashTransactionStatus;
  status_label: string;
  transaction_date: string;
  amount: number;
  description: string;
  reference: string | null;
  clinic?: IdName | null;
  user?: IdName | null;
  session?: { id: number; number: string; status: CashSessionStatus } | null;
  cancelled_at: string | null;
  canceller?: IdName | null;
  cancellation_reason: string | null;
  can_cancel?: boolean;
  created_at: string;
}

export interface CashTransactionReferences {
  types: ReferenceOption<CashTransactionType>[];
  /** Kategori per jenis transaksi. */
  categories: Record<CashTransactionType, ReferenceOption[]>;
  methods: ReferenceOption<CashTransactionMethod>[];
  statuses: ReferenceOption<CashTransactionStatus>[];
  /** Sesi kasir terbuka milik user beserta uang tunai di laci; null = tidak ada sesi. */
  cash_session: { id: number; number: string; cash_in_drawer: number } | null;
}

export interface CashTransactionListParams {
  type?: CashTransactionType;
  from?: string;
  to?: string;
  category?: string;
  method?: CashTransactionMethod;
  status?: CashTransactionStatus;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface CashTransactionRequest {
  type: CashTransactionType;
  category: string;
  method: CashTransactionMethod;
  transaction_date: string;
  amount: number;
  description: string;
  reference?: string;
}
