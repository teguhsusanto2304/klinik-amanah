import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError, finalize } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  InfiniteScrollCustomEvent,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonMenuButton,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { PaginationMeta, PatientSearchParams, PatientSearchResult } from '../../core/models/patient.model';
import { ApiValidationError } from '../../core/models/auth.model';

const PER_PAGE = 20;

interface PatientAction {
  key: 'appointment' | 'visit' | 'history';
  label: string;
  icon: string;
  color: string;
}

/** Minimal satu kriteria pencarian wajib diisi. */
function atLeastOneFilled(group: AbstractControl): ValidationErrors | null {
  const { name, birth_date, medical_record_number } = group.value;
  return name?.trim() || birth_date || medical_record_number?.trim() ? null : { empty: true };
}

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Cari Pasien</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding search-content">
      <div class="search-wrapper">
        <!-- Form pencarian -->
        <form [formGroup]="form" (ngSubmit)="onSearch()" class="card search-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nama pasien</mat-label>
            <input matInput formControlName="name" placeholder="Minimal 3 karakter" autocomplete="off" />
            <mat-icon matPrefix>person_search</mat-icon>
            @if (form.controls.name.hasError('minlength')) {
              <mat-error>Nama minimal 3 karakter</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>No. rekam medis</mat-label>
            <input matInput formControlName="medical_record_number" placeholder="RM-000012 atau 000012" autocomplete="off" />
            <mat-icon matPrefix>badge</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tanggal lahir</mat-label>
            <input matInput type="date" formControlName="birth_date" />
            <mat-icon matPrefix>cake</mat-icon>
          </mat-form-field>

          @if (submitted() && form.hasError('empty')) {
            <p class="form-error">Isi minimal satu kriteria pencarian.</p>
          }

          <div class="actions">
            <button mat-stroked-button type="button" (click)="onReset()" [disabled]="isLoading()">
              Reset
            </button>
            <button mat-flat-button color="primary" type="submit" [disabled]="isLoading()">
              @if (isLoading() && !isLoadingMore()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>search</mat-icon>
              }
              Cari
            </button>
          </div>
        </form>

        <!-- Hasil -->
        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
          </section>
        } @else if (meta(); as m) {
          <p class="result-count">
            @if (m.total > 0) {
              Ditemukan <strong>{{ m.total }}</strong> pasien
            }
          </p>

          @for (item of results(); track item.medical_record_id) {
            <section class="card patient-card">
              <div class="patient-head">
                <div class="avatar" [class.female]="item.patient.gender === 'P'">
                  <mat-icon>{{ item.patient.gender === 'P' ? 'woman' : 'man' }}</mat-icon>
                </div>
                <div class="patient-title">
                  <h3>{{ item.patient.name }}</h3>
                  <span class="rm">{{ item.medical_record_number }}</span>
                </div>
              </div>

              <div class="patient-info">
                <div>
                  <mat-icon>wc</mat-icon>
                  {{ item.patient.gender_label ?? '-' }}
                  @if (item.patient.age !== null) { · {{ item.patient.age }} tahun }
                </div>
                <div>
                  <mat-icon>cake</mat-icon>
                  {{ birthInfo(item) }}
                </div>
                <div>
                  <mat-icon>fingerprint</mat-icon>
                  NIK {{ item.patient.nik || '-' }}
                </div>
                <div>
                  <mat-icon>phone</mat-icon>
                  {{ item.patient.phone || '-' }}
                </div>
                <div>
                  <mat-icon>home</mat-icon>
                  {{ item.patient.address || '-' }}
                </div>
                @if (item.clinic) {
                  <div>
                    <mat-icon>local_hospital</mat-icon>
                    {{ item.clinic.name }}
                  </div>
                }
              </div>

              <div class="patient-actions">
                @for (action of availableActions; track action.key) {
                  <button type="button" class="action-btn" [style.color]="action.color" (click)="onAction(action, item)">
                    <mat-icon>{{ action.icon }}</mat-icon>
                    {{ action.label }}
                  </button>
                }
              </div>
            </section>
          } @empty {
            <section class="card state">
              <mat-icon>search_off</mat-icon>
              <p>Pasien tidak ditemukan. Coba ubah kriteria pencarian.</p>
            </section>
          }
        } @else if (!isLoading()) {
          <section class="state hint">
            <mat-icon>person_search</mat-icon>
            <p>Cari pasien berdasarkan nama, nomor rekam medis, atau tanggal lahir.</p>
          </section>
        }
      </div>

      <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="onLoadMore($event)">
        <ion-infinite-scroll-content loadingText="Memuat..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: [`
    .search-content {
      --background: #f8fafc;
    }

    .search-wrapper {
      max-width: 520px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .search-form {
      padding-bottom: 1rem;
    }

    .full-width {
      width: 100%;
    }

    mat-form-field mat-icon[matPrefix] {
      margin: 0 0.5rem 0 0.75rem;
      color: #94a3b8;
    }

    .form-error {
      margin: -0.5rem 0 0.75rem;
      font-size: 0.8rem;
      color: #dc2626;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }
    }

    .result-count {
      margin: 0 0.25rem;
      font-size: 0.85rem;
      color: #64748b;
    }

    .patient-card {
      padding: 1rem 1.25rem;
    }

    .patient-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;

      .avatar {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #dbeafe;
        color: #1d4ed8;
        display: flex;
        align-items: center;
        justify-content: center;

        &.female {
          background: #fce7f3;
          color: #be185d;
        }
      }

      .patient-title {
        min-width: 0;
      }

      h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
      }

      .rm {
        display: inline-block;
        margin-top: 0.2rem;
        padding: 0.1rem 0.55rem;
        border-radius: 999px;
        background: #ede9fe;
        color: #6d28d9;
        font-size: 0.75rem;
        font-weight: 600;
      }
    }

    .patient-info {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: #475569;

      div {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
      }

      mat-icon {
        flex-shrink: 0;
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-top: 2px;
        color: #94a3b8;
      }
    }

    .patient-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.85rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f1f5f9;
    }

    .action-btn {
      flex: 1 1 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.55rem 0.5rem;
      border: none;
      border-radius: 10px;
      background: color-mix(in srgb, currentColor 10%, transparent);
      cursor: pointer;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s;

      &:active {
        transform: scale(0.97);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
      }

      &.error mat-icon {
        color: #f87171;
      }

      &.hint {
        padding: 2rem 1rem;
      }
    }
  `],
})
export class PatientSearchComponent {
  private fb = inject(NonNullableFormBuilder);
  private patientService = inject(PatientService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private auth = inject(AuthService);

  readonly actions: PatientAction[] = [
    { key: 'appointment', label: 'Janji Temu', icon: 'event_available', color: '#ea580c' },
    { key: 'visit', label: 'Registrasi Kunjungan', icon: 'how_to_reg', color: '#16a34a' },
    { key: 'history', label: 'Riwayat', icon: 'history', color: '#475569' },
  ];

  form = this.fb.group(
    {
      name: ['', Validators.minLength(3)],
      medical_record_number: [''],
      birth_date: [''],
    },
    { validators: atLeastOneFilled },
  );

  results = signal<PatientSearchResult[]>([]);
  meta = signal<PaginationMeta | null>(null);
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  submitted = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  /** Kriteria pencarian terakhir, dipakai saat memuat halaman berikutnya. */
  private lastParams: PatientSearchParams | null = null;

  onSearch() {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { name, medical_record_number, birth_date } = this.form.getRawValue();
    this.lastParams = {
      name: name.trim(),
      medical_record_number: medical_record_number.trim(),
      birth_date,
      per_page: PER_PAGE,
    };
    this.results.set([]);
    this.meta.set(null);
    this.hasMore.set(false);
    this.fetch(1);
  }

  onReset() {
    this.form.reset();
    this.submitted.set(false);
    this.lastParams = null;
    this.results.set([]);
    this.meta.set(null);
    this.hasMore.set(false);
    this.errorMessage.set(null);
  }

  onLoadMore(event: InfiniteScrollCustomEvent) {
    const page = (this.meta()?.current_page ?? 0) + 1;
    this.fetch(page, () => event.target.complete());
  }

  /** Tombol registrasi kunjungan hanya untuk user yang boleh mendaftarkan kunjungan. */
  readonly availableActions = this.actions.filter(
    (a) => a.key !== 'visit' || this.auth.can('visits.create'),
  );

  async onAction(action: PatientAction, item: PatientSearchResult) {
    if (action.key === 'visit') {
      this.router.navigate(['/main/visits/register', item.medical_record_id], { state: { patient: item } });
      return;
    }
    if (action.key === 'history') {
      this.router.navigate(['/main/patients', item.medical_record_id, 'visits'], {
        state: { patientName: item.patient.name, medicalRecordNumber: item.medical_record_number },
      });
      return;
    }

    // TODO: arahkan ke form janji temu setelah API-nya tersedia.
    const toast = await this.toastCtrl.create({
      message: `${action.label} untuk ${item.patient.name} segera hadir.`,
      duration: 1500,
      position: 'bottom',
      positionAnchor: 'main-tab-bar',
    });
    await toast.present();
  }

  birthInfo(item: PatientSearchResult): string {
    const { birth_place, birth_date } = item.patient;
    const date = birth_date
      ? new Date(`${birth_date}T00:00:00`).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    return [birth_place, date].filter(Boolean).join(', ') || '-';
  }

  private fetch(page: number, done?: () => void) {
    if (!this.lastParams) {
      done?.();
      return;
    }

    this.isLoading.set(true);
    this.isLoadingMore.set(page > 1);
    this.errorMessage.set(null);

    this.patientService
      .search({ ...this.lastParams, page })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          this.results.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
        },
        error: (err: unknown) => {
          // Gagal memuat halaman berikutnya: hasil yang sudah tampil tetap dipertahankan.
          this.hasMore.set(false);
          if (page === 1) this.errorMessage.set(this.describeError(err));
        },
      });
  }

  private describeError(err: unknown): string {
    if (err instanceof TimeoutError) {
      return 'Server tidak merespons. Periksa koneksi lalu coba lagi.';
    }
    if (err instanceof HttpErrorResponse) {
      switch (err.status) {
        case 0:
          return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
        case 403:
          return 'Anda tidak memiliki izin untuk melihat data rekam medis.';
        case 422: {
          const body = err.error as ApiValidationError | null;
          const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null;
          return first ?? body?.message ?? 'Kriteria pencarian tidak valid.';
        }
      }
    }
    return 'Terjadi kesalahan saat mencari pasien. Coba lagi.';
  }
}
