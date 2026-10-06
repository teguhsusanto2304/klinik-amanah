import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import {
  CashTransactionMethod,
  CashTransactionReferences,
  CashTransactionType,
} from '../../core/models/cash.model';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { todayIso } from '../visits/visit-format';
import { formatRupiah } from '../bills/bill-format';

/**
 * Catat kas masuk/keluar. Aturan server (dicek juga di sini untuk umpan balik cepat):
 * transaksi tunai butuh sesi kasir terbuka, dan kas keluar tunai tidak boleh melebihi uang di laci.
 */
@Component({
  selector: 'app-cash-transaction-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
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
          <ion-back-button defaultHref="/main/cash-transactions"></ion-back-button>
        </ion-buttons>
        <ion-title>Catat Transaksi Kas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <div class="form-wrapper">
        @if (isLoading()) {
          <section class="card state"><mat-spinner diameter="32"></mat-spinner></section>
        } @else if (loadError(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else if (references(); as refs) {
          <!-- Sesi kasir -->
          @if (refs.cash_session; as s) {
            <p class="session ok">
              <mat-icon>point_of_sale</mat-icon>
              Sesi {{ s.number }} · uang tunai di laci {{ rupiah(s.cash_in_drawer) }}
            </p>
          } @else {
            <p class="session warn">
              <mat-icon>lock_clock</mat-icon>
              Sesi kasir belum dibuka; hanya transaksi non tunai yang bisa dicatat.
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <section class="card">
              <mat-button-toggle-group formControlName="type" class="full-width toggle type">
                @for (t of refs.types; track t.value) {
                  <mat-button-toggle [value]="t.value">
                    <mat-icon>{{ t.value === 'in' ? 'south_west' : 'north_east' }}</mat-icon> {{ t.label }}
                  </mat-button-toggle>
                }
              </mat-button-toggle-group>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Kategori</mat-label>
                <mat-select formControlName="category">
                  @for (c of categories(); track c.value) {
                    <mat-option [value]="c.value">{{ c.label }}</mat-option>
                  }
                </mat-select>
                <mat-error>{{ fieldError('category') ?? 'Pilih kategori' }}</mat-error>
              </mat-form-field>

              <mat-button-toggle-group formControlName="method" class="full-width toggle">
                @for (m of refs.methods; track m.value) {
                  <mat-button-toggle [value]="m.value">{{ m.label }}</mat-button-toggle>
                }
              </mat-button-toggle-group>
              @if (fieldError('method'); as err) {
                <p class="field-error">{{ err }}</p>
              }

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Tanggal transaksi</mat-label>
                <input matInput type="date" formControlName="transaction_date" [max]="today" />
                <mat-error>{{ fieldError('transaction_date') ?? 'Isi tanggal (tidak boleh setelah hari ini)' }}</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Jumlah</mat-label>
                <span matTextPrefix>Rp&nbsp;</span>
                <input matInput type="number" formControlName="amount" min="1" inputmode="numeric" />
                <mat-hint>{{ rupiah(amount()) }}</mat-hint>
                <mat-error>{{ fieldError('amount') ?? 'Isi jumlah minimal Rp 1' }}</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Uraian</mat-label>
                <input matInput formControlName="description" maxlength="255" />
                <mat-error>{{ fieldError('description') ?? 'Uraian wajib diisi' }}</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>No. referensi / bukti (opsional)</mat-label>
                <input matInput formControlName="reference" maxlength="100" autocomplete="off" />
              </mat-form-field>
            </section>

            @if (submitError() ?? clientError(); as msg) {
              <p class="submit-error"><mat-icon>error_outline</mat-icon> {{ msg }}</p>
            }

            <button mat-flat-button color="primary" type="submit" class="full-width submit" [disabled]="isSubmitting() || !!clientError()">
              @if (isSubmitting()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>save</mat-icon>
              }
              Simpan {{ type() === 'in' ? 'Kas Masuk' : 'Kas Keluar' }}
            </button>
          </form>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
  styles: [`
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .session {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      padding: 0.65rem 0.9rem;
      border-radius: 12px;
      font-size: 0.82rem;

      mat-icon {
        flex-shrink: 0;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &.ok {
        background: #dcfce7;
        color: #15803d;
      }

      &.warn {
        background: #fef3c7;
        color: #92400e;
      }
    }

    .toggle {
      margin-bottom: 1rem;

      mat-button-toggle {
        flex: 1;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        vertical-align: middle;
      }
    }

    .field-error {
      margin: -0.6rem 0 0.75rem;
      font-size: 0.78rem;
      color: #dc2626;
    }
  `],
})
export class CashTransactionFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cashService = inject(CashService);
  private toastCtrl = inject(ToastController);

  readonly today = todayIso();
  protected rupiah = formatRupiah;

  form = this.fb.group({
    type: this.fb.control<CashTransactionType>(
      this.route.snapshot.queryParamMap.get('type') === 'out' ? 'out' : 'in',
      Validators.required,
    ),
    category: ['', Validators.required],
    method: this.fb.control<CashTransactionMethod>('cash', Validators.required),
    transaction_date: [this.today, Validators.required],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    description: ['', [Validators.required, Validators.maxLength(255)]],
    reference: [''],
  });

  references = signal<CashTransactionReferences | null>(null);
  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  loadError = signal<string | null>(null);
  submitError = signal<string | null>(null);
  private serverErrors = signal<Record<string, string[]>>({});

  private value = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });
  type = computed(() => this.value().type);
  amount = computed(() => Number(this.value().amount) || 0);
  categories = computed(() => this.references()?.categories[this.type()] ?? []);

  clientError = computed<string | null>(() => {
    const refs = this.references();
    if (!refs || this.value().method !== 'cash') return null;
    if (!refs.cash_session) return 'Buka sesi kasir terlebih dahulu untuk mencatat transaksi tunai.';
    if (this.type() === 'out' && this.amount() > refs.cash_session.cash_in_drawer) {
      return `Jumlah kas keluar melebihi uang tunai di laci (${formatRupiah(refs.cash_session.cash_in_drawer)}).`;
    }
    return null;
  });

  ngOnInit() {
    // Kategori berbeda per jenis transaksi, jadi pilihan lama dikosongkan saat jenis berganti.
    this.form.controls.type.valueChanges.subscribe(() => this.form.controls.category.setValue(''));
    // Hapus error server pada field yang diubah.
    this.form.valueChanges.subscribe(() => {
      if (Object.keys(this.serverErrors()).length) this.serverErrors.set({});
      this.submitError.set(null);
    });
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.cashService
      .transactionReferences()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (refs) => {
          this.references.set(refs);
          // Tanpa sesi kasir, default ke transfer supaya form langsung bisa dipakai.
          if (!refs.cash_session) this.form.controls.method.setValue('transfer');
        },
        error: (err) => this.loadError.set(describeHttpError(err, 'Gagal memuat data transaksi kas.')),
      });
  }

  fieldError(field: string): string | null {
    return this.serverErrors()[field]?.[0] ?? null;
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.clientError()) return;

    const v = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.cashService
      .createTransaction({
        type: v.type,
        category: v.category,
        method: v.method,
        transaction_date: v.transaction_date,
        amount: Number(v.amount),
        description: v.description.trim(),
        reference: v.reference.trim() || undefined,
      })
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
          this.router.navigate(['/main/cash-transactions', res.data.id], { replaceUrl: true });
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.submitError.set(describeHttpError(err, 'Gagal mencatat transaksi kas.'));
          this.serverErrors.set(errors);
          for (const field of Object.keys(errors)) this.form.get(field)?.setErrors({ server: true });
        },
      });
  }
}
