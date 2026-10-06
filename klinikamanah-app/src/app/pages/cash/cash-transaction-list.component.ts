import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, map, merge } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { CashService } from '../../core/services/cash.service';
import { PaginationMeta } from '../../core/models/patient.model';
import { CashTransaction, CashTransactionType } from '../../core/models/cash.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate, todayIso } from '../visits/visit-format';
import { formatRupiah } from '../bills/bill-format';

const PER_PAGE = 15;

/** Awal bulan berjalan (Y-m-d), default filter tanggal awal. */
function firstDayOfMonth(): string {
  return `${todayIso().slice(0, 8)}01`;
}

/** Daftar kas masuk/keluar beserta total periode. */
@Component({
  selector: 'app-cash-transaction-list',
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
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonFab,
    IonFabButton,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>Kas Masuk/Keluar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="form-wrapper">
        <!-- Total periode -->
        <section class="card totals">
          <div class="in"><span>Kas masuk</span><strong>{{ rupiah(totalIn()) }}</strong></div>
          <div class="out"><span>Kas keluar</span><strong>{{ rupiah(totalOut()) }}</strong></div>
          <div class="net"><span>Selisih</span><strong>{{ rupiah(totalIn() - totalOut()) }}</strong></div>
        </section>

        <form [formGroup]="filters" class="card filters">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Cari nomor, uraian, atau referensi</mat-label>
            <input matInput formControlName="search" autocomplete="off" />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
          <div class="filter-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Dari</mat-label>
              <input matInput type="date" formControlName="from" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Sampai</mat-label>
              <input matInput type="date" formControlName="to" />
            </mat-form-field>
          </div>
          <div class="chips">
            <button type="button" class="chip" [class.active]="type() === null" (click)="setType(null)">Semua</button>
            <button type="button" class="chip" [class.active]="type() === 'in'" (click)="setType('in')">Kas Masuk</button>
            <button type="button" class="chip" [class.active]="type() === 'out'" (click)="setType('out')">Kas Keluar</button>
          </div>
        </form>

        @if (meta(); as m) {
          <p class="summary">
            {{ periodLabel() }} · <strong>{{ m.total }}</strong> transaksi
          </p>
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="reload()">Coba lagi</button>
          </section>
        } @else if (isLoading() && transactions().length === 0) {
          <section class="state"><mat-spinner diameter="32"></mat-spinner></section>
        } @else {
          @for (t of transactions(); track t.id) {
            <button type="button" class="list-item" [class.cancelled]="t.status === 'cancelled'" (click)="open(t)">
              <span class="icon" [class]="t.type">
                <mat-icon>{{ t.type === 'in' ? 'south_west' : 'north_east' }}</mat-icon>
              </span>
              <div class="text">
                <strong>{{ t.description }}</strong>
                <span>{{ t.category_label }} · {{ t.method_label }}</span>
                <span>{{ t.number }} · {{ formatDate(t.transaction_date, 'short') }}</span>
              </div>
              <div class="value" [class]="t.type">
                {{ t.type === 'in' ? '+' : '−' }} {{ rupiah(t.amount) }}
                @if (t.status === 'cancelled') { <small>Dibatalkan</small> }
              </div>
            </button>
          } @empty {
            <section class="card state">
              <mat-icon>swap_vert</mat-icon>
              <p>Belum ada transaksi kas pada periode ini.</p>
            </section>
          }
        }
        <div class="fab-space"></div>
      </div>

      <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="onLoadMore($event)">
        <ion-infinite-scroll-content loadingText="Memuat..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>

      @if (canCreate) {
        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button (click)="router.navigateByUrl('/main/cash-transactions/new')" aria-label="Catat transaksi">
            <mat-icon>add</mat-icon>
          </ion-fab-button>
        </ion-fab>
      }
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
  styles: [`
    .totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      padding: 1rem;

      div {
        display: flex;
        flex-direction: column;
        padding: 0.5rem 0.6rem;
        border-radius: 10px;
        min-width: 0;
      }

      span {
        font-size: 0.7rem;
      }

      strong {
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .in {
        background: #dcfce7;
        color: #15803d;
      }

      .out {
        background: #fee2e2;
        color: #b91c1c;
      }

      .net {
        background: #f1f5f9;
        color: #334155;
      }
    }

    .filters {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
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

    .summary {
      margin: 0 0.25rem;
      font-size: 0.85rem;
      color: #64748b;
    }

    .fab-space {
      height: 64px;
    }
  `],
})
export class CashTransactionListComponent implements OnInit, ViewWillEnter {
  private fb = inject(NonNullableFormBuilder);
  private cashService = inject(CashService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  protected router = inject(Router);

  readonly canCreate = this.auth.can('cash_transactions.create');
  protected rupiah = formatRupiah;
  protected formatDate = formatDate;

  filters = this.fb.group({
    search: [''],
    from: [firstDayOfMonth()],
    to: [todayIso()],
  });
  type = signal<CashTransactionType | null>(null);

  transactions = signal<CashTransaction[]>([]);
  meta = signal<PaginationMeta | null>(null);
  totalIn = signal<number>(0);
  totalOut = signal<number>(0);
  periodLabel = signal<string>('');
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  private requestId = 0;

  ngOnInit() {
    const { search, from, to } = this.filters.controls;
    merge(
      search.valueChanges.pipe(map((v) => v.trim()), debounceTime(400), distinctUntilChanged()),
      from.valueChanges,
      to.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  /** Muat ulang saat tampil agar transaksi yang baru dicatat/dibatalkan ikut terlihat. */
  ionViewWillEnter() {
    this.reload();
  }

  setType(type: CashTransactionType | null) {
    this.type.set(type);
    this.reload();
  }

  open(transaction: CashTransaction) {
    this.router.navigate(['/main/cash-transactions', transaction.id]);
  }

  reload(done?: () => void) {
    this.fetch(1, done);
  }

  onRefresh(event: RefresherCustomEvent) {
    this.reload(() => event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent) {
    this.fetch((this.meta()?.current_page ?? 0) + 1, () => event.target.complete());
  }

  private fetch(page: number, done?: () => void) {
    const { search, from, to } = this.filters.getRawValue();
    const requestId = ++this.requestId;
    this.isLoading.set(true);
    if (page === 1) this.errorMessage.set(null);

    this.cashService
      .transactions({
        search: search.trim(),
        from,
        to,
        type: this.type() ?? undefined,
        per_page: PER_PAGE,
        page,
      })
      .pipe(
        finalize(() => {
          if (requestId === this.requestId) this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return;
          this.transactions.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.totalIn.set(res.meta.total_in);
          this.totalOut.set(res.meta.total_out);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
          this.periodLabel.set(
            from || to
              ? `${from ? formatDate(from, 'short') : '…'} – ${to ? formatDate(to, 'short') : '…'}`
              : 'Semua tanggal',
          );
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.hasMore.set(false);
          if (page === 1) {
            this.transactions.set([]);
            this.meta.set(null);
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat transaksi kas.'));
          }
        },
      });
  }
}
