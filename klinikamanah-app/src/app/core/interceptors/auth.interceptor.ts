import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  const authReq = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `${auth.tokenType()} ${token}` } : {}),
    },
  });

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        auth.clearSession();
        router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => err);
    }),
  );
};
