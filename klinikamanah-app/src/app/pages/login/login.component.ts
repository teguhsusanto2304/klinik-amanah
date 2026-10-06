import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError, finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { ApiValidationError } from '../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-title>Sistem Klinik Amanah</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding login-content">
      <div class="login-wrapper">
        <!-- Header Branding -->
        <div class="header-section">
          <div class="logo-badge">
            <mat-icon color="primary">account_balance</mat-icon>
          </div>
          <h1>Selamat Datang</h1>
          <p>Silakan masuk ke akun manajemen klinik online Anda</p>
        </div>

        <!-- Form Login -->
        <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="form-container">
          <!-- Input Email -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input
              matInput
              type="email"
              formControlName="email"
              placeholder="Masukkan email Anda"
              autocomplete="email"
            />
            <mat-icon matPrefix color="action" class="prefix-icon">person</mat-icon>
            @if (loginForm.controls.email.hasError('required') && loginForm.controls.email.touched) {
              <mat-error>Email wajib diisi</mat-error>
            } @else if (loginForm.controls.email.hasError('email') && loginForm.controls.email.touched) {
              <mat-error>Format email tidak valid</mat-error>
            } @else if (loginForm.controls.email.hasError('server')) {
              <mat-error>{{ loginForm.controls.email.getError('server') }}</mat-error>
            }
          </mat-form-field>

          <!-- Input Password -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Kata Sandi</mat-label>
            <input
              matInput
              [type]="hidePassword() ? 'password' : 'text'"
              formControlName="password"
              placeholder="Masukkan kata sandi"
              autocomplete="current-password"
            />
            <mat-icon matPrefix color="action" class="prefix-icon">lock</mat-icon>
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="togglePasswordVisibility()"
              [attr.aria-label]="'Sembunyikan password'"
              [attr.aria-pressed]="hidePassword()"
            >
              <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (loginForm.controls.password.hasError('required') && loginForm.controls.password.touched) {
              <mat-error>Kata sandi wajib diisi</mat-error>
            } @else if (loginForm.controls.password.hasError('server')) {
              <mat-error>{{ loginForm.controls.password.getError('server') }}</mat-error>
            }
          </mat-form-field>

          @if (errorMessage()) {
            <div class="error-banner" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Action Button -->
          <button
            mat-raised-button
            color="primary"
            type="submit"
            class="submit-btn"
            [disabled]="loginForm.invalid || isLoading()"
          >
            @if (isLoading()) {
              <mat-spinner diameter="24" color="accent"></mat-spinner>
            } @else {
              <span>Masuk Aplikasi</span>
            }
          </button>
        </form>

        <!-- Footer Info -->
        <div class="footer-note">
          <p>Klinik Amanah &copy; 2026</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: #f8fafc;
    }

    .login-wrapper {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 80vh;
      max-width: 420px;
      margin: 0 auto;
      padding: 1rem;
    }

    .header-section {
      text-align: center;
      margin-bottom: 2rem;

      .logo-badge {
        width: 64px;
        height: 64px;
        background: #e0e7ff;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      h1 {
        font-size: 1.75rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 0.5rem 0;
      }

      p {
        font-size: 0.9rem;
        color: #64748b;
        margin: 0;
      }
    }

    .form-container {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .full-width {
        width: 100%;
      }

      .prefix-icon {
        margin-right: 8px;
      }

      .submit-btn {
        height: 50px;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        margin-top: 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.875rem;
    }

    .footer-note {
      text-align: center;
      margin-top: 3rem;

      p {
        font-size: 0.8rem;
        color: #94a3b8;
      }
    }
  `],
})
export class LoginComponent {
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  hidePassword = signal<boolean>(true);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility() {
    this.hidePassword.update((value) => !value);
  }

  onLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.loginForm.getRawValue();

    this.auth
      .login(email, password)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl('/main', { replaceUrl: true }),
        error: (err: unknown) => this.handleError(err),
      });
  }

  private handleError(err: unknown) {
    if (!(err instanceof HttpErrorResponse)) {
      console.error('[Login] gagal', err);
      this.errorMessage.set(
        err instanceof TimeoutError
          ? `Server tidak merespons (${environment.apiUrl}). Pastikan perangkat terhubung ke jaringan yang sama dengan server.`
          : 'Terjadi kesalahan. Silakan coba lagi.',
      );
      return;
    }

    console.error('[Login] gagal', err.status, err.url, err.message, JSON.stringify(err.error));

    if (err.status === 0) {
      this.errorMessage.set(
        `Tidak dapat terhubung ke server (${environment.apiUrl}). Periksa koneksi jaringan Anda.`,
      );
      return;
    }

    const body = err.error as ApiValidationError | null;

    // 422: { message, errors: { email: ["Email atau kata sandi tidak sesuai."] } }
    // Tampilkan di bawah field terkait; hilang otomatis saat user mengubah isinya.
    let shownOnField = false;
    for (const [field, messages] of Object.entries(body?.errors ?? {})) {
      const control = this.loginForm.get(field);
      if (control && messages?.length) {
        control.setErrors({ ...control.errors, server: messages[0] });
        control.markAsTouched();
        shownOnField = true;
      }
    }

    if (!shownOnField) {
      this.errorMessage.set(body?.message ?? 'Login gagal. Silakan coba lagi.');
    }
  }
}
