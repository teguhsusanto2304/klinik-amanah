import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { DoctorService } from '../../core/services/doctor.service';
import { Doctor, PracticeSchedule } from '../../core/models/doctor.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatTime } from '../visits/visit-format';
import { DAYS, doctorInitials } from './doctor-format';

interface DaySchedules {
  value: number;
  label: string;
  schedules: PracticeSchedule[];
}

/** Hari ini dalam format ISO 1–7 (Senin–Minggu) menurut jam perangkat. */
function isoToday(): number {
  return new Date().getDay() || 7;
}

@Component({
  selector: 'app-doctor-detail',
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
          <ion-back-button defaultHref="/main/doctors"></ion-back-button>
        </ion-buttons>
        <ion-title>Detail Dokter</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding detail-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="detail-wrapper">
        @if (doctor(); as d) {
          <!-- Profil -->
          <section class="card profile">
            <div class="avatar" [class.female]="d.gender === 'P'">{{ initials(d.name) }}</div>
            <h1>{{ d.name }}</h1>
            <p class="specialty">{{ d.specialty?.name ?? 'Dokter Umum' }}</p>
            <div class="tags">
              @if (practicesToday()) {
                <span class="tag today"><span class="dot"></span> Praktik hari ini</span>
              }
              @if (!d.is_active) {
                <span class="tag inactive">Tidak aktif</span>
              }
            </div>

            @if (d.phone || d.email) {
              <div class="contact">
                @if (d.phone) {
                  <a mat-stroked-button [href]="'tel:' + d.phone"><mat-icon>call</mat-icon> Telepon</a>
                }
                @if (d.email) {
                  <a mat-stroked-button [href]="'mailto:' + d.email"><mat-icon>mail</mat-icon> Email</a>
                }
              </div>
            }
          </section>

          <!-- Informasi -->
          <section class="card">
            <h2>Informasi</h2>
            <div class="row"><span class="label">Spesialisasi</span><span>{{ d.specialty?.name ?? 'Umum' }}</span></div>
            @if (d.specialty?.title) {
              <div class="row"><span class="label">Gelar</span><span>{{ d.specialty?.title }}</span></div>
            }
            <div class="row"><span class="label">Jenis kelamin</span><span>{{ d.gender_label ?? '-' }}</span></div>
            <div class="row"><span class="label">No. STR/SIP</span><span>{{ d.license_number || '-' }}</span></div>
            <div class="row"><span class="label">Telepon</span><span>{{ d.phone || '-' }}</span></div>
            <div class="row"><span class="label">Email</span><span class="break">{{ d.email || '-' }}</span></div>
            @if (d.clinic) {
              <div class="row"><span class="label">Klinik</span><span>{{ d.clinic.name }}</span></div>
            }
          </section>

          <!-- Jadwal praktik per hari -->
          <section class="card">
            <h2>Jadwal Praktik</h2>
            @for (day of scheduleDays(); track day.value) {
              <div class="day-block" [class.today]="day.value === today">
                <div class="day-name">
                  {{ day.label }}
                  @if (day.value === today) { <span class="today-label">Hari ini</span> }
                </div>
                <div class="day-schedules">
                  @for (s of day.schedules; track s.id) {
                    <div class="slot">
                      <strong>{{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }}</strong>
                      <span>{{ s.polyclinic?.name ?? '-' }}</span>
                      <span class="quota">{{ s.quota === null ? 'Tanpa batas kuota' : 'Kuota ' + s.quota + ' pasien' }}</span>
                    </div>
                  }
                </div>
              </div>
            } @empty {
              <p class="muted">Belum ada jadwal praktik aktif.</p>
            }
          </section>
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

    .profile {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;

      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 1.5rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.75rem;

        &.female {
          background: #fce7f3;
          color: #be185d;
        }
      }

      h1 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        color: #1e293b;
      }

      .specialty {
        margin: 0.2rem 0 0;
        font-size: 0.9rem;
        color: #64748b;
      }
    }

    .tags {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.6rem;

      &:empty {
        display: none;
      }
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;

      &.today {
        background: #dcfce7;
        color: #15803d;
      }

      &.inactive {
        background: #fee2e2;
        color: #b91c1c;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
    }

    .contact {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;

      a mat-icon {
        margin-right: 0.25rem;
      }
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.45rem 0;
      font-size: 0.88rem;
      color: #1e293b;
      text-align: right;

      & + .row {
        border-top: 1px solid #f1f5f9;
      }

      .label {
        flex-shrink: 0;
        color: #64748b;
        font-size: 0.8rem;
        text-align: left;
      }

      .break {
        word-break: break-all;
      }
    }

    .day-block {
      display: flex;
      gap: 0.75rem;
      padding: 0.6rem 0.5rem;
      border-radius: 10px;

      & + .day-block {
        border-top: 1px solid #f1f5f9;
      }

      &.today {
        background: #fff7ed;
        border-top-color: transparent;

        .day-name {
          color: #c2410c;
        }
      }
    }

    .day-name {
      flex-shrink: 0;
      width: 64px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .today-label {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .day-schedules {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .slot {
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      color: #475569;

      strong {
        font-size: 0.9rem;
        color: #1e293b;
      }

      .quota {
        font-size: 0.72rem;
        color: #94a3b8;
      }
    }

    .muted {
      margin: 0;
      color: #94a3b8;
      font-size: 0.9rem;
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
export class DoctorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private doctorService = inject(DoctorService);

  private readonly doctorId = Number(this.route.snapshot.paramMap.get('id'));
  readonly today = isoToday();
  protected formatTime = formatTime;
  protected initials = doctorInitials;

  /**
   * Data awal dari halaman daftar (navigation state) supaya langsung tampil,
   * lalu diperbarui dari GET /doctors/{id} yang selalu berisi semua jadwal aktif
   * (daftar bisa saja hanya berisi jadwal satu hari karena filter).
   */
  doctor = signal<Doctor | null>((history.state?.doctor as Doctor | undefined) ?? null);
  errorMessage = signal<string | null>(null);

  scheduleDays = computed<DaySchedules[]>(() => {
    const schedules = this.doctor()?.schedules ?? [];
    return DAYS.map((d) => ({
      value: d.value,
      label: d.label,
      schedules: schedules.filter((s) => s.day_of_week === d.value),
    })).filter((d) => d.schedules.length > 0);
  });

  practicesToday = computed(() =>
    (this.doctor()?.schedules ?? []).some((s) => s.day_of_week === this.today),
  );

  ngOnInit() {
    this.load();
  }

  load(done?: () => void) {
    this.errorMessage.set(null);
    this.doctorService
      .get(this.doctorId)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (doctor) => this.doctor.set(doctor),
        error: (err) => {
          // Jika data awal sudah tampil, biarkan; tampilkan error hanya bila belum ada data sama sekali.
          if (!this.doctor()) this.errorMessage.set(describeHttpError(err, 'Gagal memuat detail dokter.'));
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }
}
