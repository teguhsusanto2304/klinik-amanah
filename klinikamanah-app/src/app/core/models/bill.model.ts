import { IdName, PaymentType, ReferenceOption, Visit } from './visit.model';

export type BillStatus = 'draft' | 'receivable' | 'paid';
/** Filter status di daftar tagihan: status tagihan + "unbilled" untuk kunjungan yang belum ditagih. */
export type BillListStatus = BillStatus | 'unbilled';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'qris' | 'transfer';
export type BillItemType = 'service' | 'medical' | 'nursing' | 'laboratory' | 'pharmacy';

export interface ServiceTariff {
  id: number;
  code: string;
  name: string;
  category: string;
  category_label: string;
  price: number;
}

export interface CashSessionSummary {
  opening_balance: number;
  payment_count: number;
  payments_total: number;
  /** Total per metode bayar (tunai sudah dikurangi kembalian). */
  methods: Record<PaymentMethod, number>;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
}

export interface CashSession {
  id: number;
  number: string;
  opened_at: string;
  summary: CashSessionSummary;
}

export interface BillReferences {
  payment_methods: ReferenceOption<PaymentMethod>[];
  statuses: ReferenceOption<BillStatus>[];
  payment_types: ReferenceOption<PaymentType>[];
  service_tariffs: ServiceTariff[];
  /** Sesi kasir yang sedang dibuka user; null = belum ada sesi terbuka. */
  cash_session: CashSession | null;
}

export interface BillItem {
  id: number;
  type: BillItemType;
  service_tariff_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface BillAbilities {
  update: boolean;
  pay: boolean;
  finalize: boolean;
  reopen: boolean;
  settle: boolean;
}

export interface PaymentDetail {
  method: PaymentMethod;
  method_label: string;
  amount: number;
  reference: string | null;
}

export interface Payment {
  id: number;
  number: string;
  bill_id: number;
  payer_type: string;
  status: 'completed' | 'cancelled';
  status_label: string;
  paid_at: string;
  amount: number;
  tendered: number;
  change_amount: number;
  notes: string | null;
  details?: PaymentDetail[];
  method_labels?: string;
  user?: IdName | null;
  session?: { id: number; number: string; status: string } | null;
  cancelled_at: string | null;
  canceller?: IdName | null;
  cancellation_reason: string | null;
  can_cancel?: boolean;
  bill?: Bill;
  created_at: string;
}

export interface Bill {
  id: number;
  number: string;
  bill_date: string;
  status: BillStatus;
  status_label: string;
  payer_type: string;
  payer_label: string;
  services_total: number;
  medical_total: number;
  nursing_total: number;
  laboratory_total: number;
  pharmacy_total: number;
  discount: number;
  total: number;
  paid_amount: number;
  outstanding: number;
  notes: string | null;
  finalized_at: string | null;
  clinic?: IdName | null;
  guarantor?: { id: number; code: string; name: string } | null;
  user?: IdName | null;
  /** Hanya ada di detail tagihan; relasi klinik/jadwal/penjamin kunjungan tidak disertakan. */
  visit?: Visit;
  items?: BillItem[];
  payments?: Payment[];
  abilities?: BillAbilities;
  created_at: string;
  updated_at: string;
}

/**
 * Tombol aksi di daftar tagihan, sama dengan halaman web:
 * create = Buat Tagihan, process = Proses (ubah/bayar), view = Lihat, null = tidak ada aksi.
 */
export type BillingAction = 'create' | 'process' | 'view' | null;

/** Baris daftar tagihan: kunjungan beserta tagihannya (null = belum ditagih). */
export type BillListItem = Visit & { bill: Bill | null; billing_action: BillingAction };

export interface BillListParams {
  /** Format Y-m-d; default hari ini. */
  date?: string;
  search?: string;
  status?: BillListStatus;
  payment_type?: PaymentType;
  per_page?: number;
  page?: number;
}

export interface BillUpsertRequest {
  services: { service_tariff_id: number; quantity: number }[];
  discount?: number;
  notes?: string;
}

export interface PaymentRequest {
  details: { method: PaymentMethod; amount: number; reference?: string }[];
  notes?: string;
}

/** Respons aksi yang mengubah data: resource + pesan dari server. */
export interface MutationResponse<T> {
  data: T;
  message: string;
}
