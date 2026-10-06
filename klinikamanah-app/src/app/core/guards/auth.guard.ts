import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Halaman yang butuh login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
};

/** Halaman khusus tamu (login): user yang sudah masuk diarahkan ke layar utama. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).createUrlTree(['/main']);
};
