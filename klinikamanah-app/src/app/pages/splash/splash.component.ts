import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content color="primary" class="ion-padding">
      <div class="splash-container">
        <div class="logo-wrapper">
          <h1 class="app-title">Klinik Amanah</h1>
          <p class="app-subtitle">Sistem Informasi Manajemen Klinik</p>
        </div>
        <div class="loader-wrapper">
          <ion-spinner name="crescent" color="light"></ion-spinner>
          <p class="loading-text">Memuat aplikasi...</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .splash-container {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      height: 100%;
      padding: 3rem 1rem;
      text-align: center;
    }
    .logo-wrapper { margin: auto 0; }
    .app-title { font-size: 1.8rem; font-weight: 700; color: #fff; margin: 0; }
    .app-subtitle { font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem; }
    .loader-wrapper { margin-bottom: 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
    .loading-text { color: rgba(255,255,255,0.7); font-size: 0.85rem; }
  `]
})
export class SplashComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);

  ngOnInit() {
    timer(5000).subscribe(() => {
      const target = this.auth.isLoggedIn() ? '/main' : '/login';
      this.router.navigateByUrl(target, { replaceUrl: true });
    });
  }
}