import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/patient.model';
import {
  DoctorSchedule,
  Guarantor,
  RegistrationOptionsResponse,
  Visit,
  VisitListParams,
  VisitMutationResponse,
  VisitReferences,
  VisitRequest,
} from '../models/visit.model';

const REQUEST_TIMEOUT = 15000;

/** Ubah objek filter menjadi query string, abaikan nilai kosong. */
function toParams(params: object): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}

@Injectable({ providedIn: 'root' })
export class VisitService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/visits`;

  /** Pilihan referensi jarang berubah, jadi cukup diambil sekali per sesi aplikasi. */
  private references$?: Observable<VisitReferences>;

  references(): Observable<VisitReferences> {
    this.references$ ??= this.http
      .get<{ data: VisitReferences }>(`${this.baseUrl}/references`)
      .pipe(
        timeout(REQUEST_TIMEOUT),
        map((res) => res.data),
        // Jangan simpan kegagalan di cache, supaya bisa dicoba lagi.
        tap({ error: () => (this.references$ = undefined) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.references$;
  }

  /**
   * Jadwal dokter yang praktik hari ini. Dengan medicalRecordId: klinik rekam medis pasien;
   * tanpa itu: klinik user sendiri (admin semua klinik wajib mengirim salah satunya).
   */
  schedules(medicalRecordId?: number): Observable<RegistrationOptionsResponse<DoctorSchedule>> {
    return this.http
      .get<RegistrationOptionsResponse<DoctorSchedule>>(`${this.baseUrl}/schedules`, {
        params: toParams({ medical_record_id: medicalRecordId }),
      })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  /**
   * Penjamin yang aktif bekerja sama hari ini dengan klinik rekam medis pasien,
   * atau klinik user sendiri jika medicalRecordId tidak dikirim.
   */
  guarantors(medicalRecordId?: number): Observable<RegistrationOptionsResponse<Guarantor>> {
    return this.http
      .get<RegistrationOptionsResponse<Guarantor>>(`${this.baseUrl}/guarantors`, {
        params: toParams({ medical_record_id: medicalRecordId }),
      })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  register(body: VisitRequest): Observable<VisitMutationResponse> {
    return this.http.post<VisitMutationResponse>(this.baseUrl, body).pipe(timeout(REQUEST_TIMEOUT));
  }

  list(params: VisitListParams): Observable<PaginatedResponse<Visit>> {
    return this.http
      .get<PaginatedResponse<Visit>>(this.baseUrl, { params: toParams(params) })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  get(id: number): Observable<Visit> {
    return this.http.get<{ data: Visit }>(`${this.baseUrl}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }

  cancel(id: number): Observable<VisitMutationResponse> {
    return this.http
      .patch<VisitMutationResponse>(`${this.baseUrl}/${id}/cancel`, null)
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  /** Riwayat kunjungan pasien, dari yang terbaru. */
  history(medicalRecordId: number, page = 1, perPage = 20): Observable<PaginatedResponse<Visit>> {
    return this.http
      .get<PaginatedResponse<Visit>>(`${environment.apiUrl}/medical-records/${medicalRecordId}/visits`, {
        params: toParams({ page, per_page: perPage }),
      })
      .pipe(timeout(REQUEST_TIMEOUT));
  }
}
