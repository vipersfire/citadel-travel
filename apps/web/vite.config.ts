import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwind from '@tailwindcss/vite';
export default defineConfig({
  plugins: [tailwind(), reactRouter()],
  server: {
    proxy: {
      '/api': process.env.API_BASE_URL || process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000',
      '/auth': process.env.API_BASE_URL || process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000',
    },
  },
});
