import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Doctor, DoctorListParams, DoctorListResponse } from '../models/doctor.model';

const REQUEST_TIMEOUT = 15000;

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/doctors`;

  /** Dokter aktif di klinik user beserta jadwal praktiknya (tanpa paginasi). */
  list(params: DoctorListParams = {}): Observable<DoctorListResponse> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http
      .get<DoctorListResponse>(this.baseUrl, { params: httpParams })
      .pipe(timeout(REQUEST_TIMEOUT));
  }

  get(id: number): Observable<Doctor> {
    return this.http.get<{ data: Doctor }>(`${this.baseUrl}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT),
      map((res) => res.data),
    );
  }
}
