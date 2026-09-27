import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: './', // relativo: imprescindible para Capacitor (file:// en la APK)
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En desarrollo el proxy Vite reenvía /api al backend local,
      // que a su vez consulta al MITECO (evita el bloqueo CORS del navegador).
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
