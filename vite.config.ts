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
    // Configuración para producción optimizada
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remover console.logs en producción
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'] // Remover funciones específicas
      }
    },
    rollupOptions: {
      output: {
        // Code splitting manual para optimizar chunks
        manualChunks: (id) => {
          // Chunk para Three.js y globe.gl (muy pesado - ~750KB)
          if (id.includes('three') || id.includes('globe.gl')) {
            return 'three-globe';
          }
          
          // Chunk para D3 (pesado - ~250KB)
          if (id.includes('d3-')) {
            return 'd3';
          }
          
          // Chunk para Turf.js (geoespacial)
          if (id.includes('@turf')) {
            return 'turf';
          }
          
          // Chunk para topojson
          if (id.includes('topojson')) {
            return 'topojson';
          }
          
          // Chunk para Prisma client (solo en server)
          if (id.includes('@prisma/client')) {
            return 'prisma';
          }
          
          // Chunk para modals grandes (lazy loading)
          if (id.includes('CreatePollModal.svelte')) {
            return 'modal-create-poll';
          }
          if (id.includes('UserProfileModal.svelte')) {
            return 'modal-user-profile';
          }
          if (id.includes('SearchModal.svelte')) {
            return 'modal-search';
          }
          if (id.includes('NotificationsModal.svelte')) {
            return 'modal-notifications';
          }
          
          // Chunk para componentes del globo
          if (id.includes('GlobeGL.svelte')) {
            return 'globe-main';
          }
          if (id.includes('GlobeCanvas.svelte')) {
            return 'globe-canvas';
          }
          if (id.includes('BottomSheet.svelte')) {
            return 'bottom-sheet';
          }
          
          // Chunk para lucide-svelte (íconos)
          if (id.includes('lucide-svelte')) {
            return 'icons';
          }
          
          // Resto de node_modules en vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Configuración de nombres de archivos para mejor caching
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Aumentar límite de advertencia de chunk size
    chunkSizeWarningLimit: 1000,
    // Source maps solo en desarrollo
    sourcemap: process.env.NODE_ENV === 'development'
  },
  // Optimizaciones de dependencias
  optimizeDeps: {
    include: [
      'three',
      'globe.gl',
      'd3',
      '@turf/boolean-point-in-polygon',
      '@turf/helpers',
      'topojson-client'
    ],
    exclude: ['@prisma/client'] // Excluir de pre-bundling
  }
});
