import { IdName, Polyclinic } from './visit.model';

export interface Specialty {
  id: number;
  code: string;
  name: string;
  /** Gelar, mis. "Sp.A". */
  title: string | null;
}

/** Jadwal praktik rutin dokter (tanpa data kuota terpakai). */
export interface PracticeSchedule {
  id: number;
  polyclinic: Polyclinic | null;
  /** 1–7 = Senin–Minggu. */
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  /** null = tanpa batas kuota. */
  quota: number | null;
}

export interface Doctor {
  id: number;
  name: string;
  gender: 'L' | 'P' | null;
  gender_label: string | null;
  license_number: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  clinic: IdName | null;
  specialty: Specialty | null;
  practices_today: boolean;
  schedules: PracticeSchedule[];
}

export interface DoctorListParams {
  search?: string;
  specialty_id?: number;
  /** 1–7 = Senin–Minggu; hanya dokter & jadwal pada hari itu. */
  day_of_week?: number;
}

export interface DoctorListResponse {
  data: Doctor[];
  /** today: hari ini dalam format 1–7 (Senin–Minggu) menurut server. */
  meta: { clinic_id: number; today: number };
}
