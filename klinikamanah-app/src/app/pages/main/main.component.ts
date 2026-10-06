import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import {
  AlertController,
  IonContent,
  IonFooter,
  IonLabel,
  IonMenu,
  IonTabBar,
  IonTabButton,
  IonTabs,
  MenuController,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { APP_MENUS, AppMenu } from '../../core/menu/app-menu';

interface TabItem {
  tab: string;
  label: string;
  icon: string;
}

/** Layar utama setelah login: drawer menu + wadah tab dengan bottom navigation. */
@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    MatIconModule,
    IonMenu,
    IonContent,
    IonFooter,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonLabel,
  ],
  template: `
    <ion-menu menuId="main-menu" contentId="main-content" type="overlay">
      <ion-content class="drawer-content">
        <div class="drawer-header">
          <div class="avatar">{{ initials() }}</div>
          <div class="identity">
            <h2>{{ user()?.name }}</h2>
            <p>{{ user()?.email }}</p>
            <p class="clinic">
              <mat-icon>local_hospital</mat-icon>
              {{ user()?.clinic?.name ?? 'Belum terhubung ke klinik' }}
            </p>
          </div>
        </div>

        <nav class="drawer-nav">
          <button
            type="button"
            class="drawer-item"
            [class.active]="isActive('/main/home')"
            (click)="navigate('/main/home')"
          >
            <span class="drawer-icon" style="background: #4f46e51a; color: #4f46e5">
              <mat-icon>home</mat-icon>
            </span>
            <span class="drawer-label">Beranda</span>
          </button>

          <p class="section-title">Menu</p>
          @for (menu of menus; track menu.label) {
            <button
              type="button"
              class="drawer-item"
              [class.active]="!!menu.route && isActive(menu.route)"
              (click)="openMenu(menu)"
            >
              <span class="drawer-icon" [style.background]="menu.color + '1a'" [style.color]="menu.color">
                <mat-icon>{{ menu.icon }}</mat-icon>
              </span>
              <span class="drawer-label">{{ menu.label }}</span>
              @if (!menu.route) {
                <span class="soon">Segera</span>
              }
            </button>
          }
        </nav>
      </ion-content>

      <ion-footer class="ion-no-border drawer-footer">
        <button type="button" class="drawer-item logout" [disabled]="isLoggingOut()" (click)="confirmLogout()">
          <span class="drawer-icon">
            <mat-icon>logout</mat-icon>
          </span>
          <span class="drawer-label">{{ isLoggingOut() ? 'Keluar...' : 'Keluar' }}</span>
        </button>
      </ion-footer>
    </ion-menu>

    <ion-tabs id="main-content">
      <ion-tab-bar slot="bottom" id="main-tab-bar">
        @for (item of tabs; track item.tab) {
          <ion-tab-button [tab]="item.tab">
            <span class="tab-icon">
              <mat-icon>{{ item.icon }}</mat-icon>
            </span>
            <ion-label>{{ item.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-menu {
      --width: 300px;
    }

    .drawer-content {
      --background: #fff;
    }

    .drawer-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: calc(1.5rem + var(--ion-safe-area-top, 0px)) 1.25rem 1.25rem;
      background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast);

      .avatar {
        flex-shrink: 0;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        font-weight: 700;
        font-size: 1.15rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .identity {
        min-width: 0;
      }

      h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      p {
        margin: 0.15rem 0 0;
        font-size: 0.8rem;
        opacity: 0.85;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .clinic {
        display: flex;
        align-items: center;
        gap: 0.25rem;

        mat-icon {
          flex-shrink: 0;
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    .drawer-nav {
      padding: 0.75rem 0.75rem 1rem;
    }

    .section-title {
      margin: 1rem 0.5rem 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
    }

    .drawer-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
      padding: 0.5rem;
      border: none;
      border-radius: 12px;
      background: none;
      cursor: pointer;
      font: inherit;
      text-align: left;
      color: #1e293b;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 0.15s;

      &:active {
        background: #f1f5f9;
      }

      &.active {
        background: #e0e7ff;

        .drawer-label {
          font-weight: 600;
          color: #3730a3;
        }
      }

      &:disabled {
        opacity: 0.6;
      }
    }

    .drawer-icon {
      flex-shrink: 0;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .drawer-label {
      flex: 1;
      font-size: 0.92rem;
    }

    .soon {
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: #f1f5f9;
      color: #94a3b8;
      font-size: 0.68rem;
      font-weight: 600;
    }

    .drawer-footer {
      padding: 0.5rem 0.75rem calc(0.75rem + var(--ion-safe-area-bottom, 0px));
      border-top: 1px solid #f1f5f9;
      background: #fff;

      .logout {
        color: #dc2626;

        .drawer-icon {
          background: #fee2e2;
        }
      }
    }

    ion-tab-bar {
      --background: #fff;
      --border: 1px solid #e2e8f0;
      height: 64px;
    }

    ion-tab-button {
      --color: #94a3b8;
      --color-selected: var(--ion-color-primary);

      /* Pil indikator dengan ukuran tetap; ikon di-center di dalamnya.
         (padding langsung di mat-icon bergeser karena box-sizing: border-box.) */
      .tab-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 28px;
        margin: 0 auto 2px;
        border-radius: 999px;
        transition: background-color 0.2s;
      }

      mat-icon {
        display: block;
        margin: 0;
      }

      ion-label {
        font-size: 0.72rem;
        font-weight: 500;
      }

      &.tab-selected .tab-icon {
        background: #e0e7ff;
      }

      &.tab-selected ion-label {
        font-weight: 600;
      }
    }
  `],
})
export class MainComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private menuCtrl = inject(MenuController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  readonly tabs: TabItem[] = [
    { tab: 'home', label: 'Beranda', icon: 'home' },
    { tab: 'history', label: 'Riwayat', icon: 'history' },
    { tab: 'notifications', label: 'Notifikasi', icon: 'notifications' },
    { tab: 'profile', label: 'Profil', icon: 'person' },
  ];

  readonly menus = APP_MENUS;

  user = this.auth.user;
  isLoggingOut = signal<boolean>(false);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  });

  isActive(route: string): boolean {
    return this.currentUrl().startsWith(route);
  }

  async navigate(route: string) {
    await this.menuCtrl.close('main-menu');
    this.router.navigateByUrl(route);
  }

  async openMenu(menu: AppMenu) {
    if (menu.route) {
      await this.navigate(menu.route);
      return;
    }
    const toast = await this.toastCtrl.create({
      message: `Fitur ${menu.label} segera hadir.`,
      duration: 1500,
      position: 'bottom',
    });
    await toast.present();
  }

  async confirmLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Keluar',
      message: 'Yakin ingin keluar dari aplikasi?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Keluar', role: 'destructive', handler: () => this.logout() },
      ],
    });
    await alert.present();
  }

  private logout() {
    this.isLoggingOut.set(true);
    this.auth
      .logout()
      .pipe(
        finalize(() => {
          this.isLoggingOut.set(false);
          this.menuCtrl.close('main-menu');
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }),
      )
      .subscribe({ error: () => {} });
  }
}
