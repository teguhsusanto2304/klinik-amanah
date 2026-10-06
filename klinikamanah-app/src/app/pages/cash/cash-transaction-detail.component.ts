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
import { CashService } from '../../core/services/cash.service';
import { CashTransaction } from '../../core/models/cash.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate } from '../visits/visit-format';
import { formatDateTime, formatRupiah } from '../bills/bill-format';

@Component({
  selector: 'app-cash-transaction-detail',
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
          <ion-back-button defaultHref="/main/cash-transactions"></ion-back-button>
        </ion-buttons>
        <ion-title>Detail Transaksi Kas</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <div class="form-wrapper">
        @if (transaction(); as t) {
          <section class="card hero" [class]="t.type" [class.cancelled]="t.status === 'cancelled'">
            <mat-icon>{{ t.type === 'in' ? 'south_west' : 'north_east' }}</mat-icon>
            <span class="caption">{{ t.type_label }} · {{ t.number }}</span>
            <strong class="amount">{{ t.type === 'in' ? '+' : '−' }} {{ rupiah(t.amount) }}</strong>
            <span class="badge" [class]="t.status">{{ t.status_label }}</span>
          </section>

          <section class="card">
            <h2>Rincian</h2>
            <div class="row"><span class="label">Uraian</span><span>{{ t.description }}</span></div>
            <div class="row"><span class="label">Kategori</span><span>{{ t.category_label }}</span></div>
            <div class="row"><span class="label">Metode</span><span>{{ t.method_label }}</span></div>
            <div class="row"><span class="label">Tanggal</span><span>{{ formatDate(t.transaction_date) }}</span></div>
            <div class="row"><span class="label">Referensi</span><span>{{ t.reference || '-' }}</span></div>
            @if (t.session) {
              <div class="row"><span class="label">Sesi kasir</span><span>{{ t.session.number }}</span></div>
            }
            <div class="row"><span class="label">Dicatat oleh</span><span>{{ t.user?.name ?? '-' }}</span></div>
            <div class="row"><span class="label">Dicatat pada</span><span>{{ formatDateTime(t.created_at) }}</span></div>
          </section>

          @if (t.status === 'cancelled') {
            <section class="card cancel-info">
              <h2>Pembatalan</h2>
              <div class="row"><span class="label">Waktu</span><span>{{ formatDateTime(t.cancelled_at) }}</span></div>
              <div class="row"><span class="label">Oleh</span><span>{{ t.canceller?.name ?? '-' }}</span></div>
              <div class="row"><span class="label">Alasan</span><span>{{ t.cancellation_reason || '-' }}</span></div>
            </section>
          }

          <div class="actions">
            @if (t.session) {
              <button mat-stroked-button type="button" (click)="router.navigate(['/main/cash-sessions', t.session.id])">
                <mat-icon>point_of_sale</mat-icon> Lihat Sesi Kasir
              </button>
            }
            @if (t.can_cancel) {
              <button mat-stroked-button type="button" class="danger" [disabled]="isCancelling()" (click)="confirmCancel(t)">
                @if (isCancelling()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>undo</mat-icon> }
                Batalkan Transaksi
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
          <section class="card state"><mat-spinner diameter="32"></mat-spinner></section>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
  styles: [`
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      text-align: center;

      > mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      .caption {
        font-size: 0.8rem;
        color: #64748b;
      }

      .amount {
        font-size: 1.8rem;
        font-weight: 800;
      }

      &.in {
        > mat-icon,
        .amount {
          color: #15803d;
        }
      }

      &.out {
        > mat-icon,
        .amount {
          color: #b91c1c;
        }
      }

      &.cancelled .amount {
        color: #94a3b8;
        text-decoration: line-through;
      }
    }

    .cancel-info {
      background: #fef2f2;
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
  `],
})
export class CashTransactionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private cashService = inject(CashService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private readonly transactionId = Number(this.route.snapshot.paramMap.get('id'));
  protected rupiah = formatRupiah;
  protected formatDate = formatDate;
  protected formatDateTime = formatDateTime;

  transaction = signal<CashTransaction | null>(null);
  errorMessage = signal<string | null>(null);
  isCancelling = signal<boolean>(false);

  ngOnInit() {
    this.load();
  }

  load() {
    this.errorMessage.set(null);
    this.cashService.transaction(this.transactionId).subscribe({
      next: (t) => this.transaction.set(t),
      error: (err) => this.errorMessage.set(describeHttpError(err, 'Gagal memuat transaksi kas.')),
    });
  }

  async confirmCancel(t: CashTransaction) {
    const alert = await this.alertCtrl.create({
      header: 'Batalkan Transaksi',
      message: `${t.type_label} ${t.number} sebesar ${formatRupiah(t.amount)} akan dibatalkan.`,
      inputs: [
        { name: 'reason', type: 'textarea', placeholder: 'Alasan pembatalan (wajib)', attributes: { maxlength: 255 } },
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
              return false;
            }
            this.cancel(t, reason);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private cancel(t: CashTransaction, reason: string) {
    this.isCancelling.set(true);
    this.cashService
      .cancelTransaction(t.id, reason)
      .pipe(finalize(() => this.isCancelling.set(false)))
      .subscribe({
        next: (res) => {
          this.transaction.set(res.data);
          this.showToast(res.message, 'success');
        },
        error: (err) => this.showToast(describeHttpError(err, 'Gagal membatalkan transaksi.'), 'danger'),
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
