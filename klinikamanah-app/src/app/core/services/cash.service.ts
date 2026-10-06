import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/patient.model';
import { MutationResponse } from '../models/bill.model';
import {
  CashSessionDetail,
  CashSessionListParams,
  CashTransaction,
  CashTransactionListParams,
  CashTransactionReferences,
  CashTransactionRequest,
  CloseCashSessionRequest,
  OpenCashSessionRequest,
} from '../models/cash.model';

const REQUEST_TIMEOUT = 15000;

function toParams(params: object): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}

/** Sesi kasir & transaksi kas masuk/keluar. */
@Injectable({ providedIn: 'root' })
export class CashService {
  private http = inject(HttpClient);
  private sessionsUrl = `${environment.apiUrl}/cash-sessions`;
  private transactionsUrl = `${environment.apiUrl}/cash-transactions`;

  // --- Sesi kasir ---

  sessions(params: CashSessionListParams): Observable<PaginatedResponse<CashSessionDetail>> {
    return this.http
      .get<PaginatedResponse<CashSessionDetail>>(this.sessionsUrl, { params: toParams(params) })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  /** Sesi yang sedang dibuka oleh user ini; null jika tidak ada. */
  currentSession(): Observable<CashSessionDetail | null> {
    return this.http.get<{ data: CashSessionDetail | null }>(`${this.sessionsUrl}/current`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  openSession(body: OpenCashSessionRequest): Observable<MutationResponse<CashSessionDetail>> {
    return this.http
      .post<MutationResponse<CashSessionDetail>>(this.sessionsUrl, body)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  session(id: number): Observable<CashSessionDetail> {
    return this.http.get<{ data: CashSessionDetail }>(`${this.sessionsUrl}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  closeSession(id: number, body: CloseCashSessionRequest): Observable<MutationResponse<CashSessionDetail>> {
    return this.http
      .patch<MutationResponse<CashSessionDetail>>(`${this.sessionsUrl}/${id}/close`, body)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  // --- Kas masuk/keluar ---

  /** Tidak di-cache karena uang tunai di laci berubah setiap transaksi. */
  transactionReferences(): Observable<CashTransactionReferences> {
    return this.http.get<{ data: CashTransactionReferences }>(`${this.transactionsUrl}/references`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  /** meta berisi total_in & total_out (transaksi batal tidak dihitung). */
  transactions(
    params: CashTransactionListParams,
  ): Observable<PaginatedResponse<CashTransaction> & { meta: { total_in: number; total_out: number } }> {
    return this.http
      .get<PaginatedResponse<CashTransaction> & { meta: { total_in: number; total_out: number } }>(
        this.transactionsUrl,
        { params: toParams(params) },
      )
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  createTransaction(body: CashTransactionRequest): Observable<MutationResponse<CashTransaction>> {
    return this.http
      .post<MutationResponse<CashTransaction>>(this.transactionsUrl, body)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  transaction(id: number): Observable<CashTransaction> {
    return this.http.get<{ data: CashTransaction }>(`${this.transactionsUrl}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  cancelTransaction(id: number, reason: string): Observable<MutationResponse<CashTransaction>> {
    return this.http
      .patch<MutationResponse<CashTransaction>>(`${this.transactionsUrl}/${id}/cancel`, {
        cancellation_reason: reason,
      })
      .pipe(timeout(REQUEST_TIMEOUT));
  }
}
