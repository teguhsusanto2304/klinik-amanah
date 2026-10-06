import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AlertController,
  IonButtons,
  IonContent,
  IonMenuButton,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>Profil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding profile-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (user(); as u) {
        <div class="profile-wrapper">
          <section class="card identity">
            <div class="avatar">{{ initials() }}</div>
            <h1>{{ u.name }}</h1>
            <p>{{ u.email }}</p>
          </section>

          <section class="card">
            <h2>Data Diri</h2>
            <div class="profile-item">
              <mat-icon>badge</mat-icon>
              <div>
                <span class="label">Nama</span>
                <span>{{ u.name }}</span>
              </div>
            </div>
            <div class="profile-item">
              <mat-icon>mail</mat-icon>
              <div>
                <span class="label">Email</span>
                <span>{{ u.email }}</span>
              </div>
            </div>
            <div class="profile-item">
              <mat-icon>phone</mat-icon>
              <div>
                <span class="label">Telepon</span>
                <span>{{ u.phone || '-' }}</span>
              </div>
            </div>
            <div class="profile-item">
              <mat-icon>local_hospital</mat-icon>
              <div>
                <span class="label">Klinik</span>
                <span>{{ u.clinic?.name ?? '-' }}</span>
              </div>
            </div>
          </section>

          <section class="card">
            <h2>Hak Akses</h2>
            <div class="chips">
              @for (perm of u.permissions; track perm) {
                <span class="chip">{{ perm }}</span>
              } @empty {
                <span class="muted">Tidak ada hak akses.</span>
              }
            </div>
          </section>

          <button
            mat-stroked-button
            color="warn"
            class="logout-btn"
            (click)="confirmLogout()"
            [disabled]="isLoggingOut()"
          >
            @if (isLoggingOut()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>logout</mat-icon>
            }
            @if (!isLoggingOut()) {
              <span>Keluar</span>
            }
          </button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .profile-content {
      --background: #f8fafc;
    }

    .profile-wrapper {
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

    .identity {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;

      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 700;
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.75rem;
      }

      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: #64748b;
      }
    }

    .profile-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;

      mat-icon {
        color: #94a3b8;
      }

      div {
        display: flex;
        flex-direction: column;
        font-size: 0.95rem;
        color: #1e293b;
      }
    }

    .label {
      color: #64748b;
      font-size: 0.8rem;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .chip {
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
      font-size: 0.78rem;
    }

    .muted {
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .logout-btn {
      height: 48px;
      border-radius: 12px;
      font-weight: 600;
      margin-bottom: 1rem;
    }
  `],
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);

  user = this.auth.user;
  isLoggingOut = signal<boolean>(false);

  initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  });

  onRefresh(event: RefresherCustomEvent) {
    this.auth
      .me()
      .pipe(finalize(() => event.target.complete()))
      .subscribe({ error: () => {} });
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
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }),
      )
      .subscribe({ error: () => {} });
  }
}
