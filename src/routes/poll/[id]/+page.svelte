<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const { poll, baseUrl } = data;
  
  // Usar hashId para URLs públicas
  const publicId = poll.hashId || poll.id;

  onMount(() => {
    // Dar tiempo a los crawlers para leer los meta tags antes de redirigir
    // Los crawlers no ejecutan JavaScript, verán los meta tags
    // Los usuarios reales serán redirigidos después de un pequeño delay
    setTimeout(() => {
      goto(`/?poll=${publicId}`);
    }, 100);
  });
</script>

<svelte:head>
  <!-- Meta tags básicos -->
  <title>{poll.title} - VouTop</title>
  <meta name="description" content={poll.description || `Vota en esta encuesta: ${poll.title}`} />
  
  <!-- oEmbed Discovery - permite que plataformas extraigan embed automáticamente (como Spotify) -->
  <link rel="alternate" type="application/json+oembed" href={`${baseUrl}/api/oembed?url=${encodeURIComponent(`${baseUrl}/poll/${publicId}`)}&format=json`} title={poll.title} />
  
  <!-- Open Graph para Facebook/WhatsApp/Discord/Slack -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content={poll.title} />
  <meta property="og:description" content={poll.description || `¡Vota ahora! ${poll.options?.length || 0} opciones disponibles`} />
  <meta property="og:url" content={`${baseUrl}/poll/${publicId}`} />
  <meta property="og:image" content={`${baseUrl}/api/polls/${publicId}/og-image`} />
  <meta property="og:image:secure_url" content={`${baseUrl}/api/polls/${publicId}/og-image`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:site_name" content="VouTop" />
  <meta property="og:locale" content="es_ES" />
  
  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@voutop" />
  <meta name="twitter:title" content={poll.title} />
  <meta name="twitter:description" content={poll.description || `¡Vota ahora! ${poll.options?.length || 0} opciones disponibles`} />
  <meta name="twitter:image" content={`${baseUrl}/api/polls/${publicId}/og-image`} />
  <meta name="twitter:image:alt" content={`Encuesta: ${poll.title}`} />
  
  <!-- Discord específico -->
  <meta name="theme-color" content="#6366f1" />
  
  <!-- Embed player para plataformas que lo soporten -->
  <meta property="og:video" content={`${baseUrl}/embed/poll/${publicId}`} />
  <meta property="og:video:secure_url" content={`${baseUrl}/embed/poll/${publicId}`} />
  <meta property="og:video:type" content="text/html" />
  <meta property="og:video:width" content="400" />
  <meta property="og:video:height" content="352" />
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
