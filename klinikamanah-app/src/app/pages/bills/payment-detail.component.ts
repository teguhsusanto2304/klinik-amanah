import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { BillService } from '../../core/services/bill.service';
import { Payment } from '../../core/models/bill.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDateTime, formatRupiah } from './bill-format';

/** Struk / detail pembayaran, dengan aksi pembatalan. */
@Component({
  selector: 'app-payment-detail',
  standalone: true,
  imports: [
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
          <ion-back-button [defaultHref]="backHref()"></ion-back-button>
        </ion-buttons>
        <ion-title>Struk Pembayaran</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding receipt-content">
      <div class="receipt-wrapper">
        @if (payment(); as p) {
          <section class="receipt" [class.cancelled]="p.status === 'cancelled'">
            <div class="receipt-head">
              <mat-icon>{{ p.status === 'cancelled' ? 'cancel' : 'check_circle' }}</mat-icon>
              <span class="status">{{ p.status === 'cancelled' ? 'Pembayaran Dibatalkan' : 'Pembayaran Berhasil' }}</span>
              <strong class="amount">{{ rupiah(p.amount) }}</strong>
              <span class="muted">{{ formatDateTime(p.paid_at) }}</span>
            </div>

            <div class="divider"></div>

            <div class="row"><span>No. pembayaran</span><span>{{ p.number }}</span></div>
            @if (p.bill; as b) {
              <div class="row"><span>No. tagihan</span><span>{{ b.number }}</span></div>
              <div class="row"><span>Pembayar</span><span>{{ b.guarantor?.name ?? b.payer_label }}</span></div>
            }
            @if (p.user) {
              <div class="row"><span>Kasir</span><span>{{ p.user.name }}</span></div>
            }
            @if (p.session) {
              <div class="row"><span>Sesi kasir</span><span>{{ p.session.number }}</span></div>
            }

            <div class="divider"></div>

            @for (d of p.details ?? []; track $index) {
              <div class="row">
                <span>
                  {{ d.method_label }}
                  @if (d.reference) { <small>Ref. {{ d.reference }}</small> }
                </span>
                <span>{{ rupiah(d.amount) }}</span>
              </div>
            }
            <div class="row strong"><span>Total diterima</span><span>{{ rupiah(p.tendered) }}</span></div>
            <div class="row strong"><span>Dibayarkan</span><span>{{ rupiah(p.amount) }}</span></div>
            @if (p.change_amount > 0) {
              <div class="row change"><span>Kembalian</span><span>{{ rupiah(p.change_amount) }}</span></div>
            }

            @if (p.notes) {
              <p class="notes">{{ p.notes }}</p>
            }

            @if (p.status === 'cancelled') {
              <div class="cancel-info">
                <strong>Dibatalkan {{ formatDateTime(p.cancelled_at) }}</strong>
                @if (p.canceller) { <span>oleh {{ p.canceller.name }}</span> }
                @if (p.cancellation_reason) { <span>Alasan: {{ p.cancellation_reason }}</span> }
              </div>
            }
          </section>

          <div class="actions">
            <button mat-stroked-button type="button" (click)="openBill(p)">
              <mat-icon>receipt_long</mat-icon> Lihat Tagihan
            </button>
            @if (p.can_cancel) {
              <button mat-stroked-button type="button" class="danger" [disabled]="isCancelling()" (click)="confirmCancel(p)">
                @if (isCancelling()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>undo</mat-icon>
                }
                Batalkan Pembayaran
              </button>
            }
          </div>
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
  styles: [`
    .receipt-content {
      --background: #f8fafc;
    }

    .receipt-wrapper {
      max-width: 420px;
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

    .muted {
      color: #94a3b8;
      font-size: 0.8rem;
    }

    .receipt {
      background: #fff;
      border-radius: 16px;
      padding: 1.5rem 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);

      &.cancelled {
        .receipt-head mat-icon,
        .status {
          color: #dc2626;
        }

        .amount {
          color: #94a3b8;
          text-decoration: line-through;
        }
      }
    }

    .receipt-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #16a34a;
      }

      .status {
        font-size: 0.9rem;
        font-weight: 600;
        color: #15803d;
      }

      .amount {
        font-size: 1.9rem;
        font-weight: 800;
        color: #1e293b;
      }
    }

    .divider {
      margin: 1rem 0;
      border-top: 1px dashed #cbd5e1;
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.3rem 0;
      font-size: 0.86rem;
      color: #475569;

      span:last-child {
        text-align: right;
        color: #1e293b;
      }

      small {
        display: block;
        font-size: 0.72rem;
        color: #94a3b8;
      }

      &.strong {
        font-weight: 600;
      }

      &.change {
        font-weight: 600;

        span:last-child {
          color: #15803d;
        }
      }
    }

    .notes {
      margin: 0.75rem 0 0;
      padding: 0.6rem 0.75rem;
      border-radius: 10px;
      background: #f8fafc;
      font-size: 0.82rem;
      color: #475569;
      white-space: pre-line;
    }

    .cancel-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 10px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.82rem;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1rem;

      button {
        height: 46px;
      }

      .danger {
        color: #dc2626;
      }

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
export class PaymentDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billService = inject(BillService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private readonly paymentId = Number(this.route.snapshot.paramMap.get('id'));
  protected rupiah = formatRupiah;
  protected formatDateTime = formatDateTime;

  payment = signal<Payment | null>(null);
  errorMessage = signal<string | null>(null);
  isCancelling = signal<boolean>(false);

  backHref = () => {
    const billId = this.payment()?.bill_id;
    return billId ? `/main/bills/${billId}` : '/main/bills';
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.errorMessage.set(null);
    this.billService.getPayment(this.paymentId).subscribe({
      next: (payment) => this.payment.set(payment),
      error: (err) => this.errorMessage.set(describeHttpError(err, 'Gagal memuat detail pembayaran.')),
    });
  }

  openBill(payment: Payment) {
    this.router.navigate(['/main/bills', payment.bill_id]);
  }

  async confirmCancel(payment: Payment) {
    const alert = await this.alertCtrl.create({
      header: 'Batalkan Pembayaran',
      message: `Pembayaran ${payment.number} sebesar ${formatRupiah(payment.amount)} akan dibatalkan dan tagihan dibuka kembali.`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Alasan pembatalan (wajib)',
          attributes: { maxlength: 255 },
        },
      ],
      buttons: [
        { text: 'Kembali', role: 'cancel' },
        {
          text: 'Batalkan',
          role: 'destructive',
          handler: (data: { reason?: string }) => {
            const reason = data.reason?.trim();
            if (!reason) {
              this.showToast('Alasan pembatalan wajib diisi.', 'danger');
              return false; // biarkan dialog tetap terbuka
            }
            this.cancel(payment, reason);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private cancel(payment: Payment, reason: string) {
    this.isCancelling.set(true);
    this.billService
      .cancelPayment(payment.id, reason)
      .pipe(finalize(() => this.isCancelling.set(false)))
      .subscribe({
        next: (res) => {
          this.payment.set(res.data);
          this.showToast(res.message, 'success');
        },
        error: (err) => this.showToast(describeHttpError(err, 'Gagal membatalkan pembayaran.'), 'danger'),
      });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      positionAnchor: 'main-tab-bar',
      color,
    });
    await toast.present();
  }
}
