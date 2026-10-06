import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { DoctorService } from '../../core/services/doctor.service';
import { Doctor, DoctorListParams, Specialty } from '../../core/models/doctor.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatTime } from '../visits/visit-format';
import { DAYS, doctorInitials } from './doctor-format';

/** Jumlah jadwal yang ditampilkan di kartu sebelum diringkas menjadi "+n jadwal lainnya". */
const MAX_SCHEDULES_IN_CARD = 3;

@Component({
  selector: 'app-doctor-list',
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
        <ion-title>Dokter</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding doctor-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="doctor-wrapper">
        <ion-searchbar
          class="search"
          placeholder="Cari nama dokter"
          [debounce]="400"
          (ionInput)="onSearch($event.detail.value)"
        ></ion-searchbar>

        <!-- Filter hari praktik -->
        <div class="chips">
          <button type="button" class="chip" [class.active]="day() === null" (click)="setDay(null)">Semua hari</button>
          @for (d of days; track d.value) {
            <button type="button" class="chip" [class.active]="day() === d.value" (click)="setDay(d.value)">
              {{ d.short }}
              @if (d.value === today()) { <span class="today-dot"></span> }
            </button>
          }
        </div>

        <!-- Filter spesialisasi -->
        @if (specialties().length > 1) {
          <div class="chips">
            <button type="button" class="chip alt" [class.active]="specialtyId() === null" (click)="setSpecialty(null)">
              Semua spesialisasi
            </button>
            @for (s of specialties(); track s.id) {
              <button type="button" class="chip alt" [class.active]="specialtyId() === s.id" (click)="setSpecialty(s.id)">
                {{ s.name }}
              </button>
            }
          </div>
        }

        @if (!errorMessage() && !(isLoading() && doctors().length === 0)) {
          <p class="summary">
            <strong>{{ doctors().length }}</strong> dokter
            @if (day() !== null) { praktik hari {{ dayLabel(day()!) }} }
            @if (practicingTodayCount() > 0 && day() === null) { · {{ practicingTodayCount() }} praktik hari ini }
          </p>
        }

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else if (isLoading() && doctors().length === 0) {
          <section class="state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else {
          @for (d of doctors(); track d.id) {
            <button type="button" class="card doctor-card" (click)="openDoctor(d)">
              <div class="doctor-head">
                <div class="avatar" [class.female]="d.gender === 'P'">{{ initials(d.name) }}</div>
                <div class="doctor-text">
                  <h3>{{ d.name }}</h3>
                  <p>{{ d.specialty?.name ?? 'Dokter Umum' }}</p>
                </div>
                @if (d.practices_today) {
                  <span class="badge"><span class="dot"></span> Praktik hari ini</span>
                }
              </div>

              <ul class="schedule-list">
                @for (s of d.schedules.slice(0, maxSchedules); track s.id) {
                  <li [class.today]="s.day_of_week === today()">
                    <span class="day">{{ s.day_label }}</span>
                    <span class="time">{{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }}</span>
                    <span class="poly">{{ s.polyclinic?.name ?? '-' }}</span>
                  </li>
                }
              </ul>
              @if (d.schedules.length > maxSchedules) {
                <p class="more">+{{ d.schedules.length - maxSchedules }} jadwal lainnya</p>
              }
            </button>
          } @empty {
            <section class="card state">
              <mat-icon>{{ hasFilter() ? 'search_off' : 'medical_services' }}</mat-icon>
              <p>{{ hasFilter() ? 'Tidak ada dokter yang cocok dengan filter.' : 'Belum ada dokter dengan jadwal praktik aktif.' }}</p>
              @if (hasFilter()) {
                <button mat-stroked-button type="button" (click)="resetFilters()">Reset filter</button>
              }
            </section>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .doctor-content {
      --background: #f8fafc;
    }

    .doctor-wrapper {
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

    .search {
      padding: 0;
      --border-radius: 12px;
      --box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .chips {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.15rem;
      scrollbar-width: none;
    }

    .chip {
      flex-shrink: 0;
      position: relative;
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

      &.alt.active {
        border-color: #9333ea;
        background: #f3e8ff;
        color: #7e22ce;
      }

      .today-dot {
        position: absolute;
        top: 3px;
        right: 5px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
      }
    }

    .summary {
      margin: 0 0.25rem;
      font-size: 0.85rem;
      color: #64748b;
    }

    .doctor-card {
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
    }

    .doctor-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .avatar {
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;

      &.female {
        background: #fce7f3;
        color: #be185d;
      }
    }

    .doctor-text {
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
    }

    .badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.68rem;
      font-weight: 600;

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
    }

    .schedule-list {
      list-style: none;
      margin: 0.75rem 0 0;
      padding: 0.6rem 0 0;
      border-top: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      li {
        display: grid;
        grid-template-columns: 64px 92px 1fr;
        gap: 0.5rem;
        padding: 0.2rem 0.4rem;
        border-radius: 8px;
        font-size: 0.8rem;
        color: #475569;

        &.today {
          background: #fff7ed;
          color: #c2410c;
          font-weight: 600;
        }
      }

      .poly {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .more {
      margin: 0.35rem 0 0 0.4rem;
      font-size: 0.75rem;
      color: var(--ion-color-primary);
      font-weight: 600;
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
export class DoctorListComponent implements ViewWillEnter {
  private doctorService = inject(DoctorService);
  private router = inject(Router);

  readonly days = DAYS;
  readonly maxSchedules = MAX_SCHEDULES_IN_CARD;
  protected formatTime = formatTime;
  protected initials = doctorInitials;

  doctors = signal<Doctor[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  /** Hari ini (1–7) menurut server. */
  today = signal<number | null>(null);

  search = signal<string>('');
  day = signal<number | null>(null);
  specialtyId = signal<number | null>(null);

  /**
   * Pilihan spesialisasi dikumpulkan dari semua respons, karena belum ada endpoint daftar spesialisasi.
   * Disimpan kumulatif supaya pilihan tidak hilang saat daftar sedang difilter.
   */
  private specialtyMap = signal<Map<number, Specialty>>(new Map());
  specialties = computed(() =>
    [...this.specialtyMap().values()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  practicingTodayCount = computed(() => this.doctors().filter((d) => d.practices_today).length);
  hasFilter = computed(() => !!this.search() || this.day() !== null || this.specialtyId() !== null);

  /** Penanda request terbaru, supaya respons lama tidak menimpa hasil filter yang lebih baru. */
  private requestId = 0;

  ionViewWillEnter() {
    this.load();
  }

  onSearch(value: string | null | undefined) {
    this.search.set((value ?? '').trim());
    this.load();
  }

  setDay(day: number | null) {
    this.day.set(day);
    this.load();
  }

  setSpecialty(id: number | null) {
    this.specialtyId.set(id);
    this.load();
  }

  resetFilters() {
    this.search.set('');
    this.day.set(null);
    this.specialtyId.set(null);
    this.load();
  }

  dayLabel(day: number): string {
    return DAYS.find((d) => d.value === day)?.label ?? '';
  }

  openDoctor(doctor: Doctor) {
    this.router.navigate(['/main/doctors', doctor.id], { state: { doctor } });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  load(done?: () => void) {
    const params: DoctorListParams = {
      search: this.search(),
      day_of_week: this.day() ?? undefined,
      specialty_id: this.specialtyId() ?? undefined,
    };
    const requestId = ++this.requestId;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.doctorService
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
          this.doctors.set(res.data);
          this.today.set(res.meta.today);
          this.collectSpecialties(res.data);
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.doctors.set([]);
          this.errorMessage.set(describeHttpError(err, 'Gagal memuat daftar dokter.'));
        },
      });
  }

  private collectSpecialties(doctors: Doctor[]) {
    const map = new Map(this.specialtyMap());
    for (const d of doctors) {
      if (d.specialty) map.set(d.specialty.id, d.specialty);
    }
    this.specialtyMap.set(map);
  }
}
