import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
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
import { BillService } from '../../core/services/bill.service';
import { Bill, BillItem, BillItemType, MutationResponse, Payment } from '../../core/models/bill.model';
import { describeHttpError } from '../../core/utils/http-error';
import { BILL_ITEM_TYPE_LABELS, formatDateTime, formatRupiah } from './bill-format';
import { formatDate } from '../visits/visit-format';

interface ItemGroup {
  type: BillItemType;
  label: string;
  items: BillItem[];
}

const ITEM_TYPE_ORDER: BillItemType[] = ['service', 'medical', 'nursing', 'laboratory', 'pharmacy'];

@Component({
  selector: 'app-bill-detail',
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
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>Detail Tagihan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding detail-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="detail-wrapper">
        @if (bill(); as b) {
          <!-- Ringkasan -->
          <section class="card hero" [class]="b.status">
            <div class="hero-top">
              <span class="number">{{ b.number }}</span>
              <span class="status">{{ b.status_label }}</span>
            </div>
            <span class="caption">{{ b.outstanding > 0 ? 'Sisa tagihan' : 'Total tagihan' }}</span>
            <strong class="amount">{{ rupiah(b.outstanding > 0 ? b.outstanding : b.total) }}</strong>
            <span class="caption">{{ b.payer_label }}@if (b.guarantor) { · {{ b.guarantor.name }} }</span>
          </section>

          <!-- Pasien & kunjungan -->
          @if (b.visit; as v) {
            <section class="card">
              <h2>Kunjungan</h2>
              <div class="row"><span class="label">Pasien</span><span>{{ v.medical_record.patient?.name ?? '-' }}</span></div>
              <div class="row"><span class="label">No. RM</span><span>{{ v.medical_record.number }}</span></div>
              <div class="row"><span class="label">Antrean</span><span>{{ v.formatted_queue_number }} · {{ formatDate(v.visit_date, 'short') }}</span></div>
              <div class="row"><span class="label">Dokter</span><span>{{ v.doctor.name }}</span></div>
              @if (v.polyclinic) {
                <div class="row"><span class="label">Poliklinik</span><span>{{ v.polyclinic.name }}</span></div>
              }
            </section>
          }

          <!-- Rincian -->
          <section class="card">
            <h2>Rincian</h2>
            @for (group of itemGroups(); track group.type) {
              <div class="group">
                <span class="group-label">{{ group.label }}</span>
                @for (item of group.items; track item.id) {
                  <div class="item">
                    <div>
                      <span>{{ item.description }}</span>
                      <span class="muted">{{ item.quantity }} × {{ rupiah(item.unit_price) }}</span>
                    </div>
                    <span>{{ rupiah(item.subtotal) }}</span>
                  </div>
                }
              </div>
            } @empty {
              <p class="muted">Belum ada item yang ditagihkan.</p>
            }

            <div class="totals">
              @if (b.discount > 0) {
                <div class="row"><span>Subtotal</span><span>{{ rupiah(b.total + b.discount) }}</span></div>
                <div class="row discount"><span>Diskon</span><span>− {{ rupiah(b.discount) }}</span></div>
              }
              <div class="row grand"><span>Total</span><strong>{{ rupiah(b.total) }}</strong></div>
              @if (b.paid_amount > 0) {
                <div class="row"><span>Dibayar</span><span>{{ rupiah(b.paid_amount) }}</span></div>
                <div class="row outstanding"><span>Sisa</span><strong>{{ rupiah(b.outstanding) }}</strong></div>
              }
            </div>

            @if (b.notes) {
              <p class="notes"><mat-icon>sticky_note_2</mat-icon> {{ b.notes }}</p>
            }
          </section>

          <!-- Pembayaran -->
          @if (b.payments?.length) {
            <section class="card">
              <h2>Pembayaran</h2>
              @for (p of b.payments; track p.id) {
                <button type="button" class="payment" [class.cancelled]="p.status === 'cancelled'" (click)="openPayment(p)">
                  <div>
                    <strong>{{ p.number }}</strong>
                    <span>{{ formatDateTime(p.paid_at) }} · {{ p.method_labels }}</span>
                    @if (p.status === 'cancelled') {
                      <span class="cancel-label">{{ p.status_label }}</span>
                    }
                  </div>
                  <span class="payment-amount">{{ rupiah(p.amount) }}</span>
                  <mat-icon>chevron_right</mat-icon>
                </button>
              }
            </section>
          }

          <!-- Aksi sesuai abilities dari server -->
          @if (b.abilities; as a) {
            <div class="actions">
              @if (a.pay || a.settle) {
                <button mat-flat-button color="primary" type="button" (click)="openPay(b)" [disabled]="isBusy()">
                  <mat-icon>payments</mat-icon>
                  {{ a.settle ? 'Terima Pembayaran Penjamin' : 'Proses Pembayaran' }}
                </button>
              }
              @if (a.finalize) {
                <button mat-flat-button color="primary" type="button" (click)="confirmFinalize(b)" [disabled]="isBusy()">
                  <mat-icon>request_quote</mat-icon> Jadikan Piutang
                </button>
              }
              @if (a.update) {
                <button mat-stroked-button type="button" (click)="openEdit(b)" [disabled]="isBusy()">
                  <mat-icon>edit</mat-icon> Ubah Tagihan
                </button>
              }
              @if (a.reopen) {
                <button mat-stroked-button type="button" (click)="confirmReopen(b)" [disabled]="isBusy()">
                  <mat-icon>lock_open</mat-icon> Buka Kembali
                </button>
              }
            </div>
          }
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
    .detail-content {
      --background: #f8fafc;
    }

    .detail-wrapper {
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

      h2 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin: 0 0 0.5rem 0;
      }
    }

    .muted {
      color: #94a3b8;
    }

    .hero {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      color: #fff;
      background: linear-gradient(135deg, #ca8a04, #a16207);

      &.receivable {
        background: linear-gradient(135deg, #0284c7, #0369a1);
      }

      &.paid {
        background: linear-gradient(135deg, #16a34a, #15803d);
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .number {
        font-weight: 600;
        font-size: 0.9rem;
      }

      .status {
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
        font-size: 1.9rem;
        font-weight: 800;
      }
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.4rem 0;
      font-size: 0.88rem;
      color: #1e293b;
      text-align: right;

      .label {
        flex-shrink: 0;
        color: #64748b;
        font-size: 0.8rem;
        text-align: left;
      }
    }

    .group {
      padding: 0.5rem 0;

      & + .group {
        border-top: 1px solid #f1f5f9;
      }
    }

    .group-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #9333ea;
    }

    .item {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.3rem 0;
      font-size: 0.85rem;
      color: #1e293b;

      div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .muted {
        font-size: 0.75rem;
      }
    }

    .totals {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px dashed #e2e8f0;

      .row {
        padding: 0.25rem 0;
        color: #475569;
      }

      .discount {
        color: #dc2626;
      }

      .grand {
        color: #1e293b;
        font-weight: 600;

        strong {
          font-size: 1.1rem;
        }
      }

      .outstanding {
        color: #b45309;
      }
    }

    .notes {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      margin: 0.75rem 0 0;
      padding: 0.6rem 0.75rem;
      border-radius: 10px;
      background: #f8fafc;
      font-size: 0.82rem;
      color: #475569;
      white-space: pre-line;

      mat-icon {
        flex-shrink: 0;
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #94a3b8;
      }
    }

    .payment {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.6rem 0;
      border: none;
      background: none;
      cursor: pointer;
      font: inherit;
      text-align: left;

      & + .payment {
        border-top: 1px solid #f1f5f9;
      }

      div {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        font-size: 0.85rem;
        color: #1e293b;

        span {
          font-size: 0.75rem;
          color: #64748b;
        }

        .cancel-label {
          color: #b91c1c;
          font-weight: 600;
        }
      }

      .payment-amount {
        font-weight: 600;
        font-size: 0.9rem;
        color: #15803d;
      }

      mat-icon {
        color: #cbd5e1;
      }

      &.cancelled .payment-amount {
        color: #94a3b8;
        text-decoration: line-through;
      }
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1rem;

      button {
        height: 46px;
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
export class BillDetailComponent implements ViewWillEnter {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billService = inject(BillService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private readonly billId = Number(this.route.snapshot.paramMap.get('id'));
  protected rupiah = formatRupiah;
  protected formatDate = formatDate;
  protected formatDateTime = formatDateTime;

  bill = signal<Bill | null>(null);
  errorMessage = signal<string | null>(null);
  isBusy = signal<boolean>(false);

  itemGroups = computed<ItemGroup[]>(() => {
    const items = this.bill()?.items ?? [];
    return ITEM_TYPE_ORDER.map((type) => ({
      type,
      label: BILL_ITEM_TYPE_LABELS[type],
      items: items.filter((i) => i.type === type),
    })).filter((g) => g.items.length > 0);
  });

  /** Muat ulang setiap tampil: tagihan bisa berubah setelah diubah, dibayar, atau pembayarannya dibatalkan. */
  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.errorMessage.set(null);
    this.billService
      .get(this.billId)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (bill) => this.bill.set(bill),
        error: (err) => {
          if (!this.bill()) this.errorMessage.set(describeHttpError(err, 'Gagal memuat detail tagihan.'));
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  openEdit(bill: Bill) {
    this.router.navigate(['/main/bills', bill.id, 'edit']);
  }

  openPay(bill: Bill) {
    this.router.navigate(['/main/bills', bill.id, 'pay'], { state: { bill } });
  }

  openPayment(payment: Payment) {
    this.router.navigate(['/main/payments', payment.id]);
  }

  async confirmFinalize(bill: Bill) {
    await this.confirm(
      'Jadikan Piutang',
      `Tagihan ${bill.number} sebesar ${formatRupiah(bill.total)} akan dicatat sebagai piutang ${bill.guarantor?.name ?? 'penjamin'} dan tidak bisa diubah lagi.`,
      'Jadikan Piutang',
      () => this.runAction(this.billService.finalize(bill.id)),
    );
  }

  async confirmReopen(bill: Bill) {
    await this.confirm(
      'Buka Kembali',
      `Piutang ${bill.number} akan dibuka kembali sehingga tagihan bisa diubah.`,
      'Buka Kembali',
      () => this.runAction(this.billService.reopen(bill.id)),
    );
  }

  private async confirm(header: string, message: string, okText: string, handler: () => void) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: okText, handler },
      ],
    });
    await alert.present();
  }

  private runAction(request: Observable<MutationResponse<Bill>>) {
    this.isBusy.set(true);
    request.pipe(finalize(() => this.isBusy.set(false))).subscribe({
      next: (res) => {
        this.bill.set(res.data);
        this.showToast(res.message, 'success');
      },
      error: (err) => this.showToast(describeHttpError(err, 'Aksi gagal diproses.'), 'danger'),
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
