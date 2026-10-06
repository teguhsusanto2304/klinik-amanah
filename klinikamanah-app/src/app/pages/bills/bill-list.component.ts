import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, map, merge } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BillService } from '../../core/services/bill.service';
import { PaginationMeta } from '../../core/models/patient.model';
import { PaymentType } from '../../core/models/visit.model';
import { BillListItem, BillListParams, BillListStatus, BillReferences, BillingAction } from '../../core/models/bill.model';
import { CashSessionDetail } from '../../core/models/cash.model';
import { CashService } from '../../core/services/cash.service';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate, todayIso } from '../visits/visit-format';
import { BILL_STATUS_LABELS, formatRupiah } from './bill-format';

const PER_PAGE = 20;

/** Daftar kunjungan per tanggal beserta status tagihannya (menu Pembayaran). */
@Component({
  selector: 'app-bill-list',
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
    IonMenuButton,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Pembayaran</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding bill-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="bill-wrapper">
        <!-- Sesi kasir (GET /cash-sessions/current) -->
        @if (sessionLoaded()) {
          @if (session(); as session) {
            <button type="button" class="card session open" (click)="openSession(session.id)">
              <div class="session-head">
                <mat-icon>point_of_sale</mat-icon>
                <div>
                  <span class="caption">Sesi kasir berjalan</span>
                  <strong>{{ session.number }}</strong>
                </div>
                <mat-icon class="chevron">chevron_right</mat-icon>
              </div>
              @if (session.summary; as sum) {
                <div class="session-stats">
                  <div><span>Transaksi</span><strong>{{ sum.payment_count }}</strong></div>
                  <div><span>Total diterima</span><strong>{{ rupiah(sum.payments_total) }}</strong></div>
                  <div><span>Kas di laci</span><strong>{{ rupiah(sum.expected_cash) }}</strong></div>
                </div>
              }
            </button>
          } @else {
            <section class="card session closed">
              <mat-icon>lock_clock</mat-icon>
              <p>
                <strong>Sesi kasir belum dibuka.</strong>
                Pembayaran pasien dan transaksi tunai memerlukan sesi kasir.
              </p>
              @if (canOpenSession) {
                <button mat-flat-button color="primary" type="button" (click)="router.navigateByUrl('/main/cash-sessions/open')">
                  Buka Sesi
                </button>
              }
            </section>
          }
        }

        <!-- Pintasan keuangan -->
        <div class="shortcuts">
          <button type="button" (click)="router.navigateByUrl('/main/cash-transactions')">
            <mat-icon>swap_vert</mat-icon> Kas Masuk/Keluar
          </button>
          <button type="button" (click)="router.navigateByUrl('/main/cash-sessions')">
            <mat-icon>history</mat-icon> Riwayat Sesi
          </button>
        </div>

        <!-- Filter -->
        <form [formGroup]="filters" class="card filters">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Cari nama atau no. RM</mat-label>
            <input matInput formControlName="search" autocomplete="off" />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
          <div class="filter-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tanggal</mat-label>
              <input matInput type="date" formControlName="date" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Penjamin</mat-label>
              <mat-select formControlName="payment_type">
                <mat-option value="">Semua</mat-option>
                @for (t of references()?.payment_types; track t.value) {
                  <mat-option [value]="t.value">{{ t.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </form>

        <div class="chips">
          <button type="button" class="chip" [class.active]="status() === null" (click)="setStatus(null)">Semua</button>
          @for (s of statusOptions; track s) {
            <button type="button" class="chip" [class.active]="status() === s" (click)="setStatus(s)">
              {{ statusLabels[s] }}
            </button>
          }
        </div>

        @if (meta(); as m) {
          <p class="summary">{{ dateLabel() }} · <strong>{{ m.total }}</strong> kunjungan</p>
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="reload()">Coba lagi</button>
          </section>
        } @else if (isLoading() && items().length === 0) {
          <section class="state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else {
          @for (v of items(); track v.id) {
            @let status = v.bill?.status ?? 'unbilled';
            <button type="button" class="card bill-card" [disabled]="!v.billing_action" (click)="open(v)">
              <div class="bill-head">
                <span class="queue">{{ v.formatted_queue_number }}</span>
                <div class="patient">
                  <h3>{{ v.medical_record.patient?.name ?? '-' }}</h3>
                  <p>{{ v.medical_record.number }} · {{ v.doctor.name }}</p>
                </div>
                <span class="status" [class]="status">{{ statusLabels[status] }}</span>
              </div>

              <div class="bill-foot">
                <span class="payer">
                  <mat-icon>{{ v.payment_type === 'guarantor' ? 'shield' : 'person' }}</mat-icon>
                  {{ v.guarantor?.name ?? v.payment_type_label }}
                </span>
                <div class="foot-right">
                  @if (v.bill; as b) {
                    <div class="amount">
                      <strong>{{ rupiah(b.total) }}</strong>
                      @if (b.outstanding > 0 && b.status !== 'draft') {
                        <span>Sisa {{ rupiah(b.outstanding) }}</span>
                      }
                    </div>
                  }
                  @if (v.billing_action; as action) {
                    <span class="action" [class]="action">
                      <mat-icon>{{ actionIcons[action] }}</mat-icon> {{ actionLabels[action] }}
                    </span>
                  }
                </div>
              </div>
            </button>
          } @empty {
            <section class="card state">
              <mat-icon>receipt_long</mat-icon>
              <p>Tidak ada kunjungan untuk filter ini.</p>
            </section>
          }
        }
      </div>

      <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="onLoadMore($event)">
        <ion-infinite-scroll-content loadingText="Memuat..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: [`
    .bill-content {
      --background: #f8fafc;
    }

    .bill-wrapper {
      max-width: 520px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .session {
      &.open {
        display: block;
        width: 100%;
        border: none;
        text-align: left;
        font: inherit;
        cursor: pointer;
        background: linear-gradient(135deg, #ca8a04, #a16207);
        color: #fff;

        .chevron {
          margin-left: auto;
          opacity: 0.8;
        }
      }

      &.closed {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        background: #fef3c7;
        color: #92400e;
        font-size: 0.85rem;

        mat-icon {
          flex-shrink: 0;
        }

        p {
          flex: 1;
          margin: 0;
        }

        strong {
          display: block;
        }

        button {
          flex-shrink: 0;
          align-self: center;
        }
      }
    }

    .shortcuts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;

      button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.7rem;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #fff;
        color: #334155;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #a16207;
        }
      }
    }

    .session-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      > div {
        display: flex;
        flex-direction: column;
      }

      .caption {
        font-size: 0.75rem;
        opacity: 0.85;
      }
    }

    .session-stats {
      display: grid;
      grid-template-columns: 0.7fr 1fr 1fr;
      gap: 0.5rem;
      margin-top: 0.85rem;

      div {
        display: flex;
        flex-direction: column;
        padding: 0.45rem 0.6rem;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.15);
        min-width: 0;
      }

      span {
        font-size: 0.68rem;
        opacity: 0.9;
      }

      strong {
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .filters {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
    }

    .full-width {
      width: 100%;
    }

    .filter-row {
      display: flex;
      gap: 0.5rem;

      mat-form-field {
        flex: 1;
        min-width: 0;
      }
    }

    mat-form-field mat-icon[matPrefix] {
      margin: 0 0.5rem 0 0.75rem;
      color: #94a3b8;
    }

    .chips {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .chip {
      flex-shrink: 0;
      padding: 0.35rem 0.85rem;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      background: #fff;
      color: #475569;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;

      &.active {
        border-color: var(--ion-color-primary);
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 600;
      }
    }

    .summary {
      margin: 0 0.25rem;
      font-size: 0.85rem;
      color: #64748b;
    }

    .bill-card {
      display: block;
      width: 100%;
      padding: 1rem;
      border: none;
      cursor: pointer;
      font: inherit;
      text-align: left;
      -webkit-tap-highlight-color: transparent;

      &:active {
        background: #f8fafc;
      }

      &:disabled {
        cursor: default;
        color: inherit;
      }
    }

    .bill-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .queue {
      flex-shrink: 0;
      min-width: 48px;
      padding: 0.4rem 0.5rem;
      border-radius: 10px;
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 700;
      text-align: center;
    }

    .patient {
      flex: 1;
      min-width: 0;

      h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      p {
        margin: 0.1rem 0 0;
        font-size: 0.78rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .status {
      flex-shrink: 0;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 600;

      &.unbilled {
        background: #f1f5f9;
        color: #475569;
      }

      &.draft {
        background: #fef3c7;
        color: #b45309;
      }

      &.receivable {
        background: #e0f2fe;
        color: #0369a1;
      }

      &.paid {
        background: #dcfce7;
        color: #15803d;
      }
    }

    .bill-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.75rem;
      padding-top: 0.65rem;
      border-top: 1px solid #f1f5f9;
      font-size: 0.8rem;
      color: #475569;
    }

    .foot-right {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .action {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      &.create {
        background: var(--ion-color-primary);
        color: #fff;
      }

      &.process {
        background: #fef3c7;
        color: #b45309;
      }

      &.view {
        background: #f1f5f9;
        color: #475569;
      }
    }

    .payer {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      min-width: 0;

      mat-icon {
        flex-shrink: 0;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .payer mat-icon {
      color: #94a3b8;
    }

    .amount {
      display: flex;
      flex-direction: column;
      align-items: flex-end;

      strong {
        font-size: 0.95rem;
        color: #1e293b;
      }

      span {
        font-size: 0.72rem;
        color: #b45309;
      }
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      text-align: center;
      color: #64748b;
      padding: 1.5rem 1rem;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #cbd5e1;
      }

      p {
        margin: 0;
      }

      &.error mat-icon {
        color: #f87171;
      }
    }
  `],
})
export class BillListComponent implements OnInit, ViewWillEnter {
  private fb = inject(NonNullableFormBuilder);
  private billService = inject(BillService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);
  private cashService = inject(CashService);
  protected router = inject(Router);

  readonly canOpenSession = this.auth.can('cash_sessions.create');
  readonly actionLabels: Record<NonNullable<BillingAction>, string> = {
    create: 'Buat Tagihan',
    process: 'Proses',
    view: 'Lihat',
  };
  readonly actionIcons: Record<NonNullable<BillingAction>, string> = {
    create: 'add_circle',
    process: 'arrow_forward',
    view: 'visibility',
  };

  readonly statusOptions: BillListStatus[] = ['unbilled', 'draft', 'receivable', 'paid'];
  readonly statusLabels = BILL_STATUS_LABELS;
  protected rupiah = formatRupiah;

  filters = this.fb.group({
    search: [''],
    date: [todayIso()],
    payment_type: [''],
  });
  status = signal<BillListStatus | null>(null);

  references = signal<BillReferences | null>(null);
  session = signal<CashSessionDetail | null>(null);
  sessionLoaded = signal<boolean>(false);
  items = signal<BillListItem[]>([]);
  meta = signal<PaginationMeta | null>(null);
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  dateLabel = signal<string>(formatDate(todayIso()));

  private requestId = 0;

  ngOnInit() {
    const { search, date, payment_type } = this.filters.controls;
    merge(
      search.valueChanges.pipe(map((v) => v.trim()), debounceTime(400), distinctUntilChanged()),
      date.valueChanges,
      payment_type.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  /** Muat ulang saat halaman tampil: status tagihan & ringkasan sesi kasir bisa berubah dari layar lain. */
  ionViewWillEnter() {
    this.loadReferences();
    this.reload();
  }

  setStatus(status: BillListStatus | null) {
    this.status.set(status);
    this.reload();
  }

  reload(done?: () => void) {
    this.fetch(1, done);
  }

  onRefresh(event: RefresherCustomEvent) {
    this.loadReferences();
    this.reload(() => event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent) {
    this.fetch((this.meta()?.current_page ?? 0) + 1, () => event.target.complete());
  }

  /** Ikuti billing_action dari server: create → form tagihan baru; process/view → detail tagihan. */
  open(item: BillListItem) {
    if (item.billing_action === 'create') {
      this.router.navigate(['/main/bills/visit', item.id], { state: { visit: item } });
    } else if (item.billing_action && item.bill) {
      this.router.navigate(['/main/bills', item.bill.id]);
    }
  }

  openSession(id: number) {
    this.router.navigate(['/main/cash-sessions', id]);
  }

  private loadReferences() {
    this.billService.references().subscribe({
      next: (refs) => this.references.set(refs),
      error: () => {},
    });
    this.cashService.currentSession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.sessionLoaded.set(true);
      },
      // Tanpa izin sesi kasir (403) kartu sesi disembunyikan.
      error: () => this.sessionLoaded.set(false),
    });
  }

  private fetch(page: number, done?: () => void) {
    const { search, date, payment_type } = this.filters.getRawValue();
    const params: BillListParams = {
      search: search.trim(),
      date: date || todayIso(),
      status: this.status() ?? undefined,
      payment_type: (payment_type || undefined) as PaymentType | undefined,
      per_page: PER_PAGE,
      page,
    };
    const requestId = ++this.requestId;

    this.isLoading.set(true);
    if (page === 1) this.errorMessage.set(null);

    this.billService
      .list(params)
      .pipe(
        finalize(() => {
          if (requestId === this.requestId) this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return;
          this.items.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
          this.dateLabel.set(formatDate(res.meta.date ?? params.date));
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.hasMore.set(false);
          if (page === 1) {
            this.items.set([]);
            this.meta.set(null);
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat daftar tagihan.'));
          }
        },
      });
  }
}
