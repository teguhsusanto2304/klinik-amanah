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
import { VisitService } from '../../core/services/visit.service';
import { PaginationMeta } from '../../core/models/patient.model';
import { ReferenceOption, Visit, VisitListParams, VisitStatus } from '../../core/models/visit.model';
import { describeHttpError } from '../../core/utils/http-error';
import { VisitCardComponent } from './visit-card.component';
import { formatDate, todayIso } from './visit-format';

const PER_PAGE = 20;

/** Daftar kunjungan (antrean) per hari, default hari ini. */
@Component({
  selector: 'app-visit-list',
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
    VisitCardComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Antrean Kunjungan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding list-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="list-wrapper">
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
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="">Semua</mat-option>
                @for (s of statuses(); track s.value) {
                  <mat-option [value]="s.value">{{ s.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </form>

        @if (meta(); as m) {
          <p class="summary">
            {{ dateLabel() }} · <strong>{{ m.total }}</strong> kunjungan
          </p>
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="reload()">Coba lagi</button>
          </section>
        } @else if (isLoading() && visits().length === 0) {
          <section class="state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else {
          @for (v of visits(); track v.id) {
            <app-visit-card [visit]="v" (open)="openVisit($event)"></app-visit-card>
          } @empty {
            <section class="card state">
              <mat-icon>event_note</mat-icon>
              <p>Belum ada kunjungan pada tanggal ini.</p>
              <button mat-stroked-button type="button" (click)="router.navigateByUrl('/main/patients')">
                <mat-icon>person_search</mat-icon>
                Cari pasien untuk didaftarkan
              </button>
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
    .list-content {
      --background: #f8fafc;
    }

    .list-wrapper {
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

    .summary {
      margin: 0 0.25rem;
      font-size: 0.85rem;
      color: #64748b;
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

      button mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: inherit;
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
export class VisitListComponent implements OnInit, ViewWillEnter {
  private fb = inject(NonNullableFormBuilder);
  private visitService = inject(VisitService);
  private destroyRef = inject(DestroyRef);
  protected router = inject(Router);

  filters = this.fb.group({
    search: [''],
    date: [todayIso()],
    status: [''],
  });

  visits = signal<Visit[]>([]);
  meta = signal<PaginationMeta | null>(null);
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  statuses = signal<ReferenceOption<VisitStatus>[]>([]);
  dateLabel = signal<string>(formatDate(todayIso()));

  /** Penanda request terbaru, supaya respons lama tidak menimpa hasil filter yang lebih baru. */
  private requestId = 0;

  ngOnInit() {
    this.visitService.references().subscribe({
      next: (refs) => this.statuses.set(refs.statuses),
      error: () => {},
    });

    const { search, date, status } = this.filters.controls;
    merge(
      search.valueChanges.pipe(map((v) => v.trim()), debounceTime(400), distinctUntilChanged()),
      date.valueChanges,
      status.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  /** Muat ulang setiap kali halaman tampil, agar kunjungan yang baru didaftarkan/dibatalkan ikut terlihat. */
  ionViewWillEnter() {
    this.reload();
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

  openVisit(visit: Visit) {
    this.router.navigate(['/main/visits', visit.id]);
  }

  private fetch(page: number, done?: () => void) {
    const { search, date, status } = this.filters.getRawValue();
    const params: VisitListParams = {
      search: search.trim(),
      date: date || todayIso(),
      status: (status || undefined) as VisitStatus | undefined,
      per_page: PER_PAGE,
      page,
    };
    const requestId = ++this.requestId;

    this.isLoading.set(true);
    if (page === 1) this.errorMessage.set(null);

    this.visitService
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
          this.visits.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);
          this.dateLabel.set(formatDate(params.date));
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.hasMore.set(false);
          if (page === 1) {
            this.visits.set([]);
            this.meta.set(null);
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat daftar kunjungan.'));
          }
        },
      });
  }
}
