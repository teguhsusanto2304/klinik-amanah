export interface AppMenu {
  label: string;
  icon: string;
  color: string;
  /** Rute tujuan; kosong = fitur belum tersedia. */
  route?: string;
}

/** Daftar menu aplikasi, dipakai bersama oleh grid menu di beranda dan drawer. */
export const APP_MENUS: AppMenu[] = [
  { label: 'Pasien', icon: 'groups', color: '#2563eb', route: '/main/patients' },
  { label: 'Antrian', icon: 'format_list_numbered', color: '#16a34a', route: '/main/visits' },
  { label: 'Jadwal', icon: 'event', color: '#ea580c', route: '/main/schedules' },
  { label: 'Dokter', icon: 'medical_services', color: '#9333ea', route: '/main/doctors' },
  { label: 'Penjamin', icon: 'shield', color: '#0891b2', route: '/main/guarantors' },
  { label: 'Pembayaran', icon: 'payments', color: '#ca8a04', route: '/main/bills' },
  { label: 'Riwayat', icon: 'history', color: '#475569', route: '/main/history' },
  { label: 'Profil', icon: 'person', color: '#db2777', route: '/main/profile' },
];
