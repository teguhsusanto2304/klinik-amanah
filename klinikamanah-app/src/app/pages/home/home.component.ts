import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  IonContent,
  IonButtons,
  IonHeader,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { APP_MENUS, AppMenu } from '../../core/menu/app-menu';
import { HomeSummaryComponent } from './home-summary.component';

type SyncStatus = 'syncing' | 'online' | 'offline';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
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
    HomeSummaryComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Beranda</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding home-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (user(); as u) {
        <div class="home-wrapper">
          <!-- Kartu sapaan -->
          <section class="card greeting-card">
            <div class="avatar">{{ initials() }}</div>
            <div class="greeting-text">
              <p class="hello">{{ greeting() }},</p>
              <h1>{{ u.name }}</h1>
              <p class="clinic">
                <mat-icon>local_hospital</mat-icon>
                {{ u.clinic?.name ?? 'Belum terhubung ke klinik' }}
              </p>
            </div>
          </section>

          <!-- Ringkasan hari ini -->
          <app-home-summary></app-home-summary>

          <!-- Menu cepat -->
          <section class="card">
            <h2>Menu</h2>
            <div class="menu-grid">
              @for (menu of menus; track menu.label) {
                <button type="button" class="menu-item" (click)="openMenu(menu)">
                  <span class="menu-icon" [style.background]="menu.color + '1a'" [style.color]="menu.color">
                    <mat-icon>{{ menu.icon }}</mat-icon>
                  </span>
                  <span class="menu-label">{{ menu.label }}</span>
                </button>
              }
            </div>
          </section>

          <!-- Status -->
          <section class="card">
            <h2>Status</h2>
            <div class="status-row">
              <span class="label">Sesi</span>
              <span class="status-badge" [class]="syncStatus()">
                @switch (syncStatus()) {
                  @case ('syncing') { <mat-spinner diameter="12"></mat-spinner> Memeriksa... }
                  @case ('online') { <span class="dot"></span> Aktif }
                  @case ('offline') { <span class="dot"></span> Offline (data tersimpan) }
                }
              </span>
            </div>
            <div class="status-row">
              <span class="label">Peran</span>
              <span class="chips">
                @for (role of u.roles; track role) {
                  <span class="chip role">{{ role }}</span>
                } @empty {
                  <span class="muted">-</span>
                }
              </span>
            </div>
            <div class="status-row">
              <span class="label">Login terakhir</span>
              <span>{{ lastLogin() }}</span>
            </div>
          </section>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .home-content {
      --background: #f8fafc;
    }

    .home-wrapper {
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
        margin: 0 0 0.75rem 0;
      }
    }

    .greeting-card {
      display: flex;
      align-items: center;
      gap: 1rem;

      .avatar {
        flex-shrink: 0;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 700;
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hello {
        margin: 0;
        font-size: 0.85rem;
        color: #64748b;
      }

      h1 {
        margin: 0.1rem 0;
        font-size: 1.35rem;
        font-weight: 700;
        color: #1e293b;
      }

      .clinic {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.85rem;
        color: #475569;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem 0.5rem;
    }

    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0;
      border: none;
      background: none;
      cursor: pointer;
      font: inherit;
      -webkit-tap-highlight-color: transparent;

      &:active .menu-icon {
        transform: scale(0.94);
      }
    }

    .menu-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s;
    }

    .menu-label {
      font-size: 0.75rem;
      color: #334155;
      text-align: center;
      line-height: 1.2;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 0;
      font-size: 0.9rem;
      color: #1e293b;

      & + .status-row {
        border-top: 1px solid #f1f5f9;
      }
    }

    .label {
      color: #64748b;
      font-size: 0.8rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
      }

      &.online {
        background: #dcfce7;
        color: #15803d;
      }

      &.offline {
        background: #fef3c7;
        color: #b45309;
      }

      &.syncing {
        background: #f1f5f9;
        color: #475569;
      }
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      justify-content: flex-end;
    }

    .chip {
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
      font-size: 0.78rem;

      &.role {
        background: #e0e7ff;
        color: #3730a3;
        text-transform: capitalize;
      }
    }

    .muted {
      color: #94a3b8;
      font-size: 0.85rem;
    }
  `],
})
export class HomeComponent implements OnInit, ViewWillEnter {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  private summary = viewChild(HomeSummaryComponent);
  /** Ringkasan sudah dimuat oleh komponennya sendiri saat pertama tampil. */
  private hasEntered = false;

  user = this.auth.user;
  syncStatus = signal<SyncStatus>('syncing');

  readonly menus = APP_MENUS;

  initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  });

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  });

  lastLogin = computed(() => {
    const value = this.user()?.last_login_at;
    if (!value) return '-';
    return new Date(value).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  ngOnInit() {
    this.loadProfile();
  }

  /** Perbarui ringkasan setiap kembali ke beranda (data bisa berubah dari layar lain). */
  ionViewWillEnter() {
    if (this.hasEntered) this.summary()?.reload().subscribe({ error: () => {} });
    this.hasEntered = true;
  }

  onRefresh(event: RefresherCustomEvent) {
    // Selesaikan animasi refresh setelah profil & ringkasan sama-sama selesai dimuat.
    let pending = 2;
    const done = () => --pending === 0 && event.target.complete();
    this.loadProfile(done);
    const summary = this.summary();
    if (summary) summary.reload().subscribe({ complete: done, error: done });
    else done();
  }

  async openMenu(menu: AppMenu) {
    if (menu.route) {
      this.router.navigateByUrl(menu.route);
      return;
    }
    const toast = await this.toastCtrl.create({
      message: `Fitur ${menu.label} segera hadir.`,
      duration: 1500,
      position: 'bottom',
      positionAnchor: 'main-tab-bar',
    });
    await toast.present();
  }

  private loadProfile(done?: () => void) {
    this.syncStatus.set('syncing');
    this.auth
      .me()
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: () => this.syncStatus.set('online'),
        // 401 sudah ditangani interceptor (hapus sesi + ke /login);
        // error lain (mis. jaringan) tetap tampilkan data cache.
        error: (err: HttpErrorResponse) => {
          if (err.status !== 401) this.syncStatus.set('offline');
        },
      });
  }
}
