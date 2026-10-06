import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
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
import { CashService } from '../../core/services/cash.service';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { formatRupiah } from '../bills/bill-format';

/** Buka sesi kasir dengan uang tunai awal di laci. */
@Component({
  selector: 'app-cash-session-open',
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
    IonBackButton,
    IonTitle,
    IonContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>Buka Sesi Kasir</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <form class="form-wrapper" [formGroup]="form" (ngSubmit)="onSubmit()">
        <section class="card intro">
          <mat-icon>point_of_sale</mat-icon>
          <p>
            Hitung uang tunai yang ada di laci sebelum mulai menerima pembayaran.
            Jumlah ini menjadi saldo awal untuk mencocokkan kas saat sesi ditutup.
          </p>
        </section>

        <section class="card">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Uang tunai awal</mat-label>
            <span matTextPrefix>Rp&nbsp;</span>
            <input matInput type="number" formControlName="opening_balance" min="0" inputmode="numeric" />
            <mat-hint>{{ rupiah(form.controls.opening_balance.value) }}</mat-hint>
            <mat-error>{{ serverErrors()['opening_balance']?.[0] ?? 'Isi uang tunai awal (boleh 0).' }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Catatan (opsional)</mat-label>
            <textarea matInput formControlName="opening_notes" rows="2" maxlength="1000"></textarea>
          </mat-form-field>
        </section>

        @if (submitError(); as msg) {
          <p class="submit-error"><mat-icon>error_outline</mat-icon> {{ msg }}</p>
        }

        <button mat-flat-button color="primary" type="submit" class="full-width submit" [disabled]="isSubmitting()">
          @if (isSubmitting()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>lock_open</mat-icon>
          }
          Buka Sesi
        </button>
      </form>
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
})
export class CashSessionOpenComponent {
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private cashService = inject(CashService);
  private toastCtrl = inject(ToastController);

  protected rupiah = formatRupiah;

  form = this.fb.group({
    opening_balance: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    opening_notes: [''],
  });

  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);
  serverErrors = signal<Record<string, string[]>>({});

  onSubmit() {
    this.form.markAllAsTouched();
    this.submitError.set(null);
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.serverErrors.set({});
    this.cashService
      .openSession({ opening_balance: Number(v.opening_balance), opening_notes: v.opening_notes.trim() || undefined })
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
          this.router.navigate(['/main/cash-sessions', res.data.id], { replaceUrl: true });
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.serverErrors.set(errors);
          if (errors['opening_balance']) this.form.controls.opening_balance.setErrors({ server: true });
          this.submitError.set(describeHttpError(err, 'Gagal membuka sesi kasir.'));
        },
      });
  }
}
