import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/patient.model';
import {
  Bill,
  BillListItem,
  BillListParams,
  BillReferences,
  BillUpsertRequest,
  MutationResponse,
  Payment,
  PaymentRequest,
} from '../models/bill.model';

const REQUEST_TIMEOUT = 15000;

@Injectable({ providedIn: 'root' })
export class BillService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Metode bayar, status, tarif layanan, dan sesi kasir terbuka.
   * Tidak di-cache karena ringkasan sesi kasir berubah setiap ada pembayaran.
   */
  references(): Observable<BillReferences> {
    return this.http.get<{ data: BillReferences }>(`${this.apiUrl}/bills/references`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  /** Kunjungan per tanggal beserta status tagihannya; meta.date = tanggal yang sedang ditampilkan. */
  list(params: BillListParams): Observable<PaginatedResponse<BillListItem> & { meta: { date: string } }> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http
      .get<PaginatedResponse<BillListItem> & { meta: { date: string } }>(`${this.apiUrl}/bills`, {
        params: httpParams,
      })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  /** Buat (201) atau perbarui (200) tagihan kunjungan. */
  upsert(visitId: number, body: BillUpsertRequest): Observable<MutationResponse<Bill>> {
    return this.http
      .put<MutationResponse<Bill>>(`${this.apiUrl}/visits/${visitId}/bill`, body)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  get(id: number): Observable<Bill> {
    return this.http.get<{ data: Bill }>(`${this.apiUrl}/bills/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  /** Jadikan tagihan penjamin sebagai piutang. */
  finalize(id: number): Observable<MutationResponse<Bill>> {
    return this.http
      .patch<MutationResponse<Bill>>(`${this.apiUrl}/bills/${id}/finalize`, null)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  /** Buka kembali piutang yang belum dibayar sama sekali. */
  reopen(id: number): Observable<MutationResponse<Bill>> {
    return this.http
      .patch<MutationResponse<Bill>>(`${this.apiUrl}/bills/${id}/reopen`, null)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  pay(billId: number, body: PaymentRequest): Observable<MutationResponse<Payment>> {
    return this.http
      .post<MutationResponse<Payment>>(`${this.apiUrl}/bills/${billId}/payments`, body)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  getPayment(id: number): Observable<Payment> {
    return this.http.get<{ data: Payment }>(`${this.apiUrl}/payments/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  cancelPayment(id: number, reason: string): Observable<MutationResponse<Payment>> {
    return this.http
      .patch<MutationResponse<Payment>>(`${this.apiUrl}/payments/${id}/cancel`, { cancellation_reason: reason })
      .pipe(timeout(REQUEST_TIMEOUT));
  }
}
