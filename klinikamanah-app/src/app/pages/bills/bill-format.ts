import { BillItemType, BillListStatus, PaymentMethod } from '../../core/models/bill.model';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 90000 → "Rp 90.000". */
export function formatRupiah(value: number | null | undefined): string {
  return rupiahFormatter.format(value ?? 0).replace(/ /g, ' ');
}

/** Tanggal-jam ISO → "6 Okt 2026, 14.30". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const BILL_ITEM_TYPE_LABELS: Record<BillItemType, string> = {
  service: 'Layanan',
  medical: 'Tindakan Medis',
  nursing: 'Tindakan Keperawatan',
  laboratory: 'Laboratorium',
  pharmacy: 'Farmasi',
};

/** Label & kelas warna status tagihan, termasuk "belum ditagih". */
export const BILL_STATUS_LABELS: Record<BillListStatus, string> = {
  unbilled: 'Belum Ditagih',
  draft: 'Belum Dibayar',
  receivable: 'Piutang',
  paid: 'Lunas',
};

/** Sama dengan Payment::METHODS di server; dipakai untuk ringkasan per metode di sesi kasir. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  credit_card: 'Kartu Kredit',
  debit_card: 'Kartu Debit',
  qris: 'QRIS',
  transfer: 'Transfer Rekening',
};
