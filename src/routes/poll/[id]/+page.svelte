<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const { poll, baseUrl } = data;

  onMount(() => {
    // Redirigir a la página principal con el poll abierto
    goto(`/?poll=${poll.id}`, { replaceState: true });
  });
</script>

<svelte:head>
  <!-- Meta tags básicos -->
  <title>{poll.title} - VouTop</title>
  <meta name="description" content={poll.description || `Vota en esta encuesta: ${poll.title}`} />
  
  <!-- Open Graph para Facebook/WhatsApp -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content={poll.title} />
  <meta property="og:description" content={poll.description || `Vota en esta encuesta: ${poll.title}`} />
  <meta property="og:url" content={`${baseUrl}/poll/${poll.id}`} />
  <meta property="og:image" content={`${baseUrl}/api/polls/${poll.id}/og-image`} />
  <meta property="og:image:secure_url" content={`${baseUrl}/api/polls/${poll.id}/og-image`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:site_name" content="VouTop" />
  
  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={poll.title} />
  <meta name="twitter:description" content={poll.description || `Vota en esta encuesta: ${poll.title}`} />
  <meta name="twitter:image" content={`${baseUrl}/api/polls/${poll.id}/og-image`} />
  
  <!-- WhatsApp específico -->
  <meta property="og:image:alt" content={`Preview de la encuesta: ${poll.title}`} />
  <meta property="og:locale" content="es_ES" />
</svelte:head>

<!-- Pantalla de carga mientras redirige -->
<div class="loading-screen">
  <div class="spinner"></div>
  <p>Cargando encuesta...</p>
</div>

<style>
  .loading-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
    color: white;
    gap: 20px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  p {
    font-size: 16px;
    opacity: 0.8;
  }
</style>
