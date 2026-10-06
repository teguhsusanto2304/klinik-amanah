import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, map, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { BillService } from '../../core/services/bill.service';
import { Bill, CashSession, PaymentMethod, PaymentRequest } from '../../core/models/bill.model';
import { ReferenceOption } from '../../core/models/visit.model';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { formatRupiah } from './bill-format';

type PaymentLine = FormGroup<{
  method: FormControl<PaymentMethod>;
  amount: FormControl<number | null>;
  reference: FormControl<string>;
}>;

/**
 * Proses pembayaran tagihan.
 * - Pasien: wajib lunas sekaligus, wajib ada sesi kasir terbuka; kembalian dihitung dari pembayaran tunai.
 * - Penjamin (piutang): boleh sebagian, tidak boleh melebihi sisa; tunai tetap butuh sesi kasir.
 * Aturan ini juga divalidasi server; di sini hanya untuk umpan balik cepat.
 */
@Component({
  selector: 'app-bill-pay',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
          <ion-back-button [defaultHref]="'/main/bills/' + billId"></ion-back-button>
        </ion-buttons>
        <ion-title>Pembayaran</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding pay-content">
      <div class="pay-wrapper">
        @if (isLoading()) {
          <section class="card state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else if (loadError(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else if (bill(); as b) {
          <!-- Tagihan -->
          <section class="card due">
            <span class="caption">{{ b.number }} · {{ b.visit?.medical_record?.patient?.name ?? b.payer_label }}</span>
            <span class="caption">{{ isGuarantor() ? 'Sisa piutang ' + (b.guarantor?.name ?? 'penjamin') : 'Total yang harus dibayar' }}</span>
            <strong>{{ rupiah(b.outstanding) }}</strong>
          </section>

          <!-- Sesi kasir -->
          @if (session(); as s) {
            <p class="session ok"><mat-icon>point_of_sale</mat-icon> Sesi kasir {{ s.number }}</p>
          } @else {
            <p class="session warn">
              <mat-icon>lock_clock</mat-icon>
              {{
                isGuarantor()
                  ? 'Sesi kasir belum dibuka. Pembayaran tunai tidak bisa diterima; gunakan metode non tunai.'
                  : 'Sesi kasir belum dibuka. Buka sesi kasir sebelum menerima pembayaran pasien.'
              }}
              <button type="button" class="session-link" (click)="router.navigateByUrl('/main/cash-sessions/open')">Buka sesi</button>
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <section class="card">
              <h3>Metode Pembayaran</h3>
              <div formArrayName="details" class="lines">
                @for (line of details.controls; track line; let i = $index) {
                  <div class="line" [formGroupName]="i">
                    <div class="line-head">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="method">
                        <mat-label>Metode</mat-label>
                        <mat-select formControlName="method">
                          @for (m of methods(); track m.value) {
                            <mat-option [value]="m.value">{{ m.label }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                      @if (details.length > 1) {
                        <button type="button" class="remove" (click)="details.removeAt(i)" aria-label="Hapus metode">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      }
                    </div>

                    <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                      <mat-label>Jumlah</mat-label>
                      <span matTextPrefix>Rp&nbsp;</span>
                      <input matInput type="number" formControlName="amount" min="1" inputmode="numeric" />
                    </mat-form-field>

                    @if (line.controls.method.value === 'cash' && !isGuarantor()) {
                      <div class="quick">
                        @for (q of quickCash(); track q) {
                          <button type="button" (click)="line.controls.amount.setValue(q)">
                            {{ q === remainingForLine(i) ? 'Uang pas' : rupiah(q) }}
                          </button>
                        }
                      </div>
                    }

                    @if (line.controls.method.value !== 'cash') {
                      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                        <mat-label>No. referensi (opsional)</mat-label>
                        <input matInput formControlName="reference" maxlength="100" autocomplete="off" />
                      </mat-form-field>
                    }
                  </div>
                }
              </div>

              <button mat-stroked-button type="button" class="full-width" (click)="addLine()">
                <mat-icon>add</mat-icon> Tambah metode (split)
              </button>
            </section>

            <section class="card">
              <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                <mat-label>Catatan (opsional)</mat-label>
                <textarea matInput formControlName="notes" rows="2" maxlength="1000"></textarea>
              </mat-form-field>
            </section>

            <!-- Ringkasan -->
            <section class="card totals">
              <div class="row"><span>Tagihan</span><span>{{ rupiah(b.outstanding) }}</span></div>
              <div class="row"><span>Diterima</span><span>{{ rupiah(tendered()) }}</span></div>
              @if (isGuarantor()) {
                <div class="row grand"><span>Sisa setelah bayar</span><strong>{{ rupiah(remainingAfter()) }}</strong></div>
              } @else if (change() > 0) {
                <div class="row grand change"><span>Kembalian</span><strong>{{ rupiah(change()) }}</strong></div>
              } @else if (shortfall() > 0) {
                <div class="row grand short"><span>Kurang</span><strong>{{ rupiah(shortfall()) }}</strong></div>
              }
            </section>

            @if (submitError() ?? clientError(); as msg) {
              <p class="submit-error"><mat-icon>error_outline</mat-icon> {{ msg }}</p>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="full-width submit"
              [disabled]="isSubmitting() || !!clientError()"
            >
              @if (isSubmitting()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>check_circle</mat-icon>
              }
              Bayar {{ rupiah(isGuarantor() ? tendered() : (b.outstanding)) }}
            </button>
          </form>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .pay-content {
      --background: #f8fafc;
    }

    .pay-wrapper {
      max-width: 520px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;

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

    .due {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      background: linear-gradient(135deg, var(--ion-color-primary), #4338ca);
      color: #fff;

      .caption {
        font-size: 0.8rem;
        opacity: 0.9;
      }

      strong {
        margin-top: 0.25rem;
        font-size: 1.9rem;
        font-weight: 800;
      }
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

      .session-link {
        flex-shrink: 0;
        margin-left: auto;
        border: none;
        background: none;
        padding: 0;
        color: #92400e;
        font: inherit;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
      }
    }

    .lines {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .line {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .line-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .method {
        flex: 1;
      }
    }

    .remove {
      border: none;
      background: none;
      color: #dc2626;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
    }

    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;

      button {
        padding: 0.35rem 0.7rem;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        background: #f8fafc;
        color: #334155;
        font: inherit;
        font-size: 0.78rem;
        cursor: pointer;

        &:active {
          background: #e0e7ff;
        }
      }
    }

    .totals .row {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      font-size: 0.88rem;
      color: #475569;

      &.grand {
        margin-top: 0.35rem;
        padding-top: 0.6rem;
        border-top: 1px dashed #e2e8f0;
        color: #1e293b;
        font-weight: 600;

        strong {
          font-size: 1.15rem;
        }
      }

      &.change {
        color: #15803d;
      }

      &.short {
        color: #b91c1c;
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
      height: 50px;
      margin-bottom: 1rem;

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
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
  `],
})
export class BillPayComponent implements OnInit, ViewWillEnter {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private billService = inject(BillService);
  private toastCtrl = inject(ToastController);

  readonly billId = Number(this.route.snapshot.paramMap.get('id'));
  protected rupiah = formatRupiah;

  bill = signal<Bill | null>(null);
  methods = signal<ReferenceOption<PaymentMethod>[]>([]);
  session = signal<CashSession | null>(null);

  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  loadError = signal<string | null>(null);
  submitError = signal<string | null>(null);

  form = this.fb.group({
    details: this.fb.array<PaymentLine>([]),
    notes: [''],
  });

  get details(): FormArray<PaymentLine> {
    return this.form.controls.details;
  }

  private formValue = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });

  /** Tagihan yang sudah jadi piutang dibayar oleh penjamin. */
  isGuarantor = computed(() => this.bill()?.status === 'receivable');
  outstanding = computed(() => this.bill()?.outstanding ?? 0);
  tendered = computed(() => this.formValue().details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
  nonCash = computed(() =>
    this.formValue().details.filter((d) => d.method !== 'cash').reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
  );
  paysCash = computed(() => this.formValue().details.some((d) => d.method === 'cash' && Number(d.amount) > 0));
  change = computed(() => (this.isGuarantor() ? 0 : Math.max(this.tendered() - this.outstanding(), 0)));
  shortfall = computed(() => Math.max(this.outstanding() - this.tendered(), 0));
  remainingAfter = computed(() => Math.max(this.outstanding() - this.tendered(), 0));

  /** Pecahan uang tunai yang umum, dibulatkan ke atas dari sisa yang harus dibayar. */
  quickCash = computed(() => {
    const due = this.remainingForLine(this.details.controls.findIndex((l) => l.controls.method.value === 'cash'));
    if (due <= 0) return [];
    const options = new Set<number>([due]);
    for (const step of [10000, 50000, 100000]) {
      options.add(Math.ceil(due / step) * step);
    }
    return [...options].sort((a, b) => a - b).slice(0, 4);
  });

  /** Ringkasan kesalahan yang bisa dicek sebelum dikirim ke server. */
  clientError = computed<string | null>(() => {
    if (!this.bill()) return null;
    if (this.tendered() <= 0) return 'Isi jumlah pembayaran.';
    if (this.paysCash() && !this.session()) return 'Pembayaran tunai memerlukan sesi kasir yang terbuka.';
    if (this.isGuarantor()) {
      if (this.tendered() > this.outstanding()) return `Jumlah melebihi sisa piutang ${formatRupiah(this.outstanding())}.`;
      return null;
    }
    if (!this.session()) return 'Buka sesi kasir terlebih dahulu sebelum menerima pembayaran pasien.';
    if (this.tendered() < this.outstanding()) return `Jumlah kurang dari total tagihan ${formatRupiah(this.outstanding())}.`;
    if (this.nonCash() > this.outstanding()) return 'Pembayaran non tunai tidak boleh melebihi total tagihan.';
    return null;
  });

  ngOnInit() {
    this.load();
  }

  /** Sesi kasir bisa baru dibuka dari halaman lain; perbarui statusnya saat kembali ke sini. */
  ionViewWillEnter() {
    if (this.bill()) {
      this.billService.references().subscribe({
        next: (refs) => this.session.set(refs.cash_session),
        error: () => {},
      });
    }
  }

  load() {
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({ references: this.billService.references(), bill: this.billService.get(this.billId) })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ references, bill }) => {
          this.methods.set(references.payment_methods);
          this.session.set(references.cash_session);
          this.bill.set(bill);
          if (this.details.length === 0) {
            // Penjamin umumnya membayar lewat transfer; pasien default tunai.
            this.addLine(bill.status === 'receivable' ? 'transfer' : 'cash', bill.outstanding);
          }
        },
        error: (err) => this.loadError.set(describeHttpError(err, 'Gagal memuat data pembayaran.')),
      });
  }

  addLine(method: PaymentMethod = 'qris', amount: number | null = null) {
    this.details.push(
      this.fb.group({
        method: this.fb.control<PaymentMethod>(method, Validators.required),
        amount: this.fb.control<number | null>(amount ?? (this.remainingForLine(-1) || null), Validators.min(1)),
        reference: [''],
      }),
    );
  }

  /** Sisa tagihan yang belum tertutup baris lain (untuk mengisi otomatis / tombol uang pas). */
  remainingForLine(index: number): number {
    const others = this.formValue().details.reduce(
      (sum, d, i) => (i === index ? sum : sum + (Number(d.amount) || 0)),
      0,
    );
    return Math.max(this.outstanding() - others, 0);
  }

  onSubmit() {
    this.submitError.set(null);
    if (this.clientError()) return;

    const v = this.form.getRawValue();
    const body: PaymentRequest = {
      details: v.details
        .filter((d) => Number(d.amount) > 0)
        .map((d) => ({
          method: d.method,
          amount: Number(d.amount),
          reference: d.method !== 'cash' ? d.reference.trim() || undefined : undefined,
        })),
      notes: v.notes.trim() || undefined,
    };

    this.isSubmitting.set(true);
    this.billService
      .pay(this.billId, body)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: async (res) => {
          const toast = await this.toastCtrl.create({
            message: res.message,
            duration: 3000,
            position: 'bottom',
            positionAnchor: 'main-tab-bar',
            color: 'success',
          });
          await toast.present();
          this.router.navigate(['/main/payments', res.data.id], { replaceUrl: true });
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.submitError.set(
            errors['details']?.[0] ?? describeHttpError(err, 'Pembayaran gagal diproses. Coba lagi.'),
          );
        },
      });
  }
}
