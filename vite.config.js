import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona no GitHub Pages (subpasta) e em qualquer outro host estático
export default defineConfig({
  plugins: [react()],
  base: './',
  test: { include: ['src/**/*.test.js'] },
});
