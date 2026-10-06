import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { VisitService } from '../../core/services/visit.service';
import { DoctorSchedule, Polyclinic } from '../../core/models/visit.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate, formatTime, todayIso } from '../visits/visit-format';

type PracticeState = 'upcoming' | 'ongoing' | 'finished';

/** Jadwal dokter yang praktik hari ini beserta kuota pasien, dari GET /api/visits/schedules. */
@Component({
  selector: 'app-schedule-list',
  standalone: true,
  imports: [
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
    IonSearchbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Jadwal Dokter</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding schedule-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="schedule-wrapper">
        <!-- Ringkasan hari ini -->
        <section class="card summary">
          <div class="summary-date">
            <mat-icon>today</mat-icon>
            <div>
              <span class="caption">Praktik hari ini</span>
              <strong>{{ dateLabel() }}</strong>
            </div>
          </div>
          <div class="summary-stats">
            <div><strong>{{ schedules().length }}</strong><span>Jadwal</span></div>
            <div><strong>{{ totalRegistered() }}</strong><span>Pasien</span></div>
            <div><strong>{{ availableCount() }}</strong><span>Tersedia</span></div>
          </div>
        </section>

        @if (schedules().length > 0) {
          <ion-searchbar
            class="search"
            placeholder="Cari dokter atau spesialis"
            [debounce]="200"
            (ionInput)="searchTerm.set($event.detail.value ?? '')"
          ></ion-searchbar>

          @if (polyclinics().length > 1) {
            <div class="chips">
              <button type="button" class="chip" [class.active]="polyclinicId() === null" (click)="polyclinicId.set(null)">
                Semua
              </button>
              @for (p of polyclinics(); track p.id) {
                <button type="button" class="chip" [class.active]="polyclinicId() === p.id" (click)="polyclinicId.set(p.id)">
                  {{ p.name }}
                </button>
              }
            </div>
          }
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else if (isLoading() && schedules().length === 0) {
          <section class="state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else {
          @for (s of filtered(); track s.id) {
            @let state = practiceState(s);
            <section class="card schedule-card" [class.finished]="state === 'finished'">
              <div class="schedule-head">
                <div class="time">
                  <strong>{{ formatTime(s.start_time) }}</strong>
                  <span>{{ formatTime(s.end_time) }}</span>
                </div>
                <div class="doctor">
                  <h3>{{ s.doctor.name }}</h3>
                  <p>{{ s.doctor.specialty?.name ?? 'Umum' }}</p>
                  <p class="poly">
                    <mat-icon>meeting_room</mat-icon>
                    {{ s.polyclinic?.name ?? '-' }}
                  </p>
                </div>
                <span class="badge" [class]="state">
                  @switch (state) {
                    @case ('ongoing') { <span class="dot"></span> Sedang praktik }
                    @case ('upcoming') { Belum mulai }
                    @case ('finished') { Selesai }
                  }
                </span>
              </div>

              <div class="quota">
                <div class="quota-text">
                  <span>{{ s.registered_visits_count }} pasien terdaftar</span>
                  <strong [class.full]="s.is_full">
                    @if (s.is_full) {
                      Kuota penuh
                    } @else if (s.quota === null) {
                      Tanpa batas kuota
                    } @else {
                      Sisa {{ s.remaining_quota }} dari {{ s.quota }}
                    }
                  </strong>
                </div>
                @if (s.quota !== null) {
                  <div class="bar">
                    <span [style.width.%]="quotaPercent(s)" [class.full]="s.is_full"></span>
                  </div>
                }
              </div>
            </section>
          } @empty {
            <section class="card state">
              <mat-icon>{{ schedules().length ? 'search_off' : 'event_busy' }}</mat-icon>
              <p>
                {{ schedules().length ? 'Tidak ada jadwal yang cocok dengan pencarian.' : 'Tidak ada dokter yang praktik hari ini.' }}
              </p>
            </section>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .schedule-content {
      --background: #f8fafc;
    }

    .schedule-wrapper {
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

    .summary {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: linear-gradient(135deg, #ea580c, #c2410c);
      color: #fff;
    }

    .summary-date {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      div {
        display: flex;
        flex-direction: column;
      }

      .caption {
        font-size: 0.75rem;
        opacity: 0.85;
      }
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;

      div {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.5rem 0;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.15);
      }

      strong {
        font-size: 1.25rem;
      }

      span {
        font-size: 0.72rem;
        opacity: 0.9;
      }
    }

    .search {
      padding: 0;
      --border-radius: 12px;
      --box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .chips {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
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

    .schedule-card {
      padding: 1rem;

      &.finished {
        opacity: 0.6;
      }
    }

    .schedule-head {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .time {
      flex-shrink: 0;
      width: 60px;
      padding: 0.45rem 0;
      border-radius: 12px;
      background: #ffedd5;
      color: #c2410c;
      display: flex;
      flex-direction: column;
      align-items: center;

      strong {
        font-size: 1rem;
      }

      span {
        font-size: 0.72rem;
      }
    }

    .doctor {
      flex: 1;
      min-width: 0;

      h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #1e293b;
      }

      p {
        margin: 0.1rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .poly {
        display: flex;
        align-items: center;
        gap: 0.25rem;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    .badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 600;

      &.ongoing {
        background: #dcfce7;
        color: #15803d;
      }

      &.upcoming {
        background: #e0f2fe;
        color: #0369a1;
      }

      &.finished {
        background: #f1f5f9;
        color: #64748b;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
    }

    .quota {
      margin-top: 0.85rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f1f5f9;
    }

    .quota-text {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #64748b;

      strong {
        color: #15803d;

        &.full {
          color: #b91c1c;
        }
      }
    }

    .bar {
      height: 6px;
      margin-top: 0.4rem;
      border-radius: 999px;
      background: #f1f5f9;
      overflow: hidden;

      span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: #22c55e;
        transition: width 0.3s;

        &.full {
          background: #ef4444;
        }
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
export class ScheduleListComponent implements ViewWillEnter {
  private visitService = inject(VisitService);

  schedules = signal<DoctorSchedule[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  dateLabel = signal<string>(formatDate(todayIso()));
  /** Waktu acuan status praktik; diperbarui setiap kali data dimuat. */
  private now = signal<Date>(new Date());

  searchTerm = signal<string>('');
  polyclinicId = signal<number | null>(null);

  protected formatTime = formatTime;

  polyclinics = computed<Polyclinic[]>(() => {
    const map = new Map<number, Polyclinic>();
    for (const s of this.schedules()) {
      if (s.polyclinic) map.set(s.polyclinic.id, s.polyclinic);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const polyId = this.polyclinicId();
    return this.schedules().filter((s) => {
      if (polyId !== null && s.polyclinic?.id !== polyId) return false;
      if (!term) return true;
      return [s.doctor.name, s.doctor.specialty?.name, s.polyclinic?.name]
        .some((v) => v?.toLowerCase().includes(term));
    });
  });

  totalRegistered = computed(() => this.schedules().reduce((sum, s) => sum + s.registered_visits_count, 0));
  availableCount = computed(() => this.schedules().filter((s) => !s.is_full).length);

  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.visitService
      .schedules()
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          this.schedules.set(res.data);
          this.dateLabel.set(formatDate(res.meta.date));
          this.now.set(new Date());
          // Lepas filter poliklinik yang sudah tidak ada di data terbaru.
          const polyId = this.polyclinicId();
          if (polyId !== null && !this.polyclinics().some((p) => p.id === polyId)) {
            this.polyclinicId.set(null);
          }
        },
        error: (err) => {
          // Saat pull-to-refresh gagal, data lama tetap ditampilkan.
          if (this.schedules().length === 0) {
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat jadwal dokter.'));
          }
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  practiceState(s: DoctorSchedule): PracticeState {
    const current = this.toMinutes(this.now());
    if (current < this.parseTime(s.start_time)) return 'upcoming';
    if (current >= this.parseTime(s.end_time)) return 'finished';
    return 'ongoing';
  }

  quotaPercent(s: DoctorSchedule): number {
    if (!s.quota) return 0;
    return Math.min(100, Math.round((s.registered_visits_count / s.quota) * 100));
  }

  private parseTime(value: string): number {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private toMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }
}
