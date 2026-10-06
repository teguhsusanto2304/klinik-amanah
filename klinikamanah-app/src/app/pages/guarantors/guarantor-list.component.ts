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
import { Guarantor } from '../../core/models/visit.model';
import { describeHttpError } from '../../core/utils/http-error';
import { formatDate, todayIso } from '../visits/visit-format';

interface CategoryOption {
  value: string;
  label: string;
}

/**
 * Daftar penjamin yang aktif bekerja sama dengan klinik user hari ini (GET /api/visits/guarantors).
 * Pencarian & filter kategori dilakukan di aplikasi karena endpoint tidak menyediakan filter.
 */
@Component({
  selector: 'app-guarantor-list',
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
        <ion-title>Penjamin</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding guarantor-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="guarantor-wrapper">
        <section class="card summary">
          <mat-icon>shield</mat-icon>
          <div>
            <strong>{{ guarantors().length }} penjamin aktif</strong>
            <span>Bekerja sama dengan klinik per {{ dateLabel() }}</span>
          </div>
        </section>

        @if (guarantors().length > 0) {
          <ion-searchbar
            class="search"
            placeholder="Cari nama atau kode penjamin"
            [debounce]="200"
            (ionInput)="searchTerm.set($event.detail.value ?? '')"
          ></ion-searchbar>

          @if (categories().length > 1) {
            <div class="chips">
              <button type="button" class="chip" [class.active]="category() === null" (click)="category.set(null)">Semua</button>
              @for (c of categories(); track c.value) {
                <button type="button" class="chip" [class.active]="category() === c.value" (click)="category.set(c.value)">
                  {{ c.label }}
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
        } @else if (isLoading() && guarantors().length === 0) {
          <section class="state"><mat-spinner diameter="32"></mat-spinner></section>
        } @else {
          @for (g of filtered(); track g.id) {
            <section class="card guarantor-card">
              <div class="head">
                <span class="code">{{ g.code }}</span>
                <div class="name">
                  <h3>{{ g.name }}</h3>
                  <p>{{ g.type_label }}</p>
                </div>
                <span class="category">{{ g.category_label }}</span>
              </div>
              <div class="period">
                <mat-icon>event_available</mat-icon>
                <span>{{ periodLabel(g) }}</span>
                @if (expiresSoon(g)) {
                  <span class="soon">Segera berakhir</span>
                }
              </div>
            </section>
          } @empty {
            <section class="card state">
              <mat-icon>{{ guarantors().length ? 'search_off' : 'shield' }}</mat-icon>
              <p>
                {{ guarantors().length ? 'Tidak ada penjamin yang cocok.' : 'Belum ada penjamin yang bekerja sama dengan klinik hari ini.' }}
              </p>
            </section>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .guarantor-content {
      --background: #f8fafc;
    }

    .guarantor-wrapper {
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
      align-items: center;
      gap: 0.85rem;
      background: linear-gradient(135deg, #0891b2, #0e7490);
      color: #fff;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      div {
        display: flex;
        flex-direction: column;
      }

      span {
        font-size: 0.8rem;
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
        border-color: #0891b2;
        background: #cffafe;
        color: #0e7490;
        font-weight: 600;
      }
    }

    .guarantor-card {
      padding: 1rem;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .code {
      flex-shrink: 0;
      min-width: 52px;
      padding: 0.4rem 0.5rem;
      border-radius: 10px;
      background: #cffafe;
      color: #0e7490;
      font-size: 0.75rem;
      font-weight: 700;
      text-align: center;
    }

    .name {
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

    .category {
      flex-shrink: 0;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.68rem;
      font-weight: 600;
    }

    .period {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.75rem;
      padding-top: 0.65rem;
      border-top: 1px solid #f1f5f9;
      font-size: 0.8rem;
      color: #475569;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #94a3b8;
      }

      .soon {
        margin-left: auto;
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        background: #fef3c7;
        color: #b45309;
        font-size: 0.68rem;
        font-weight: 600;
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
export class GuarantorListComponent implements ViewWillEnter {
  private visitService = inject(VisitService);

  guarantors = signal<Guarantor[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  dateLabel = signal<string>(formatDate(todayIso()));

  searchTerm = signal<string>('');
  category = signal<string | null>(null);

  categories = computed<CategoryOption[]>(() => {
    const map = new Map<string, string>();
    for (const g of this.guarantors()) map.set(g.category, g.category_label);
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  });

  filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.category();
    return this.guarantors().filter(
      (g) =>
        (category === null || g.category === category) &&
        (!term || g.name.toLowerCase().includes(term) || g.code.toLowerCase().includes(term)),
    );
  });

  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.visitService
      .guarantors()
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          done?.();
        }),
      )
      .subscribe({
        next: (res) => {
          this.guarantors.set(res.data);
          this.dateLabel.set(formatDate(res.meta.date));
          if (this.category() !== null && !this.categories().some((c) => c.value === this.category())) {
            this.category.set(null);
          }
        },
        error: (err) => {
          if (this.guarantors().length === 0) {
            this.errorMessage.set(describeHttpError(err, 'Gagal memuat daftar penjamin.'));
          }
        },
      });
  }

  onRefresh(event: RefresherCustomEvent) {
    this.load(() => event.target.complete());
  }

  periodLabel(g: Guarantor): string {
    const start = g.cooperation_starts_at ? formatDate(g.cooperation_starts_at, 'short') : null;
    const end = g.cooperation_ends_at ? formatDate(g.cooperation_ends_at, 'short') : null;
    if (start && end) return `Kerja sama ${start} – ${end}`;
    if (end) return `Kerja sama s.d. ${end}`;
    if (start) return `Kerja sama sejak ${start}, tanpa batas akhir`;
    return 'Kerja sama tanpa batas waktu';
  }

  /** Kerja sama berakhir dalam 30 hari ke depan. */
  expiresSoon(g: Guarantor): boolean {
    if (!g.cooperation_ends_at) return false;
    const days = (new Date(`${g.cooperation_ends_at}T00:00:00`).getTime() - Date.now()) / 86_400_000;
    return days <= 30;
  }
}
