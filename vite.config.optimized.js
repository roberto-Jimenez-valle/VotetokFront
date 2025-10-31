import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

// Función para determinar chunks manuales
function manualChunks(id) {
  // Vendor chunks principales
  if (id.includes('node_modules')) {
    // 3D y visualización
    if (id.includes('globe.gl') || id.includes('three') || id.includes('d3')) {
      return 'vendor-3d';
    }
    
    // Geografía y mapas
    if (id.includes('topojson') || id.includes('@turf') || id.includes('pmtiles')) {
      return 'vendor-geo';
    }
    
    // UI y componentes
    if (id.includes('lucide-svelte') || id.includes('swagger-ui')) {
      return 'vendor-ui';
    }
    
    // Utilidades
    if (id.includes('supercluster') || id.includes('jose') || id.includes('yaml')) {
      return 'vendor-utils';
    }
    
    // Prisma client
    if (id.includes('@prisma/client')) {
      return 'vendor-prisma';
    }
    
    // Otros vendors
    return 'vendor';
  }
  
  // App chunks
  if (id.includes('src/lib/services')) {
    return 'services';
  }
  
  if (id.includes('src/lib/stores')) {
    return 'stores';
  }
  
  if (id.includes('src/lib/globe')) {
    return 'globe-components';
  }
  
  if (id.includes('src/lib') && id.includes('Modal')) {
    return 'modals';
  }
  
  if (id.includes('src/routes/api')) {
    return 'api-routes';
  }
}

export default defineConfig({
  plugins: [sveltekit()],
  
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
      '$components': path.resolve('./src/lib/components'),
      '$stores': path.resolve('./src/lib/stores'),
      '$services': path.resolve('./src/lib/services'),
      '$utils': path.resolve('./src/lib/utils')
    }
  },

  build: {
    // Tamaño mínimo para warning
    chunkSizeWarningLimit: 500,
    
    // Opciones de Rollup
    rollupOptions: {
      output: {
        // Configuración de chunks manuales
        manualChunks,
        
        // Nombres de chunks
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? path.basename(chunkInfo.facadeModuleId, '.js') 
            : 'chunk';
          
          return `chunks/${facadeModuleId}-[hash].js`;
        },
        
        // Nombres de assets
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          
          if (/\.(woff2?|ttf|otf|eot)$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          
          return `assets/[name]-[hash][extname]`;
        },
        
        // Configuración de formato
        format: 'es',
        
        // Sourcemap para debugging
        sourcemap: true,
        
        // Compact output
        compact: true,
        
        // Generación de exports
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          arrowFunctions: true
        }
      },
      
      // Configuración de tree-shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    
    // Minificación con esbuild (más rápido que terser)
    minify: 'esbuild',
    
    // Target moderno para mejor tree-shaking
    target: 'es2020',
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Assets inline limit (4KB)
    assetsInlineLimit: 4096,
    
    // Report de bundle comprimido
    reportCompressedSize: true,
    
    // Source maps para producción
    sourcemap: 'hidden'
  },

  // Optimizaciones de desarrollo
  server: {
    hmr: {
      overlay: true,
      port: 24678
    },
    
    // Pre-bundling de dependencias
    fs: {
      strict: true
    }
  },

  // Optimización de dependencias
  optimizeDeps: {
    include: [
      'svelte',
      'globe.gl',
      'three',
      'd3',
      'topojson-client',
      '@turf/boolean-point-in-polygon',
      '@turf/helpers',
      'lucide-svelte'
    ],
    
    exclude: [
      '@sveltejs/kit',
      '@prisma/client'
    ],
    
    // Force pre-bundling
    force: false
  },

  // CSS
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import 'src/styles/variables.scss';`
      }
    },
    
    // PostCSS para optimizaciones
    postcss: {
      plugins: []
    },
    
    // Módulos CSS
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]--[hash:base64:5]'
    }
  },

  // JSON
  json: {
    stringify: true,
    namedExports: true
  },

  // Configuración de workers
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'workers/[name]-[hash].js'
      }
    }
  },

  // Preview
  preview: {
    port: 4173,
    strictPort: true,
    cors: true
  },

  // Configuración de SSR
  ssr: {
    noExternal: process.env.NODE_ENV === 'production' 
      ? ['globe.gl', 'three'] 
      : []
  },

  // Define variables de entorno
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },

  // Logging
  logLevel: 'info',
  clearScreen: false,

  // Experimental features
  experimental: {
    // Habilitar optimizaciones experimentales si están disponibles
  }
});

// Exportar configuración adicional para análisis
export const bundleAnalyzerConfig = {
  analyzerMode: 'static',
  reportFilename: 'bundle-report.html',
  openAnalyzer: false,
  generateStatsFile: true,
  statsFilename: 'bundle-stats.json'
};

// Configuración para compresión
export const compressionConfig = {
  algorithm: 'brotliCompress',
  ext: '.br',
  threshold: 10240, // 10KB
  compressionOptions: {
    level: 11
  },
  deleteOriginFile: false
};
