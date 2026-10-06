import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'klinikamanah-app',
  webDir: 'dist/klinikamanah-app/browser', // <--- Sesuaikan dengan path output ng build
  plugins: {
    // Request HTTP lewat native layer: menghindari CORS & blokir mixed-content (API masih http://)
    CapacitorHttp: { enabled: true },
  },
};

export default config;