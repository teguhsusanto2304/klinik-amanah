/** Tanggal Y-m-d → "6 Oktober 2026". */
export function formatDate(value: string | null | undefined, month: 'long' | 'short' = 'long'): string {
  if (!value) return '-';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month,
    year: 'numeric',
  });
}

/** Jam "08:00:00" → "08:00". */
export function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '-';
}

/** Tanggal hari ini (zona waktu perangkat) dalam format Y-m-d. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
