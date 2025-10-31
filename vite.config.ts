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
      'globe.gl',
      'three-globe',
      'd3',
      'topojson-client'
    ],
    exclude: [],
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
    minify: 'terser',
    terserOptions: {
      compress: {
        // Preservar nombres de clases y constructores
        keep_classnames: true,
        keep_fnames: true
      },
      mangle: {
        // No modificar nombres de clases
        keep_classnames: true,
        keep_fnames: true
      }
    },
    commonjsOptions: {
      include: [/three/, /globe\.gl/, /three-globe/, /d3/, /node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separar three.js y globe.gl en chunks específicos
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
