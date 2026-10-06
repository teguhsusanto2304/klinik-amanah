export interface PatientSearchParams {
  name?: string;
  /** Format Y-m-d. */
  birth_date?: string;
  medical_record_number?: string;
  clinic_id?: number;
  per_page?: number;
  page?: number;
}

export interface PatientClinic {
  id: number;
  name: string;
}

export interface Patient {
  id: number;
  nik: string | null;
  name: string;
  birth_place: string | null;
  birth_date: string | null;
  age: number | null;
  gender: 'L' | 'P' | null;
  gender_label: string | null;
  phone: string | null;
  address: string | null;
}

export interface PatientSearchResult {
  medical_record_id: number;
  medical_record_number: string;
  clinic: PatientClinic | null;
  patient: Patient;
}

/** Meta paginasi standar Laravel API Resource. */
export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: PaginationMeta;
}
