import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
  plugins: [react()],
  base: mode==='development'?'/':'/stm32-review/',
  server: { fs: { strict: true, allow: [process.cwd()], deny: ['**/references/**', '**/docs/**', '**/.npm-cache/**', '**/.env*'] } },
  build: { target: 'es2022', sourcemap: false },
}));
