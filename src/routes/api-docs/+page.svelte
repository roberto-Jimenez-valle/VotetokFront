<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let swaggerContainer: HTMLDivElement;

  onMount(async () => {
    if (!browser) return;

    // Agregar clase especial al body para aislar esta página
    document.body.classList.add('api-docs-page');

    try {
      // Importar Swagger UI de forma dinámica
      const SwaggerUIBundle = (await import('swagger-ui-dist/swagger-ui-bundle')).default;
      const SwaggerUIStandalonePreset = (await import('swagger-ui-dist/swagger-ui-standalone-preset')).default;

      console.log('[Swagger UI] Inicializando...');

      // Inicializar Swagger UI con URL directa al YAML
      SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showRequestHeaders: true,
        tryItOutEnabled: true,
        onComplete: () => {
          console.log('[Swagger UI] ✅ Cargado exitosamente');
        },
        onFailure: (err: any) => {
          console.error('[Swagger UI] ❌ Error al cargar:', err);
        }
      });
    } catch (error) {
      console.error('[Swagger UI] ❌ Error al inicializar:', error);
    }
  });

  onDestroy(() => {
    if (browser) {
      // Limpiar clase cuando se desmonte el componente
      document.body.classList.remove('api-docs-page');
    }
  });
</script>

<svelte:head>
  <title>VouTop API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    /* Estilos globales para página de API docs */
    body.api-docs-page {
      margin: 0;
      padding: 0;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      touch-action: pan-y pinch-zoom !important;
      width: 100%;
      height: 100%;
    }

    /* Sobreescribir touch-action de otros componentes */
    body.api-docs-page * {
      touch-action: pan-y pinch-zoom !important;
    }

    /* Ocultar componentes que interfieren con el scroll */
    body.api-docs-page header,
    body.api-docs-page .nav-area-bottom,
    body.api-docs-page .sheet-drag-area,
    body.api-docs-page .drag-chart,
    body.api-docs-page .avatar-small-btn,
    body.api-docs-page .polls-fullscreen-container {
      display: none !important;
      pointer-events: none !important;
    }

    /* Asegurar que nada más capture eventos touch */
    body.api-docs-page #svelte {
      touch-action: pan-y pinch-zoom !important;
    }
  </style>
</svelte:head>

<div class="api-docs-container">
  <div id="swagger-ui" bind:this={swaggerContainer}></div>
</div>

<style>
  .api-docs-container {
    width: 100%;
    min-height: 100vh;
    background: #fafafa;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
  }

  :global(#swagger-ui) {
    max-width: 1460px;
    margin: 0 auto;
    touch-action: pan-y pinch-zoom;
  }

  /* Personalización de colores */
  :global(.swagger-ui .topbar) {
    background-color: #1a1a2e;
  }

  :global(.swagger-ui .info .title) {
    color: #1a1a2e;
  }

  :global(.swagger-ui .opblock.opblock-post) {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  :global(.swagger-ui .opblock.opblock-post .opblock-summary-method) {
    background: #10b981;
  }

  :global(.swagger-ui .opblock.opblock-get) {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  :global(.swagger-ui .opblock.opblock-get .opblock-summary-method) {
    background: #3b82f6;
  }

  :global(.swagger-ui .opblock.opblock-delete) {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  :global(.swagger-ui .opblock.opblock-delete .opblock-summary-method) {
    background: #ef4444;
  }

  /* Botón Try it out */
  :global(.swagger-ui .btn.try-out__btn) {
    background: #1a1a2e;
    color: white;
    border-color: #1a1a2e;
  }

  :global(.swagger-ui .btn.execute) {
    background: #10b981;
    border-color: #10b981;
  }

  /* Asegurar scroll en elementos de Swagger UI */
  :global(.swagger-ui .wrapper) {
    touch-action: pan-y pinch-zoom;
  }

  :global(.swagger-ui .opblock-body) {
    touch-action: pan-y pinch-zoom;
  }

  :global(.swagger-ui .responses-wrapper) {
    touch-action: pan-y pinch-zoom;
    overflow-y: auto;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .api-docs-container {
      overflow-y: scroll !important;
      -webkit-overflow-scrolling: touch !important;
    }

    :global(#swagger-ui) {
      padding: 0 10px;
      overflow-y: visible;
    }

    :global(.swagger-ui .opblock) {
      touch-action: pan-y pinch-zoom;
    }
  }
</style>
