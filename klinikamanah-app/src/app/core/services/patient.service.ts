import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PaginatedResponse,
  PatientSearchParams,
  PatientSearchResult,
} from '../models/patient.model';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private http = inject(HttpClient);

  /** Cari pasien; minimal satu dari name, birth_date, atau medical_record_number wajib diisi. */
  search(params: PatientSearchParams): Observable<PaginatedResponse<PatientSearchResult>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return this.http
      .get<PaginatedResponse<PatientSearchResult>>(`${environment.apiUrl}/patients/search`, {
        params: httpParams,
      })
      .pipe(timeout(15000));
  }
}
