import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, finalize, map, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MessageResponse,
} from '../models/auth.model';

const TOKEN_KEY = 'auth_token';
const TOKEN_TYPE_KEY = 'auth_token_type';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _tokenType = signal<string>(localStorage.getItem(TOKEN_TYPE_KEY) ?? 'Bearer');
  private readonly _user = signal<AuthUser | null>(this.readStoredUser());

  readonly token = this._token.asReadonly();
  readonly tokenType = this._tokenType.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(email: string, password: string): Observable<LoginResponse> {
    const body: LoginRequest = { email, password, device_name: this.deviceName() };

    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/login`, body)
      .pipe(
        timeout(15000),
        tap((res) => this.setSession(res)),
      );
  }

  /** Ambil ulang profil user dari server dan perbarui cache lokal. */
  me(): Observable<AuthUser> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/me`).pipe(
      map((res) => res.user),
      tap((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      }),
    );
  }

  /** Cabut token di server; sesi lokal tetap dihapus walau request gagal. */
  logout(): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${environment.apiUrl}/logout`, null)
      .pipe(finalize(() => this.clearSession()));
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TYPE_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._tokenType.set('Bearer');
    this._user.set(null);
  }

  hasPermission(permission: string): boolean {
    return this._user()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this._user()?.roles.includes(role) ?? false;
  }

  /** Cek izin seperti Gate di server: super-admin selalu diizinkan. */
  can(permission: string): boolean {
    return this.hasRole('super-admin') || this.hasPermission(permission);
  }

  private setSession(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(TOKEN_TYPE_KEY, res.token_type);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._token.set(res.access_token);
    this._tokenType.set(res.token_type);
    this._user.set(res.user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private deviceName(): string {
    const platform = Capacitor.getPlatform();
    const ua = navigator.userAgent;
    // Contoh UA Android: "... (Linux; Android 14; SM-A546E Build/...) ..."
    const model = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/)?.[1]?.trim();
    return model ? `${platform}-${model}` : `${platform}-${ua.slice(0, 60)}`;
  }
}
