import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { BillService } from './bill.service';
import { CashService } from './cash.service';
import { VisitService } from './visit.service';
import { BillListItem } from '../models/bill.model';
import { DoctorSchedule } from '../models/visit.model';

/** Batas halaman tagihan yang dijumlahkan (100 kunjungan per halaman). */
const MAX_BILL_PAGES = 10;

export interface RevenueSummary {
  /** Total yang sudah dibayar atas tagihan kunjungan hari ini. */
  paid: number;
  /** Sisa yang belum dibayar (belum dibayar + piutang). */
  outstanding: number;
  paidBills: number;
  billedVisits: number;
  unbilledVisits: number;
}

export interface VisitSummary {
  registered: number;
  cancelled: number;
}

export interface CashSummary {
  totalIn: number;
  totalOut: number;
}

/**
 * Hasil tiap bagian ringkasan:
 * data = berhasil; null = tidak punya akses (403) sehingga kartu disembunyikan;
 * 'error' = gagal dimuat (jaringan dsb).
 */
export type SummaryPart<T> = T | null | 'error';

/**
 * Ringkasan beranda, disusun dari endpoint yang sudah ada karena belum ada endpoint dashboard.
 * Setiap bagian dimuat terpisah supaya satu kegagalan/izin tidak menghalangi bagian lain.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private billService = inject(BillService);
  private visitService = inject(VisitService);
  private cashService = inject(CashService);

  /** Pendapatan dari tagihan kunjungan tanggal tersebut (GET /bills, semua halaman). */
  revenue(date: string): Observable<SummaryPart<RevenueSummary>> {
    const page = (n: number) => this.billService.list({ date, per_page: 100, page: n });
    return page(1).pipe(
      switchMap((first) => {
        const last = Math.min(first.meta.last_page, MAX_BILL_PAGES);
        const rest = Array.from({ length: last - 1 }, (_, i) => page(i + 2));
        return rest.length ? forkJoin(rest).pipe(map((pages) => [first, ...pages])) : of([first]);
      }),
      map((pages) => this.sumRevenue(pages.flatMap((p) => p.data))),
      this.handle<RevenueSummary>(),
    );
  }

  /** Jumlah kunjungan terdaftar & batal (dari meta.total, cukup 1 baris per request). */
  visits(date: string): Observable<SummaryPart<VisitSummary>> {
    return forkJoin({
      registered: this.visitService.list({ date, status: 'registered', per_page: 1 }),
      cancelled: this.visitService.list({ date, status: 'cancelled', per_page: 1 }),
    }).pipe(
      map(({ registered, cancelled }) => ({ registered: registered.meta.total, cancelled: cancelled.meta.total })),
      this.handle<VisitSummary>(),
    );
  }

  /** Total kas masuk/keluar (tidak termasuk yang dibatalkan) pada tanggal tersebut. */
  cash(date: string): Observable<SummaryPart<CashSummary>> {
    return this.cashService.transactions({ from: date, to: date, per_page: 1 }).pipe(
      map((res) => ({ totalIn: res.meta.total_in, totalOut: res.meta.total_out })),
      this.handle<CashSummary>(),
    );
  }

  /** Jadwal dokter yang praktik hari ini beserta sisa kuota. */
  schedules(): Observable<SummaryPart<DoctorSchedule[]>> {
    return this.visitService.schedules().pipe(
      map((res) => res.data),
      this.handle<DoctorSchedule[]>(),
    );
  }

  private sumRevenue(items: BillListItem[]): RevenueSummary {
    const summary: RevenueSummary = { paid: 0, outstanding: 0, paidBills: 0, billedVisits: 0, unbilledVisits: 0 };
    for (const item of items) {
      const bill = item.bill;
      if (!bill) {
        summary.unbilledVisits++;
        continue;
      }
      summary.billedVisits++;
      summary.paid += bill.paid_amount;
      summary.outstanding += bill.outstanding;
      if (bill.status === 'paid') summary.paidBills++;
    }
    return summary;
  }

  /** 403 → null (kartu disembunyikan); 401 diteruskan (ditangani interceptor); error lain → 'error'. */
  private handle<T>() {
    return (source: Observable<T>): Observable<SummaryPart<T>> =>
      source.pipe(
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) return throwError(() => err);
          if (err instanceof HttpErrorResponse && err.status === 403) return of(null);
          return of('error' as const);
        }),
      );
  }
}
