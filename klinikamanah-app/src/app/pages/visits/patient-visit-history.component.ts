import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
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
import { VisitService } from '../../core/services/visit.service';
import { PaginationMeta } from '../../core/models/patient.model';
import { Visit } from '../../core/models/visit.model';
import { describeHttpError } from '../../core/utils/http-error';
import { VisitCardComponent } from './visit-card.component';

/** Riwayat kunjungan satu pasien (rekam medis), dari yang terbaru. */
@Component({
  selector: 'app-patient-visit-history',
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
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    VisitCardComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/patients"></ion-back-button>
        </ion-buttons>
        <ion-title>Riwayat Kunjungan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding history-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="history-wrapper">
        <section class="card patient">
          <mat-icon>person</mat-icon>
          <div>
            <h2>{{ patientName() }}</h2>
            <p>
              {{ medicalRecordNumber() }}
              @if (meta(); as m) { · {{ m.total }} kunjungan }
            </p>
          </div>
        </section>

        @if (errorMessage(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="fetch(1)">Coba lagi</button>
          </section>
        } @else if (isLoading() && visits().length === 0) {
          <section class="state">
            <mat-spinner diameter="32"></mat-spinner>
          </section>
        } @else {
          @for (v of visits(); track v.id) {
            <app-visit-card [visit]="v" [showPatient]="false" (open)="openVisit($event)"></app-visit-card>
          } @empty {
            <section class="card state">
              <mat-icon>event_note</mat-icon>
              <p>Pasien belum pernah berkunjung.</p>
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
    .history-content {
      --background: #f8fafc;
    }

    .history-wrapper {
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

    .patient {
      display: flex;
      align-items: center;
      gap: 0.85rem;

      > mat-icon {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        font-size: 24px;
        line-height: 44px;
        text-align: center;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
      }

      h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
      }

      p {
        margin: 0.15rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
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
export class PatientVisitHistoryComponent implements ViewWillEnter {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitService = inject(VisitService);

  private readonly medicalRecordId = Number(this.route.snapshot.paramMap.get('medicalRecordId'));

  /** Nama & no. RM dari navigation state; jika tidak ada, diambil dari data kunjungan. */
  patientName = signal<string>((history.state?.patientName as string | undefined) ?? 'Pasien');
  medicalRecordNumber = signal<string>(
    (history.state?.medicalRecordNumber as string | undefined) ?? `Rekam medis #${this.medicalRecordId}`,
  );

  visits = signal<Visit[]>([]);
  meta = signal<PaginationMeta | null>(null);
  hasMore = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  ionViewWillEnter() {
    this.fetch(1);
  }

  onRefresh(event: RefresherCustomEvent) {
    this.fetch(1, () => event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent) {
    this.fetch((this.meta()?.current_page ?? 0) + 1, () => event.target.complete());
  }

  openVisit(visit: Visit) {
    this.router.navigate(['/main/visits', visit.id]);
  }

  fetch(page: number, done?: () => void) {
    this.isLoading.set(true);
    if (page === 1) this.errorMessage.set(null);

    this.visitService
      .history(this.medicalRecordId, page)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          this.visits.update((items) => (page === 1 ? res.data : [...items, ...res.data]));
          this.meta.set(res.meta);
          this.hasMore.set(res.meta.current_page < res.meta.last_page);

          const record = res.data[0]?.medical_record;
          if (record) {
            this.medicalRecordNumber.set(record.number);
            if (record.patient) this.patientName.set(record.patient.name);
          }
        },
        error: (err) => {
          this.hasMore.set(false);
          if (page === 1 && this.visits().length === 0) {
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat riwayat kunjungan.'));
          }
        },
      });
  }
}
