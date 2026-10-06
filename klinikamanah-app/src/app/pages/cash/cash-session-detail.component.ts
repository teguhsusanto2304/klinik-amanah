import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { CashService } from '../../core/services/cash.service';
import { CashSessionDetail, CashTransaction } from '../../core/models/cash.model';
import { Payment, PaymentMethod } from '../../core/models/bill.model';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { PAYMENT_METHOD_LABELS, formatDateTime, formatRupiah } from '../bills/bill-format';

/** Detail sesi kasir: ringkasan kas, pembayaran, transaksi kas, dan penutupan sesi. */
@Component({
  selector: 'app-cash-session-detail',
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
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/cash-sessions"></ion-back-button>
        </ion-buttons>
        <ion-title>Sesi Kasir</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="form-wrapper">
        @if (session(); as s) {
          <!-- Ringkasan -->
          <section class="card hero" [class.closed]="s.status === 'closed'">
            <div class="hero-top">
              <strong>{{ s.number }}</strong>
              <span class="pill">{{ s.status_label }}</span>
            </div>
            <span class="caption">{{ s.status === 'open' ? 'Uang tunai di laci saat ini' : 'Uang tunai seharusnya' }}</span>
            <strong class="amount">{{ rupiah(s.status === 'open' ? s.summary?.expected_cash : s.expected_cash) }}</strong>
            <span class="caption">
              {{ s.user?.name ?? '-' }} · dibuka {{ formatDateTime(s.opened_at) }}
              @if (s.closed_at) { · ditutup {{ formatDateTime(s.closed_at) }} }
            </span>
          </section>

          <!-- Hasil penutupan -->
          @if (s.status === 'closed') {
            <section class="card">
              <h2>Penutupan</h2>
              <div class="row"><span class="label">Kas seharusnya</span><span>{{ rupiah(s.expected_cash) }}</span></div>
              <div class="row"><span class="label">Kas fisik dihitung</span><span>{{ rupiah(s.counted_cash) }}</span></div>
              <div class="row" [class.plus]="(s.difference ?? 0) > 0" [class.minus]="(s.difference ?? 0) < 0">
                <span class="label">Selisih</span>
                <span>{{ differenceLabel(s.difference) }}</span>
              </div>
              @if (s.closing_notes) {
                <div class="row"><span class="label">Catatan</span><span>{{ s.closing_notes }}</span></div>
              }
            </section>
          }

          <!-- Rincian kas -->
          @if (s.summary; as sum) {
            <section class="card">
              <h2>Rincian Kas</h2>
              <div class="row"><span class="label">Uang tunai awal</span><span>{{ rupiah(sum.opening_balance) }}</span></div>
              @for (m of methodRows(); track m.method) {
                <div class="row"><span class="label">{{ m.label }}</span><span>{{ rupiah(m.amount) }}</span></div>
              }
              <div class="row plus"><span class="label">Kas masuk (tunai)</span><span>+ {{ rupiah(sum.cash_in) }}</span></div>
              <div class="row minus"><span class="label">Kas keluar (tunai)</span><span>− {{ rupiah(sum.cash_out) }}</span></div>
              <div class="row strong"><span class="label">Total pembayaran ({{ sum.payment_count }})</span><span>{{ rupiah(sum.payments_total) }}</span></div>
              <div class="row strong"><span class="label">Kas seharusnya</span><span>{{ rupiah(sum.expected_cash) }}</span></div>
              @if (s.opening_notes) {
                <div class="row"><span class="label">Catatan buka</span><span>{{ s.opening_notes }}</span></div>
              }
            </section>
          }

          <!-- Tutup sesi -->
          @if (s.can_close) {
            <section class="card">
              <h2>Tutup Sesi</h2>
              @if (!showCloseForm()) {
                <button mat-flat-button color="warn" type="button" class="full-width" (click)="showCloseForm.set(true)">
                  <mat-icon>lock</mat-icon> Tutup Sesi Kasir
                </button>
              } @else {
                <form [formGroup]="closeForm" (ngSubmit)="confirmClose(s)">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Uang tunai fisik di laci</mat-label>
                    <span matTextPrefix>Rp&nbsp;</span>
                    <input matInput type="number" formControlName="counted_cash" min="0" inputmode="numeric" />
                    <mat-error>{{ closeErrors()['counted_cash']?.[0] ?? 'Isi jumlah uang tunai yang dihitung.' }}</mat-error>
                  </mat-form-field>
                  @if (countedCash() !== null) {
                    <p class="diff" [class.plus]="liveDifference() > 0" [class.minus]="liveDifference() < 0">
                      {{ liveDifference() === 0 ? 'Kas sesuai.' : 'Selisih ' + differenceLabel(liveDifference()) }}
                    </p>
                  }
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Catatan penutupan (opsional)</mat-label>
                    <textarea matInput formControlName="closing_notes" rows="2" maxlength="1000"></textarea>
                  </mat-form-field>
                  <div class="close-actions">
                    <button mat-stroked-button type="button" (click)="showCloseForm.set(false)" [disabled]="isClosing()">Batal</button>
                    <button mat-flat-button color="warn" type="submit" [disabled]="isClosing()">
                      @if (isClosing()) { <mat-spinner diameter="18"></mat-spinner> }
                      Tutup Sesi
                    </button>
                  </div>
                </form>
              }
            </section>
          }

          <!-- Pembayaran -->
          <section class="card">
            <h2>Pembayaran ({{ s.payments?.length ?? 0 }})</h2>
            @for (p of s.payments ?? []; track p.id) {
              <button type="button" class="line" [class.cancelled]="p.status === 'cancelled'" (click)="openPayment(p)">
                <div>
                  <strong>{{ p.bill?.visit?.medical_record?.patient?.name ?? p.bill?.guarantor?.name ?? p.number }}</strong>
                  <span>{{ p.number }} · {{ formatDateTime(p.paid_at) }} · {{ p.method_labels }}</span>
                </div>
                <span class="amount">{{ rupiah(p.amount) }}</span>
              </button>
            } @empty {
              <p class="muted empty">Belum ada pembayaran.</p>
            }
          </section>

          <!-- Transaksi kas -->
          <section class="card">
            <h2>Kas Masuk/Keluar ({{ s.cash_transactions?.length ?? 0 }})</h2>
            @for (t of s.cash_transactions ?? []; track t.id) {
              <button type="button" class="line" [class.cancelled]="t.status === 'cancelled'" (click)="openTransaction(t)">
                <div>
                  <strong>{{ t.description }}</strong>
                  <span>{{ t.number }} · {{ t.category_label }} · {{ t.method_label }}</span>
                </div>
                <span class="amount" [class.in]="t.type === 'in'" [class.out]="t.type === 'out'">
                  {{ t.type === 'in' ? '+' : '−' }} {{ rupiah(t.amount) }}
                </span>
              </button>
            } @empty {
              <p class="muted empty">Belum ada transaksi kas.</p>
            }
            @if (s.status === 'open') {
              <button mat-stroked-button type="button" class="full-width add" (click)="router.navigateByUrl('/main/cash-transactions/new')">
                <mat-icon>add</mat-icon> Catat Kas Masuk/Keluar
              </button>
            }
          </section>
        } @else if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else {
          <section class="card state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
  styles: [`
    .hero {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      background: linear-gradient(135deg, #ca8a04, #a16207);
      color: #fff;

      &.closed {
        background: linear-gradient(135deg, #64748b, #475569);
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.4rem;
      }

      .pill {
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
        font-size: 0.72rem;
        font-weight: 600;
      }

      .caption {
        font-size: 0.78rem;
        opacity: 0.9;
      }

      .amount {
        font-size: 1.8rem;
        font-weight: 800;
      }
    }

    .diff {
      margin: -0.5rem 0 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #15803d;

      &.plus {
        color: #0369a1;
      }

      &.minus {
        color: #b91c1c;
      }
    }

    .close-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }
    }

    .line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.6rem 0;
      border: none;
      background: none;
      cursor: pointer;
      font: inherit;
      text-align: left;

      & + .line {
        border-top: 1px solid #f1f5f9;
      }

      div {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;

        strong {
          font-size: 0.86rem;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        span {
          font-size: 0.74rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .amount {
        flex-shrink: 0;
        font-size: 0.88rem;
        font-weight: 600;
        color: #1e293b;

        &.in {
          color: #15803d;
        }

        &.out {
          color: #b91c1c;
        }
      }

      &.cancelled {
        opacity: 0.5;

        .amount {
          text-decoration: line-through;
        }
      }
    }

    .empty {
      margin: 0;
      font-size: 0.85rem;
    }

    .add {
      margin-top: 0.75rem;
    }
  `],
})
export class CashSessionDetailComponent implements ViewWillEnter {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private cashService = inject(CashService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private readonly sessionId = Number(this.route.snapshot.paramMap.get('id'));
  protected rupiah = formatRupiah;
  protected formatDateTime = formatDateTime;

  session = signal<CashSessionDetail | null>(null);
  errorMessage = signal<string | null>(null);
  showCloseForm = signal<boolean>(false);
  isClosing = signal<boolean>(false);
  closeErrors = signal<Record<string, string[]>>({});

  closeForm = this.fb.group({
    counted_cash: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    closing_notes: [''],
  });

  countedCash = toSignal(
    this.closeForm.controls.counted_cash.valueChanges.pipe(
      startWith(null),
      map((v) => (v === null || (v as unknown) === '' ? null : Number(v))),
    ),
    { requireSync: true },
  );
  liveDifference = computed(() => (this.countedCash() ?? 0) - (this.session()?.summary?.expected_cash ?? 0));

  /** Total pembayaran per metode; hanya metode yang ada transaksinya. */
  methodRows = computed(() => {
    const methods = this.session()?.summary?.methods ?? ({} as Record<PaymentMethod, number>);
    return (Object.entries(methods) as [PaymentMethod, number][])
      .filter(([, amount]) => amount !== 0)
      .map(([method, amount]) => ({ method, amount, label: `Pembayaran ${PAYMENT_METHOD_LABELS[method] ?? method}` }));
  });

  /** Muat ulang setiap tampil: ringkasan berubah setelah pembayaran atau transaksi kas. */
  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.errorMessage.set(null);
    this.cashService
      .session(this.sessionId)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (session) => this.session.set(session),
        error: (err) => {
          if (!this.session()) this.errorMessage.set(describeHttpError(err, 'Gagal memuat sesi kasir.'));
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  /** Selisih positif = kas lebih, negatif = kas kurang. */
  differenceLabel(value: number | null): string {
    if (!value) return formatRupiah(0);
    return `${value > 0 ? 'lebih' : 'kurang'} ${formatRupiah(Math.abs(value))}`;
  }

  openPayment(payment: Payment) {
    this.router.navigate(['/main/payments', payment.id]);
  }

  openTransaction(transaction: CashTransaction) {
    this.router.navigate(['/main/cash-transactions', transaction.id]);
  }

  async confirmClose(session: CashSessionDetail) {
    this.closeForm.markAllAsTouched();
    if (this.closeForm.invalid) return;

    const diff = this.liveDifference();
    const alert = await this.alertCtrl.create({
      header: 'Tutup Sesi Kasir',
      message:
        `Kas fisik ${formatRupiah(this.countedCash())}` +
        (diff === 0 ? ', sesuai dengan kas seharusnya.' : `, selisih ${this.differenceLabel(diff)}.`) +
        ' Sesi yang sudah ditutup tidak bisa dibuka lagi.',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Tutup Sesi', role: 'destructive', handler: () => this.close(session) },
      ],
    });
    await alert.present();
  }

  private close(session: CashSessionDetail) {
    const v = this.closeForm.getRawValue();
    this.isClosing.set(true);
    this.closeErrors.set({});
    this.cashService
      .closeSession(session.id, {
        counted_cash: Number(v.counted_cash),
        closing_notes: v.closing_notes.trim() || undefined,
      })
      .pipe(finalize(() => this.isClosing.set(false)))
      .subscribe({
        next: (res) => {
          this.session.set(res.data);
          this.showCloseForm.set(false);
          this.showToast(res.message, 'success');
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.closeErrors.set(errors);
          if (errors['counted_cash']) this.closeForm.controls.counted_cash.setErrors({ server: true });
          this.showToast(describeHttpError(err, 'Gagal menutup sesi kasir.'), 'danger');
        },
      });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      positionAnchor: 'main-tab-bar',
      color,
    });
    await toast.present();
  }
}
