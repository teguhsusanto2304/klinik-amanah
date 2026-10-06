import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
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
import { CashSessionDetail, CashSessionStatus } from '../../core/models/cash.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDateTime, formatRupiah } from '../bills/bill-format';

const PER_PAGE = 15;

/** Riwayat sesi kasir, filter tanggal buka & status. */
@Component({
  selector: 'app-cash-session-list',
  standalone: true,
  imports: [
    FormsModule,
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
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>Riwayat Sesi Kasir</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding form-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="form-wrapper">
        <section class="card filters">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Tanggal dibuka</mat-label>
            <input matInput type="date" [ngModel]="date()" (ngModelChange)="setDate($event)" />
            @if (date()) {
              <button matSuffix mat-icon-button type="button" (click)="setDate('')" aria-label="Hapus tanggal">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
          <div class="chips">
            <button type="button" class="chip" [class.active]="status() === null" (click)="setStatus(null)">Semua</button>
            <button type="button" class="chip" [class.active]="status() === 'open'" (click)="setStatus('open')">Berjalan</button>
            <button type="button" class="chip" [class.active]="status() === 'closed'" (click)="setStatus('closed')">Ditutup</button>
          </div>
        </section>

        @if (canOpen) {
          <button mat-flat-button color="primary" type="button" class="full-width" (click)="router.navigateByUrl('/main/cash-sessions/open')">
            <mat-icon>lock_open</mat-icon> Buka Sesi Baru
          </button>
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="fetch(1)">Coba lagi</button>
          </section>
        } @else if (isLoading() && sessions().length === 0) {
          <section class="state"><mat-spinner diameter="32"></mat-spinner></section>
        } @else {
          @for (s of sessions(); track s.id) {
            <button type="button" class="list-item" (click)="open(s)">
              <span class="icon" [class.open]="s.status === 'open'">
                <mat-icon>{{ s.status === 'open' ? 'point_of_sale' : 'lock' }}</mat-icon>
              </span>
              <div class="text">
                <strong>{{ s.number }}</strong>
                <span>{{ s.user?.name ?? '-' }} · {{ formatDateTime(s.opened_at) }}</span>
                @if (s.status === 'closed' && s.difference) {
                  <span [style.color]="s.difference > 0 ? '#0369a1' : '#b91c1c'">
                    Selisih {{ s.difference > 0 ? 'lebih' : 'kurang' }} {{ rupiah(abs(s.difference)) }}
                  </span>
                }
              </div>
              <div class="value">
                <span class="badge" [class]="s.status">{{ s.status_label }}</span>
                <small>Awal {{ rupiah(s.opening_balance) }}</small>
              </div>
            </button>
          } @empty {
            <section class="card state">
              <mat-icon>point_of_sale</mat-icon>
              <p>Belum ada sesi kasir.</p>
            </section>
          }
        }
      </div>

      <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="onLoadMore($event)">
        <ion-infinite-scroll-content loadingText="Memuat..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </ion-content>
  `,
  styleUrl: './cash-form.scss',
  styles: [`
    .filters {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
    }
  `],
})
export class CashSessionListComponent implements ViewWillEnter {
  private cashService = inject(CashService);
  private auth = inject(AuthService);
  protected router = inject(Router);

  readonly canOpen = this.auth.can('cash_sessions.create');
  protected rupiah = formatRupiah;
  protected formatDateTime = formatDateTime;
  protected abs = Math.abs;

  date = signal<string>('');
  status = signal<CashSessionStatus | null>(null);

  sessions = signal<CashSessionDetail[]>([]);
  meta = signal<PaginationMeta | null>(null);
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  private requestId = 0;

  ionViewWillEnter() {
    this.fetch(1);
  }

  setDate(date: string) {
    this.date.set(date ?? '');
    this.fetch(1);
  }

  setStatus(status: CashSessionStatus | null) {
    this.status.set(status);
    this.fetch(1);
  }

  open(session: CashSessionDetail) {
    this.router.navigate(['/main/cash-sessions', session.id]);
  }

  onRefresh(event: RefresherCustomEvent) {
    this.fetch(1, () => event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent) {
    this.fetch((this.meta()?.current_page ?? 0) + 1, () => event.target.complete());
  }

  fetch(page: number, done?: () => void) {
    const requestId = ++this.requestId;
    this.isLoading.set(true);
    if (page === 1) this.errorMessage.set(null);

    this.cashService
      .sessions({ date: this.date(), status: this.status() ?? undefined, per_page: PER_PAGE, page })
      .pipe(
        finalize(() => {
          if (requestId === this.requestId) this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return;
          this.sessions.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.hasMore.set(false);
          if (page === 1) {
            this.sessions.set([]);
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat riwayat sesi kasir.'));
          }
        },
      });
  }
}
