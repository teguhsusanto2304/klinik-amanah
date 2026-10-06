/** Hari praktik sesuai DoctorSchedule::DAYS di server (ISO: 1 = Senin … 7 = Minggu). */
export const DAYS = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
  { value: 7, label: 'Minggu', short: 'Min' },
] as const;

/** Inisial nama dokter tanpa gelar depan, mis. "dr. Andi Wijaya, Sp.A" → "AW". */
export function doctorInitials(name: string): string {
  return name
    .split(',')[0]
    .replace(/^(dr|drg|prof|ns)\.?\s+/i, '')
    .split(/\s+/)
    .filter((part) => /^[a-z]/i.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
