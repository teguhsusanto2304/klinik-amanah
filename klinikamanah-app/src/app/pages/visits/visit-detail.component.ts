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
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { VisitService } from '../../core/services/visit.service';
import { Visit } from '../../core/models/visit.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate, formatTime } from './visit-format';

@Component({
  selector: 'app-visit-detail',
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
          <ion-back-button defaultHref="/main/visits"></ion-back-button>
        </ion-buttons>
        <ion-title>Detail Kunjungan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding detail-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="detail-wrapper">
        @if (visit(); as v) {
          <!-- Nomor antrean -->
          <section class="card queue-card" [class.cancelled]="v.status === 'cancelled'">
            <span class="queue-label">Nomor Antrean</span>
            <span class="queue-number">{{ v.formatted_queue_number }}</span>
            <span class="status" [class]="v.status">{{ v.status_label }}</span>
            <span class="queue-date">{{ formatDate(v.visit_date) }}</span>
          </section>

          <!-- Pasien -->
          <section class="card">
            <h2>Pasien</h2>
            <div class="row"><span class="label">Nama</span><span>{{ v.medical_record.patient?.name ?? '-' }}</span></div>
            <div class="row"><span class="label">No. RM</span><span>{{ v.medical_record.number }}</span></div>
            @if (v.medical_record.patient; as p) {
              <div class="row">
                <span class="label">Umur / JK</span>
                <span>{{ p.age !== null ? p.age + ' tahun' : '-' }} · {{ p.gender_label ?? '-' }}</span>
              </div>
              <div class="row"><span class="label">NIK</span><span>{{ p.nik || '-' }}</span></div>
              <div class="row"><span class="label">Telepon</span><span>{{ p.phone || '-' }}</span></div>
            }
          </section>

          <!-- Dokter -->
          <section class="card">
            <h2>Dokter &amp; Jadwal</h2>
            <div class="row"><span class="label">Dokter</span><span>{{ v.doctor.name }}</span></div>
            <div class="row"><span class="label">Spesialis</span><span>{{ v.doctor.specialty?.name ?? 'Umum' }}</span></div>
            <div class="row"><span class="label">Poliklinik</span><span>{{ v.polyclinic?.name ?? '-' }}</span></div>
            @if (v.schedule; as s) {
              <div class="row">
                <span class="label">Jadwal</span>
                <span>{{ s.day_label }}, {{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }}</span>
              </div>
            }
            @if (v.clinic) {
              <div class="row"><span class="label">Klinik</span><span>{{ v.clinic.name }}</span></div>
            }
          </section>

          <!-- Penjamin & rujukan -->
          <section class="card">
            <h2>Penjamin &amp; Rujukan</h2>
            <div class="row"><span class="label">Jenis penjamin</span><span>{{ v.payment_type_label }}</span></div>
            @if (v.guarantor) {
              <div class="row"><span class="label">Penjamin</span><span>{{ v.guarantor.name }}</span></div>
              <div class="row"><span class="label">No. kartu</span><span>{{ v.guarantor_member_number || '-' }}</span></div>
            }
            <div class="row"><span class="label">Rujukan</span><span>{{ v.referral.type_label }}</span></div>
            @if (v.referral.type !== 'none') {
              @if (v.referral.facility) {
                <div class="row"><span class="label">Faskes perujuk</span><span>{{ v.referral.facility }}</span></div>
              }
              <div class="row"><span class="label">No. rujukan</span><span>{{ v.referral.number || '-' }}</span></div>
              <div class="row"><span class="label">Tgl. rujukan</span><span>{{ formatDate(v.referral.date, 'short') }}</span></div>
              <div class="row">
                <span class="label">Dokumen</span>
                <span>{{ v.referral.has_document ? 'Dibawa' : 'Tidak dibawa' }}</span>
              </div>
            }
          </section>

          <!-- Keluhan -->
          <section class="card">
            <h2>Keluhan</h2>
            <p class="complaint">{{ v.complaint || 'Tidak ada keluhan yang dicatat.' }}</p>
          </section>

          <div class="actions">
            <button mat-stroked-button type="button" (click)="openHistory(v)">
              <mat-icon>history</mat-icon>
              Riwayat Pasien
            </button>
            @if (canCancel(v)) {
              <button mat-flat-button type="button" class="cancel-btn" [disabled]="isCancelling()" (click)="confirmCancel(v)">
                @if (isCancelling()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>event_busy</mat-icon>
                }
                Batalkan
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

    .queue-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      background: linear-gradient(135deg, var(--ion-color-primary), #4338ca);
      color: #fff;

      .queue-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.85;
      }

      .queue-number {
        font-size: 3rem;
        font-weight: 800;
        line-height: 1.1;
      }

      .queue-date {
        font-size: 0.85rem;
        opacity: 0.85;
      }

      .status {
        padding: 0.15rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.2);

        &.cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }
      }

      &.cancelled {
        background: #94a3b8;

        .queue-number {
          text-decoration: line-through;
        }
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
    }

    .complaint {
      margin: 0;
      font-size: 0.9rem;
      color: #334155;
      white-space: pre-line;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;

      button {
        flex: 1;
        height: 44px;
      }

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }
    }

    .cancel-btn {
      --mdc-filled-button-container-color: #dc2626;
      --mdc-filled-button-label-text-color: #fff;
      --mat-button-filled-container-color: #dc2626;
      --mat-button-filled-label-text-color: #fff;
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
export class VisitDetailComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitService = inject(VisitService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private readonly visitId = Number(this.route.snapshot.paramMap.get('id'));

  visit = signal<Visit | null>(null);
  errorMessage = signal<string | null>(null);
  isCancelling = signal<boolean>(false);

  protected formatDate = formatDate;
  protected formatTime = formatTime;

  ngOnInit() {
    this.load();
  }

  load(done?: () => void) {
    this.errorMessage.set(null);
    this.visitService
      .get(this.visitId)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (visit) => this.visit.set(visit),
        error: (err) => {
          // Saat pull-to-refresh gagal, data lama tetap ditampilkan.
          if (!this.visit()) this.errorMessage.set(describeHttpError(err, 'Gagal memuat detail kunjungan.'));
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  /** Sama dengan policy server: butuh izin visits.cancel dan kunjungan belum batal. */
  canCancel(visit: Visit): boolean {
    return visit.status !== 'cancelled' && this.auth.can('visits.cancel');
  }

  openHistory(visit: Visit) {
    this.router.navigate(['/main/patients', visit.medical_record.id, 'visits'], {
      state: { patientName: visit.medical_record.patient?.name, medicalRecordNumber: visit.medical_record.number },
    });
  }

  async confirmCancel(visit: Visit) {
    const alert = await this.alertCtrl.create({
      header: 'Batalkan Kunjungan',
      message: `Batalkan kunjungan ${visit.medical_record.patient?.name ?? ''} dengan nomor antrean ${visit.formatted_queue_number}? Slot kuota akan dibuka kembali.`,
      buttons: [
        { text: 'Tidak', role: 'cancel' },
        { text: 'Batalkan', role: 'destructive', handler: () => this.cancel(visit) },
      ],
    });
    await alert.present();
  }

  private cancel(visit: Visit) {
    this.isCancelling.set(true);
    this.visitService
      .cancel(visit.id)
      .pipe(finalize(() => this.isCancelling.set(false)))
      .subscribe({
        next: (res) => {
          this.visit.set(res.data);
          this.showToast(res.message, 'success');
        },
        error: (err) => this.showToast(describeHttpError(err, 'Gagal membatalkan kunjungan.'), 'danger'),
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
