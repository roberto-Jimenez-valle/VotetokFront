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
  optimizeDeps: {
    include: [
      'three',
      'd3',
      'topojson-client'
    ],
    exclude: ['globe.gl', 'three-globe'], // Excluir porque se carga desde CDN
    esbuildOptions: {
      // Evitar minificación agresiva que puede romper constructores
      keepNames: true
    }
  },
  ssr: {
    noExternal: ['three', 'globe.gl', 'three-globe']
  },
  build: {
    target: 'es2020',
    // Activar minificación para producción
    minify: 'esbuild',
    commonjsOptions: {
      include: [/three/, /globe\.gl/, /three-globe/, /d3/, /node_modules/],
      transformMixedEsModules: true
    },
    // Eliminar console.logs en producción
    esbuildOptions: {
      drop: ['console', 'debugger'],
      keepNames: true
    },
    rollupOptions: {
      output: {
        // Preservar nombres en el output
        preserveModules: false,
        // Aumentar el límite de tamaño de chunk
        chunkFileNames: 'assets/[name]-[hash].js',
        // CRÍTICO: Preservar nombres de funciones y clases
        compact: false,
        minifyInternalExports: false,
        manualChunks: (id) => {
          // Separar three.js y globe.gl en chunks específicos SIN minificar
          if (id.includes('node_modules/three') && !id.includes('three-globe')) {
            return 'three';
          }
          if (id.includes('node_modules/globe.gl') || id.includes('node_modules/three-globe')) {
            return 'globe';
          }
          if (id.includes('node_modules/d3')) {
            return 'd3';
          }
        }
      }
    }
  }
});
