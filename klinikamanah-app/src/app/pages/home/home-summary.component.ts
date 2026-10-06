import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, tap } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import {
  CashSummary,
  DashboardService,
  RevenueSummary,
  SummaryPart,
  VisitSummary,
} from '../../core/services/dashboard.service';
import { DoctorSchedule } from '../../core/models/visit.model';
import { formatDate, formatTime, todayIso } from '../visits/visit-format';
import { formatRupiah } from '../bills/bill-format';

/** Jumlah jadwal dokter yang ditampilkan sebelum "Lihat semua". */
const MAX_SCHEDULES = 5;

/**
 * Ringkasan hari ini di beranda: pendapatan tagihan, kunjungan, kas masuk/keluar,
 * dan dokter yang praktik beserta sisa kuotanya. Kartu yang tidak bisa diakses user (403) disembunyikan.
 */
@Component({
  selector: 'app-home-summary',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (hasAnyAccess()) {
      <section class="summary">
        <div class="summary-head">
          <h2>Ringkasan Hari Ini</h2>
          <span>{{ todayLabel }}</span>
        </div>

        <div class="tiles">
          <!-- Pendapatan -->
          @if (revenue() !== null) {
            <button type="button" class="tile revenue" (click)="go('/main/bills')">
              <span class="tile-icon"><mat-icon>payments</mat-icon></span>
              <span class="tile-label">Pendapatan Tagihan</span>
              @switch (state(revenue())) {
                @case ('loading') { <span class="skeleton"></span> }
                @case ('error') { <span class="tile-error">Gagal dimuat</span> }
                @default {
                  @let r = asRevenue(revenue());
                  <strong class="tile-value">{{ rupiah(r.paid) }}</strong>
                  <span class="tile-sub">
                    {{ r.paidBills }} lunas
                    @if (r.outstanding > 0) { · belum dibayar {{ rupiah(r.outstanding) }} }
                  </span>
                }
              }
            </button>
          }

          <!-- Kunjungan -->
          @if (visits() !== null) {
            <button type="button" class="tile visits" (click)="go('/main/visits')">
              <span class="tile-icon"><mat-icon>groups</mat-icon></span>
              <span class="tile-label">Kunjungan Pasien</span>
              @switch (state(visits())) {
                @case ('loading') { <span class="skeleton"></span> }
                @case ('error') { <span class="tile-error">Gagal dimuat</span> }
                @default {
                  @let v = asVisits(visits());
                  <strong class="tile-value">{{ v.registered }} <small>pasien</small></strong>
                  <span class="tile-sub">
                    @if (v.cancelled > 0) { {{ v.cancelled }} batal } @else { Tidak ada pembatalan }
                  </span>
                }
              }
            </button>
          }

          <!-- Kas masuk & keluar -->
          @if (cash() !== null) {
            <button type="button" class="tile cash-in" (click)="go('/main/cash-transactions')">
              <span class="tile-icon"><mat-icon>south_west</mat-icon></span>
              <span class="tile-label">Kas Masuk</span>
              @switch (state(cash())) {
                @case ('loading') { <span class="skeleton"></span> }
                @case ('error') { <span class="tile-error">Gagal dimuat</span> }
                @default { <strong class="tile-value">{{ rupiah(asCash(cash()).totalIn) }}</strong> }
              }
            </button>
            <button type="button" class="tile cash-out" (click)="go('/main/cash-transactions')">
              <span class="tile-icon"><mat-icon>north_east</mat-icon></span>
              <span class="tile-label">Kas Keluar</span>
              @switch (state(cash())) {
                @case ('loading') { <span class="skeleton"></span> }
                @case ('error') { <span class="tile-error">Gagal dimuat</span> }
                @default { <strong class="tile-value">{{ rupiah(asCash(cash()).totalOut) }}</strong> }
              }
            </button>
          }
        </div>

        <!-- Dokter praktik hari ini -->
        @if (schedules() !== null) {
          <div class="doctors">
            <div class="doctors-head">
              <h3>Dokter Praktik Hari Ini</h3>
              @if (scheduleList().length) {
                <span class="counts">
                  <span class="open">{{ openCount() }} open</span>
                  <span class="full">{{ fullCount() }} penuh</span>
                </span>
              }
            </div>

            @switch (state(schedules())) {
              @case ('loading') {
                <span class="skeleton wide"></span>
                <span class="skeleton wide"></span>
              }
              @case ('error') { <p class="tile-error">Gagal memuat jadwal dokter.</p> }
              @default {
                @for (s of scheduleList().slice(0, maxSchedules); track s.id) {
                  <div class="doctor-row">
                    <div class="doctor-text">
                      <strong>{{ s.doctor.name }}</strong>
                      <span>{{ s.polyclinic?.name ?? '-' }} · {{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }}</span>
                    </div>
                    <span class="quota" [class.full]="s.is_full">
                      @if (s.is_full) {
                        Penuh
                      } @else if (s.remaining_quota === null) {
                        Open · tanpa batas
                      } @else {
                        Open · sisa {{ s.remaining_quota }}/{{ s.quota }}
                      }
                    </span>
                  </div>
                } @empty {
                  <p class="empty">Tidak ada dokter yang praktik hari ini.</p>
                }
                @if (scheduleList().length > maxSchedules) {
                  <button type="button" class="see-all" (click)="go('/main/schedules')">
                    Lihat semua {{ scheduleList().length }} jadwal <mat-icon>chevron_right</mat-icon>
                  </button>
                } @else if (scheduleList().length) {
                  <button type="button" class="see-all" (click)="go('/main/schedules')">
                    Lihat jadwal <mat-icon>chevron_right</mat-icon>
                  </button>
                }
              }
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    .summary {
      background: #fff;
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .summary-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.75rem;

      h2 {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
      }

      span {
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }

    .tiles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
    }

    .tile {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      min-width: 0;
      padding: 0.8rem;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      font: inherit;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s;

      &:active {
        transform: scale(0.98);
      }

      &.revenue {
        grid-column: 1 / -1;
        background: linear-gradient(135deg, #ca8a04, #a16207);
        color: #fff;

        .tile-icon {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .tile-label,
        .tile-sub {
          color: rgba(255, 255, 255, 0.9);
        }

        .tile-value {
          color: #fff;
          font-size: 1.5rem;
        }

        .skeleton {
          background: rgba(255, 255, 255, 0.25);
        }
      }

      &.visits {
        grid-column: 1 / -1;
        background: #eff6ff;

        .tile-icon {
          background: #dbeafe;
          color: #1d4ed8;
        }
      }

      &.cash-in {
        background: #f0fdf4;

        .tile-icon {
          background: #dcfce7;
          color: #15803d;
        }

        .tile-value {
          color: #15803d;
        }
      }

      &.cash-out {
        background: #fef2f2;

        .tile-icon {
          background: #fee2e2;
          color: #b91c1c;
        }

        .tile-value {
          color: #b91c1c;
        }
      }
    }

    .tile-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.25rem;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .tile-label {
      font-size: 0.75rem;
      color: #64748b;
    }

    .tile-value {
      max-width: 100%;
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      small {
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
      }
    }

    .tile-sub {
      font-size: 0.72rem;
      color: #64748b;
    }

    .tile-error {
      margin: 0;
      font-size: 0.78rem;
      color: #dc2626;
    }

    .skeleton {
      display: block;
      width: 70%;
      height: 1.1rem;
      margin-top: 0.15rem;
      border-radius: 6px;
      background: #e2e8f0;
      animation: pulse 1.2s ease-in-out infinite;

      &.wide {
        width: 100%;
        height: 2rem;
        margin-bottom: 0.5rem;
      }
    }

    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }

    .doctors {
      margin-top: 1rem;
      padding-top: 0.9rem;
      border-top: 1px solid #f1f5f9;
    }

    .doctors-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;

      h3 {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: #1e293b;
      }
    }

    .counts {
      display: flex;
      gap: 0.35rem;

      span {
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 600;
      }

      .open {
        background: #dcfce7;
        color: #15803d;
      }

      .full {
        background: #fee2e2;
        color: #b91c1c;
      }
    }

    .doctor-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;

      & + .doctor-row {
        border-top: 1px solid #f8fafc;
      }
    }

    .doctor-text {
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
      }
    }

    .quota {
      flex-shrink: 0;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.7rem;
      font-weight: 600;

      &.full {
        background: #fee2e2;
        color: #b91c1c;
      }
    }

    .empty {
      margin: 0.25rem 0;
      font-size: 0.82rem;
      color: #94a3b8;
    }

    .see-all {
      display: inline-flex;
      align-items: center;
      margin-top: 0.4rem;
      padding: 0;
      border: none;
      background: none;
      color: var(--ion-color-primary);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `],
})
export class HomeSummaryComponent implements OnInit {
  private dashboard = inject(DashboardService);
  private router = inject(Router);

  readonly todayLabel = formatDate(todayIso());
  readonly maxSchedules = MAX_SCHEDULES;
  protected rupiah = formatRupiah;
  protected formatTime = formatTime;

  /** undefined = sedang dimuat pertama kali. */
  revenue = signal<SummaryPart<RevenueSummary> | undefined>(undefined);
  visits = signal<SummaryPart<VisitSummary> | undefined>(undefined);
  cash = signal<SummaryPart<CashSummary> | undefined>(undefined);
  schedules = signal<SummaryPart<DoctorSchedule[]> | undefined>(undefined);

  /** Sembunyikan seluruh section hanya jika user tidak punya akses ke satu pun bagian. */
  hasAnyAccess = computed(() =>
    [this.revenue(), this.visits(), this.cash(), this.schedules()].some((part) => part !== null),
  );
  scheduleList = computed(() => {
    const value = this.schedules();
    return Array.isArray(value) ? value : [];
  });
  openCount = computed(() => this.scheduleList().filter((s) => !s.is_full).length);
  fullCount = computed(() => this.scheduleList().filter((s) => s.is_full).length);

  ngOnInit() {
    this.reload().subscribe({ error: () => {} });
  }

  /** Muat ulang semua bagian; dipakai juga oleh pull-to-refresh beranda. */
  reload(): Observable<unknown> {
    const date = todayIso();
    return forkJoin([
      this.dashboard.revenue(date).pipe(tap((v) => this.revenue.set(v))),
      this.dashboard.visits(date).pipe(tap((v) => this.visits.set(v))),
      this.dashboard.cash(date).pipe(tap((v) => this.cash.set(v))),
      this.dashboard.schedules().pipe(tap((v) => this.schedules.set(v))),
    ]);
  }

  go(url: string) {
    this.router.navigateByUrl(url);
  }

  state(part: SummaryPart<unknown> | undefined): 'loading' | 'error' | 'ready' {
    if (part === undefined) return 'loading';
    if (part === 'error') return 'error';
    return 'ready';
  }

  // Penyempit tipe untuk template (dipanggil hanya saat state = 'ready').
  asRevenue(part: SummaryPart<RevenueSummary> | undefined): RevenueSummary {
    return part as RevenueSummary;
  }

  asVisits(part: SummaryPart<VisitSummary> | undefined): VisitSummary {
    return part as VisitSummary;
  }

  asCash(part: SummaryPart<CashSummary> | undefined): CashSummary {
    return part as CashSummary;
  }
}
