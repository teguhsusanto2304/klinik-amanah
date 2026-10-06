export type PaymentType = 'self' | 'guarantor';
export type ReferralType = 'none' | 'internal' | 'external' | 'back';
export type VisitStatus = 'registered' | 'cancelled';

export interface ReferenceOption<T extends string = string> {
  value: T;
  label: string;
}

export interface VisitReferences {
  payment_types: ReferenceOption<PaymentType>[];
  referral_types: ReferenceOption<ReferralType>[];
  statuses: ReferenceOption<VisitStatus>[];
}

export interface IdName {
  id: number;
  name: string;
}

export interface Polyclinic {
  id: number;
  code: string;
  name: string;
}

export interface VisitDoctor {
  id: number;
  name: string;
  specialty: IdName | null;
}

export interface DoctorSchedule {
  id: number;
  doctor: VisitDoctor;
  polyclinic: Polyclinic | null;
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  /** null = tanpa batas kuota. */
  quota: number | null;
  registered_visits_count: number;
  remaining_quota: number | null;
  is_full: boolean;
}

export interface Guarantor {
  id: number;
  code: string;
  name: string;
  type: string;
  type_label: string;
  category: string;
  category_label: string;
  cooperation_starts_at: string | null;
  cooperation_ends_at: string | null;
}

/** Respons koleksi jadwal/penjamin: data + meta tanggal & klinik. */
export interface RegistrationOptionsResponse<T> {
  data: T[];
  meta: { date: string; clinic_id: number };
}

export interface VisitPatient {
  id: number;
  nik: string | null;
  name: string;
  birth_date: string | null;
  age: number | null;
  gender: 'L' | 'P' | null;
  gender_label: string | null;
  phone: string | null;
}

export interface Visit {
  id: number;
  visit_date: string;
  queue_number: number;
  formatted_queue_number: string;
  status: VisitStatus;
  status_label: string;
  complaint: string | null;
  clinic: IdName | null;
  medical_record: { id: number; number: string; patient: VisitPatient | null };
  doctor: VisitDoctor;
  schedule: {
    id: number;
    day_of_week: number;
    day_label: string;
    start_time: string;
    end_time: string;
  } | null;
  polyclinic: Polyclinic | null;
  payment_type: PaymentType;
  payment_type_label: string;
  guarantor: { id: number; code: string; name: string } | null;
  guarantor_member_number: string | null;
  referral: {
    type: ReferralType;
    type_label: string;
    facility: string | null;
    number: string | null;
    date: string | null;
    has_document: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface VisitRequest {
  medical_record_id: number;
  doctor_schedule_id: number;
  payment_type: PaymentType;
  guarantor_id?: number;
  guarantor_member_number?: string;
  referral_type: ReferralType;
  referral_facility?: string;
  referral_number?: string;
  referral_date?: string;
  has_referral_document?: boolean;
  complaint?: string;
}

/** Respons POST/PATCH kunjungan: data + pesan dari server. */
export interface VisitMutationResponse {
  data: Visit;
  message: string;
}

export interface VisitListParams {
  /** Format Y-m-d; default hari ini. */
  date?: string;
  search?: string;
  doctor_id?: number;
  polyclinic_id?: number;
  payment_type?: PaymentType;
  status?: VisitStatus;
  clinic_id?: number;
  per_page?: number;
  page?: number;
}
