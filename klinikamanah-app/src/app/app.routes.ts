import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.component').then((m) => m.SplashComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'main',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/main/main.component').then((m) => m.MainComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./pages/patients/patient-search.component').then((m) => m.PatientSearchComponent),
      },
      {
        path: 'patients/:medicalRecordId/visits',
        loadComponent: () =>
          import('./pages/visits/patient-visit-history.component').then((m) => m.PatientVisitHistoryComponent),
      },
      {
        path: 'visits',
        loadComponent: () =>
          import('./pages/visits/visit-list.component').then((m) => m.VisitListComponent),
      },
      {
        path: 'visits/register/:medicalRecordId',
        loadComponent: () =>
          import('./pages/visits/visit-register.component').then((m) => m.VisitRegisterComponent),
      },
      {
        path: 'visits/:id',
        loadComponent: () =>
          import('./pages/visits/visit-detail.component').then((m) => m.VisitDetailComponent),
      },
      {
        path: 'schedules',
        loadComponent: () =>
          import('./pages/schedules/schedule-list.component').then((m) => m.ScheduleListComponent),
      },
      {
        path: 'doctors',
        loadComponent: () =>
          import('./pages/doctors/doctor-list.component').then((m) => m.DoctorListComponent),
      },
      {
        path: 'doctors/:id',
        loadComponent: () =>
          import('./pages/doctors/doctor-detail.component').then((m) => m.DoctorDetailComponent),
      },
      {
        path: 'bills',
        loadComponent: () => import('./pages/bills/bill-list.component').then((m) => m.BillListComponent),
      },
      {
        path: 'bills/visit/:visitId',
        loadComponent: () => import('./pages/bills/bill-edit.component').then((m) => m.BillEditComponent),
      },
      {
        path: 'bills/:id',
        loadComponent: () => import('./pages/bills/bill-detail.component').then((m) => m.BillDetailComponent),
      },
      {
        path: 'bills/:id/edit',
        loadComponent: () => import('./pages/bills/bill-edit.component').then((m) => m.BillEditComponent),
      },
      {
        path: 'bills/:id/pay',
        loadComponent: () => import('./pages/bills/bill-pay.component').then((m) => m.BillPayComponent),
      },
      {
        path: 'payments/:id',
        loadComponent: () =>
          import('./pages/bills/payment-detail.component').then((m) => m.PaymentDetailComponent),
      },
      {
        path: 'guarantors',
        loadComponent: () =>
          import('./pages/guarantors/guarantor-list.component').then((m) => m.GuarantorListComponent),
      },
      {
        path: 'cash-sessions',
        loadComponent: () =>
          import('./pages/cash/cash-session-list.component').then((m) => m.CashSessionListComponent),
      },
      {
        path: 'cash-sessions/open',
        loadComponent: () =>
          import('./pages/cash/cash-session-open.component').then((m) => m.CashSessionOpenComponent),
      },
      {
        path: 'cash-sessions/:id',
        loadComponent: () =>
          import('./pages/cash/cash-session-detail.component').then((m) => m.CashSessionDetailComponent),
      },
      {
        path: 'cash-transactions',
        loadComponent: () =>
          import('./pages/cash/cash-transaction-list.component').then((m) => m.CashTransactionListComponent),
      },
      {
        path: 'cash-transactions/new',
        loadComponent: () =>
          import('./pages/cash/cash-transaction-form.component').then((m) => m.CashTransactionFormComponent),
      },
      {
        path: 'cash-transactions/:id',
        loadComponent: () =>
          import('./pages/cash/cash-transaction-detail.component').then((m) => m.CashTransactionDetailComponent),
      },
      {
        path: 'history',
        data: { title: 'Riwayat', icon: 'history' },
        loadComponent: () =>
          import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
      },
      {
        path: 'notifications',
        data: { title: 'Notifikasi', icon: 'notifications_none' },
        loadComponent: () =>
          import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'dashboard',
    redirectTo: 'main',
  },
  {
    path: '**',
    redirectTo: 'splash',
  },
];
