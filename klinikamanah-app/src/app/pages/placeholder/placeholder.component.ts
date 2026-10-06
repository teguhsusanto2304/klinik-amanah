import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Halaman sementara untuk tab yang fiturnya belum dibuat.
 * Judul & ikon diambil dari `data` pada rute.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [MatIconModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button menu="main-menu"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ data().title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding placeholder-content">
      <div class="empty-state">
        <mat-icon>{{ data().icon }}</mat-icon>
        <h2>Belum ada {{ data().title.toLowerCase() }}</h2>
        <p>Fitur ini sedang dalam pengembangan.</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .placeholder-content {
      --background: #f8fafc;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 60vh;
      color: #64748b;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #cbd5e1;
        margin-bottom: 1rem;
      }

      h2 {
        margin: 0 0 0.25rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #334155;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
      }
    }
  `],
})
export class PlaceholderComponent {
  data = toSignal(
    inject(ActivatedRoute).data.pipe(
      map((d) => ({ title: (d['title'] as string) ?? '', icon: (d['icon'] as string) ?? 'info' })),
    ),
    { initialValue: { title: '', icon: 'info' } },
  );
}
