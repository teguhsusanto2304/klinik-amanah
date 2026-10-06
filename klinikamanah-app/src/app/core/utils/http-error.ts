import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { ApiValidationError } from '../models/auth.model';

/** Ubah error request API menjadi pesan yang bisa ditampilkan ke pengguna. */
export function describeHttpError(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (err instanceof TimeoutError) {
    return 'Server tidak merespons. Periksa koneksi lalu coba lagi.';
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiValidationError | null;
    switch (err.status) {
      case 0:
        return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      case 403:
        return body?.message && body.message !== 'This action is unauthorized.'
          ? body.message
          : 'Anda tidak memiliki izin untuk melakukan aksi ini.';
      case 404:
        return 'Data tidak ditemukan.';
      case 422: {
        const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null;
        return first ?? body?.message ?? fallback;
      }
    }
  }
  return fallback;
}

/** Ambil error validasi per field dari respons 422 Laravel. */
export function validationErrors(err: unknown): Record<string, string[]> {
  if (err instanceof HttpErrorResponse && err.status === 422) {
    return (err.error as ApiValidationError | null)?.errors ?? {};
  }
  return {};
}
