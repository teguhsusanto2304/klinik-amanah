import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Visit } from '../../core/models/visit.model';
import { formatDate, formatTime } from './visit-format';

/** Ringkasan satu kunjungan dalam daftar; ketuk untuk membuka detail. */
@Component({
  selector: 'app-visit-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @let v = visit();
    <button type="button" class="visit-card" [class.cancelled]="v.status === 'cancelled'" (click)="open.emit(v)">
      <div class="queue">
        <span class="queue-label">Antrean</span>
        <span class="queue-number">{{ v.formatted_queue_number }}</span>
      </div>

      <div class="body">
        @if (showPatient()) {
          <h3>{{ v.medical_record.patient?.name ?? '-' }}</h3>
          <span class="rm">{{ v.medical_record.number }}</span>
        } @else {
          <h3>{{ formatDate(v.visit_date) }}</h3>
        }

        <div class="info">
          <mat-icon>medical_services</mat-icon>
          <span>{{ v.doctor.name }}</span>
        </div>
        <div class="info">
          <mat-icon>meeting_room</mat-icon>
          <span>
            {{ v.polyclinic?.name ?? '-' }}
            @if (v.schedule) { · {{ formatTime(v.schedule.start_time) }}–{{ formatTime(v.schedule.end_time) }} }
          </span>
        </div>
        <div class="tags">
          <span class="tag" [class]="v.status">{{ v.status_label }}</span>
          <span class="tag payment">{{ v.guarantor?.name ?? v.payment_type_label }}</span>
        </div>
      </div>

      <mat-icon class="chevron">chevron_right</mat-icon>
    </button>
  `,
  styles: [`
    .visit-card {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      width: 100%;
      padding: 1rem;
      border: none;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
      cursor: pointer;
      font: inherit;
      text-align: left;
      -webkit-tap-highlight-color: transparent;

      &:active {
        background: #f8fafc;
      }

      &.cancelled {
        opacity: 0.65;

        .queue {
          background: #f1f5f9;
          color: #94a3b8;
        }
      }
    }

    .queue {
      flex-shrink: 0;
      width: 64px;
      padding: 0.5rem 0;
      border-radius: 12px;
      background: #e0e7ff;
      color: #3730a3;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .queue-label {
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .queue-number {
      font-size: 1.2rem;
      font-weight: 700;
    }

    .body {
      flex: 1;
      min-width: 0;

      h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #1e293b;
      }
    }

    .rm {
      display: inline-block;
      margin: 0.15rem 0 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6d28d9;
    }

    .info {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.2rem;
      font-size: 0.8rem;
      color: #475569;

      mat-icon {
        flex-shrink: 0;
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #94a3b8;
      }

      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.5rem;
    }

    .tag {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;

      &.registered {
        background: #dcfce7;
        color: #15803d;
      }

      &.cancelled {
        background: #fee2e2;
        color: #b91c1c;
      }

      &.payment {
        background: #f1f5f9;
        color: #475569;
      }
    }

    .chevron {
      flex-shrink: 0;
      color: #cbd5e1;
    }
  `],
})
export class VisitCardComponent {
  visit = input.required<Visit>();
  /** false = tampilkan tanggal kunjungan alih-alih nama pasien (untuk riwayat pasien). */
  showPatient = input<boolean>(true);
  open = output<Visit>();

  protected formatDate = formatDate;
  protected formatTime = formatTime;
}
