import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { finalize, forkJoin, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { VisitService } from '../../core/services/visit.service';
import { PatientSearchResult } from '../../core/models/patient.model';
import {
  DoctorSchedule,
  Guarantor,
  PaymentType,
  ReferralType,
  VisitReferences,
  VisitRequest,
} from '../../core/models/visit.model';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { formatDate, formatTime, todayIso } from './visit-format';

/** Jenis rujukan yang wajib mencantumkan fasilitas kesehatan perujuk. */
const REFERRAL_WITH_FACILITY: ReferralType[] = ['external', 'back'];

/**
 * Form registrasi kunjungan pasien untuk hari ini.
 * Data pasien dikirim lewat navigation state dari halaman pencarian pasien;
 * jika tidak ada (mis. halaman dimuat ulang), hanya ID rekam medis yang dipakai.
 */
@Component({
  selector: 'app-visit-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/patients"></ion-back-button>
        </ion-buttons>
        <ion-title>Registrasi Kunjungan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding register-content">
      <div class="register-wrapper">
        <!-- Pasien -->
        <section class="card patient-card">
          <div class="avatar"><mat-icon>person</mat-icon></div>
          <div class="patient-text">
            @if (patient(); as p) {
              <h2>{{ p.patient.name }}</h2>
              <p>
                {{ p.medical_record_number }}
                @if (p.patient.age !== null) { · {{ p.patient.age }} tahun }
                @if (p.patient.gender_label) { · {{ p.patient.gender_label }} }
              </p>
              @if (p.clinic) {
                <p class="muted">{{ p.clinic.name }}</p>
              }
            } @else {
              <h2>Rekam medis #{{ medicalRecordId }}</h2>
            }
          </div>
          <span class="date-chip">
            <mat-icon>today</mat-icon>
            {{ today }}
          </span>
        </section>

        @if (isLoading()) {
          <section class="card state">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Memuat jadwal dokter dan penjamin...</p>
          </section>
        } @else if (loadError(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="loadOptions()">Coba lagi</button>
          </section>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Jadwal dokter -->
            <section class="card">
              <div class="section-head">
                <h3>Dokter &amp; Jadwal</h3>
                <button type="button" class="link-btn" (click)="reloadSchedules()" [disabled]="isReloadingSchedules()">
                  <mat-icon>refresh</mat-icon> Perbarui kuota
                </button>
              </div>

              <div class="schedule-list" role="radiogroup">
                @for (s of schedules(); track s.id) {
                  <button
                    type="button"
                    role="radio"
                    class="schedule-item"
                    [class.selected]="form.controls.doctor_schedule_id.value === s.id"
                    [attr.aria-checked]="form.controls.doctor_schedule_id.value === s.id"
                    [disabled]="s.is_full"
                    (click)="selectSchedule(s)"
                  >
                    <mat-icon class="radio">
                      {{ form.controls.doctor_schedule_id.value === s.id ? 'radio_button_checked' : 'radio_button_unchecked' }}
                    </mat-icon>
                    <div class="schedule-text">
                      <strong>{{ s.doctor.name }}</strong>
                      <span>{{ s.doctor.specialty?.name ?? 'Umum' }} · {{ s.polyclinic?.name ?? '-' }}</span>
                      <span>{{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }}</span>
                    </div>
                    <span class="quota" [class.full]="s.is_full">
                      @if (s.is_full) {
                        Penuh
                      } @else if (s.remaining_quota === null) {
                        Tanpa batas
                      } @else {
                        Sisa {{ s.remaining_quota }}/{{ s.quota }}
                      }
                    </span>
                  </button>
                } @empty {
                  <p class="muted empty">Tidak ada dokter yang praktik hari ini.</p>
                }
              </div>

              @if (fieldError('doctor_schedule_id'); as err) {
                <p class="field-error">{{ err }}</p>
              }
            </section>

            <!-- Penjamin -->
            <section class="card">
              <h3>Penjamin</h3>
              <mat-button-toggle-group formControlName="payment_type" class="full-width toggle">
                @for (opt of references()?.payment_types; track opt.value) {
                  <mat-button-toggle [value]="opt.value">{{ opt.label }}</mat-button-toggle>
                }
              </mat-button-toggle-group>

              @if (paymentType() === 'guarantor') {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Penjamin</mat-label>
                  <mat-select formControlName="guarantor_id">
                    @for (g of guarantors(); track g.id) {
                      <mat-option [value]="g.id">{{ g.name }} <span class="muted">· {{ g.type_label }}</span></mat-option>
                    }
                  </mat-select>
                  @if (guarantors().length === 0) {
                    <mat-hint>Tidak ada penjamin yang bekerja sama hari ini.</mat-hint>
                  }
                  <mat-error>{{ fieldError('guarantor_id') ?? 'Pilih penjamin' }}</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nomor kartu peserta</mat-label>
                  <input matInput formControlName="guarantor_member_number" maxlength="50" autocomplete="off" />
                  <mat-error>{{ fieldError('guarantor_member_number') }}</mat-error>
                </mat-form-field>
              }
            </section>

            <!-- Rujukan -->
            <section class="card">
              <h3>Rujukan</h3>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Jenis rujukan</mat-label>
                <mat-select formControlName="referral_type">
                  @for (opt of references()?.referral_types; track opt.value) {
                    <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                  }
                </mat-select>
                <mat-error>{{ fieldError('referral_type') }}</mat-error>
              </mat-form-field>

              @if (referralType() !== 'none') {
                @if (needsFacility()) {
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Fasilitas kesehatan perujuk</mat-label>
                    <input matInput formControlName="referral_facility" maxlength="150" />
                    <mat-error>{{ fieldError('referral_facility') ?? 'Wajib diisi' }}</mat-error>
                  </mat-form-field>
                }

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nomor surat rujukan</mat-label>
                  <input matInput formControlName="referral_number" maxlength="50" autocomplete="off" />
                  <mat-error>{{ fieldError('referral_number') }}</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Tanggal rujukan</mat-label>
                  <input matInput type="date" formControlName="referral_date" [max]="todayIso" />
                  <mat-error>{{ fieldError('referral_date') ?? 'Wajib diisi' }}</mat-error>
                </mat-form-field>

                <mat-checkbox formControlName="has_referral_document">Dokumen rujukan dibawa</mat-checkbox>
              }
            </section>

            <!-- Keluhan -->
            <section class="card">
              <h3>Keluhan</h3>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Keluhan pasien (opsional)</mat-label>
                <textarea matInput formControlName="complaint" rows="3" maxlength="1000"></textarea>
                <mat-hint align="end">{{ form.controls.complaint.value.length }}/1000</mat-hint>
                <mat-error>{{ fieldError('complaint') }}</mat-error>
              </mat-form-field>
            </section>

            @if (submitError(); as msg) {
              <p class="submit-error">
                <mat-icon>error_outline</mat-icon>
                {{ msg }}
              </p>
            }

            <button mat-flat-button color="primary" type="submit" class="full-width submit" [disabled]="isSubmitting()">
              @if (isSubmitting()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>how_to_reg</mat-icon>
              }
              Daftarkan Kunjungan
            </button>
          </form>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .register-content {
      --background: #f8fafc;
    }

    .register-wrapper {
      max-width: 520px;
      margin: 0 auto;

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    }

    .card {
      background: #fff;
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);

      h3 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin: 0 0 0.75rem 0;
      }
    }

    .full-width {
      width: 100%;
    }

    .muted {
      color: #94a3b8;
    }

    .patient-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1rem;

      .avatar {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .patient-text {
        flex: 1;
        min-width: 0;
      }

      h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
      }

      p {
        margin: 0.15rem 0 0;
        font-size: 0.8rem;
        color: #475569;
      }
    }

    .date-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #fef3c7;
      color: #b45309;
      font-size: 0.72rem;
      font-weight: 600;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      text-align: center;
      color: #64748b;

      p {
        margin: 0;
      }

      &.error mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #f87171;
      }
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      h3 {
        margin-bottom: 0.75rem;
      }
    }

    .link-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--ion-color-primary);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &:disabled {
        opacity: 0.5;
      }
    }

    .schedule-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .schedule-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.75rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      font: inherit;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 0.15s, background-color 0.15s;

      .radio {
        flex-shrink: 0;
        color: #cbd5e1;
      }

      &.selected {
        border-color: var(--ion-color-primary);
        background: #eef2ff;

        .radio {
          color: var(--ion-color-primary);
        }
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
    }

    .schedule-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      strong {
        font-size: 0.9rem;
        color: #1e293b;
      }

      span {
        font-size: 0.78rem;
        color: #64748b;
      }
    }

    .quota {
      flex-shrink: 0;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.7rem;
      font-weight: 600;

      &.full {
        background: #fee2e2;
        color: #b91c1c;
      }
    }

    .empty {
      margin: 0;
      font-size: 0.9rem;
    }

    .field-error {
      margin: 0.5rem 0 0;
      font-size: 0.8rem;
      color: #dc2626;
    }

    .toggle {
      margin-bottom: 1rem;

      mat-button-toggle {
        flex: 1;
      }
    }

    .submit-error {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.85rem;

      mat-icon {
        flex-shrink: 0;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .submit {
      height: 48px;
      margin-bottom: 1rem;

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }
    }
  `],
})
export class VisitRegisterComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitService = inject(VisitService);
  private toastCtrl = inject(ToastController);
  private destroyRef = inject(DestroyRef);

  readonly medicalRecordId = Number(this.route.snapshot.paramMap.get('medicalRecordId'));
  readonly patient = signal<PatientSearchResult | null>(
    (history.state?.patient as PatientSearchResult | undefined) ?? null,
  );
  readonly todayIso = todayIso();
  readonly today = formatDate(this.todayIso, 'short');
  protected formatTime = formatTime;

  form = this.fb.group({
    doctor_schedule_id: this.fb.control<number | null>(null, Validators.required),
    payment_type: this.fb.control<PaymentType>('self', Validators.required),
    guarantor_id: this.fb.control<number | null>(null),
    guarantor_member_number: [''],
    referral_type: this.fb.control<ReferralType>('none', Validators.required),
    referral_facility: [''],
    referral_number: [''],
    referral_date: [''],
    has_referral_document: [false],
    complaint: [''],
  });

  references = signal<VisitReferences | null>(null);
  schedules = signal<DoctorSchedule[]>([]);
  guarantors = signal<Guarantor[]>([]);

  isLoading = signal<boolean>(true);
  isReloadingSchedules = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  loadError = signal<string | null>(null);
  submitError = signal<string | null>(null);
  /** Pesan error 422 dari server per field. */
  private serverErrors = signal<Record<string, string[]>>({});

  paymentType = toSignal(
    this.form.controls.payment_type.valueChanges.pipe(startWith(this.form.controls.payment_type.value)),
    { requireSync: true },
  );
  referralType = toSignal(
    this.form.controls.referral_type.valueChanges.pipe(startWith(this.form.controls.referral_type.value)),
    { requireSync: true },
  );
  needsFacility = computed(() => REFERRAL_WITH_FACILITY.includes(this.referralType()));

  ngOnInit() {
    this.watchConditionalValidators();
    this.loadOptions();
  }

  loadOptions() {
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({
      references: this.visitService.references(),
      schedules: this.visitService.schedules(this.medicalRecordId),
      guarantors: this.visitService.guarantors(this.medicalRecordId),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ references, schedules, guarantors }) => {
          this.references.set(references);
          this.setSchedules(schedules.data);
          this.guarantors.set(guarantors.data);
        },
        error: (err) =>
          this.loadError.set(describeHttpError(err, 'Gagal memuat data registrasi kunjungan.')),
      });
  }

  reloadSchedules() {
    this.isReloadingSchedules.set(true);
    this.visitService
      .schedules(this.medicalRecordId)
      .pipe(finalize(() => this.isReloadingSchedules.set(false)))
      .subscribe({
        next: (res) => this.setSchedules(res.data),
        error: () => {},
      });
  }

  selectSchedule(schedule: DoctorSchedule) {
    if (schedule.is_full) return;
    this.form.controls.doctor_schedule_id.setValue(schedule.id);
    this.clearServerError('doctor_schedule_id');
  }

  /** Pesan error untuk field: error server diutamakan, lalu error validasi lokal. */
  fieldError(field: string): string | null {
    const server = this.serverErrors()[field]?.[0];
    if (server) return server;
    if (field === 'doctor_schedule_id') {
      const control = this.form.controls.doctor_schedule_id;
      return control.touched && control.hasError('required') ? 'Pilih dokter yang akan dikunjungi.' : null;
    }
    return null;
  }

  onSubmit() {
    this.form.markAllAsTouched();
    this.submitError.set(null);
    if (this.form.invalid) {
      this.submitError.set('Lengkapi data yang wajib diisi.');
      return;
    }

    this.isSubmitting.set(true);
    this.serverErrors.set({});
    this.visitService
      .register(this.buildRequest())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: async (res) => {
          const toast = await this.toastCtrl.create({
            message: res.message,
            duration: 2500,
            position: 'bottom',
            positionAnchor: 'main-tab-bar',
            color: 'success',
          });
          await toast.present();
          this.router.navigate(['/main/visits', res.data.id], { replaceUrl: true });
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.serverErrors.set(errors);
          for (const field of Object.keys(errors)) {
            this.form.get(field)?.setErrors({ server: true });
          }
          // Kuota mungkin berubah sejak jadwal dimuat (mis. kuota penuh), perbarui daftarnya.
          if (errors['doctor_schedule_id']) this.reloadSchedules();
          this.submitError.set(describeHttpError(err, 'Gagal mendaftarkan kunjungan. Coba lagi.'));
        },
      });
  }

  private buildRequest(): VisitRequest {
    const v = this.form.getRawValue();
    const body: VisitRequest = {
      medical_record_id: this.medicalRecordId,
      doctor_schedule_id: v.doctor_schedule_id!,
      payment_type: v.payment_type,
      referral_type: v.referral_type,
      complaint: v.complaint.trim() || undefined,
    };

    if (v.payment_type === 'guarantor') {
      body.guarantor_id = v.guarantor_id!;
      body.guarantor_member_number = v.guarantor_member_number.trim() || undefined;
    }

    if (v.referral_type !== 'none') {
      if (REFERRAL_WITH_FACILITY.includes(v.referral_type)) {
        body.referral_facility = v.referral_facility.trim();
      }
      body.referral_number = v.referral_number.trim() || undefined;
      body.referral_date = v.referral_date;
      body.has_referral_document = v.has_referral_document;
    }

    return body;
  }

  private setSchedules(schedules: DoctorSchedule[]) {
    this.schedules.set(schedules);
    // Lepas pilihan jika jadwal yang dipilih sudah tidak tersedia atau penuh.
    const selectedId = this.form.controls.doctor_schedule_id.value;
    const selected = schedules.find((s) => s.id === selectedId);
    if (selectedId !== null && (!selected || selected.is_full)) {
      this.form.controls.doctor_schedule_id.setValue(null);
    }
  }

  /** Field penjamin & rujukan hanya wajib sesuai pilihan jenis penjamin/rujukan, sama seperti validasi server. */
  private watchConditionalValidators() {
    const c = this.form.controls;

    c.payment_type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((type) => {
      this.toggleRequired(c.guarantor_id, type === 'guarantor');
    });

    c.referral_type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((type) => {
      const referred = type !== 'none';
      this.toggleRequired(c.referral_facility, REFERRAL_WITH_FACILITY.includes(type), Validators.maxLength(150));
      this.toggleRequired(c.referral_date, referred);
    });

    // Hapus error server pada field yang sudah diubah pengguna.
    for (const [name, control] of Object.entries(c) as [string, AbstractControl][]) {
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clearServerError(name));
    }
  }

  private toggleRequired(
    control: AbstractControl,
    required: boolean,
    ...extra: ValidatorFn[]
  ) {
    control.setValidators(required ? [Validators.required, ...extra] : extra);
    control.updateValueAndValidity();
  }

  private clearServerError(field: string) {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update(({ [field]: _, ...rest }) => rest);
  }
}
