import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwind from '@tailwindcss/vite';

// Vite config for SvelteKit app
export default defineConfig({
  plugins: [
    tailwind(),
    sveltekit(),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
