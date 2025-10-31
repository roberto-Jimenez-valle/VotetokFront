import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  
  test: {
    // Entorno de prueba
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    
    // Incluir archivos de test
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'src/**/__tests__/**/*.{js,ts}'
    ],
    
    // Excluir archivos
    exclude: [
      'node_modules',
      '.svelte-kit',
      'build',
      'dist'
    ],
    
    // Configuración de globals
    globals: true,
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.svelte-kit/',
        'build/',
        'src/test/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types.ts',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    
    // Timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporters: ['default', 'html'],
    
    // Mock automático
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    
    // Pool
    pool: 'forks',
    
    // Threading
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    
    // Watch
    watchExclude: ['**/node_modules/**', '**/.svelte-kit/**']
  },
  
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
      '$app': path.resolve('./src/app'),
      '$components': path.resolve('./src/lib/components'),
      '$stores': path.resolve('./src/lib/stores'),
      '$services': path.resolve('./src/lib/services'),
      '$utils': path.resolve('./src/lib/utils')
    }
  },
  
  // Optimización de dependencias para tests
  optimizeDeps: {
    include: [
      'svelte',
      '@testing-library/svelte',
      'vitest'
    ]
  }
});
