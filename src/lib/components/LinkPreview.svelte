<script lang="ts">
  import { ExternalLink, AlertTriangle, Loader2, X } from 'lucide-svelte';
  import { getDomainName, truncateText } from '$lib/services/linkPreview';
  import { markImageFailed, shouldRetryImage } from '$lib/stores/failed-images-store';
  
  // Tipo de datos del preview
  interface LinkPreviewData {
    url: string;
    title: string;
    description?: string;
    image?: string;
    imageProxied?: string;
    siteName?: string;
    domain: string;
    type: 'oembed' | 'opengraph' | 'generic';
    embedHtml?: string;
    width?: number;
    height?: number;
    providerName?: string;
    isSafe: boolean;
    nsfwScore?: number;
  }
  
  interface Props {
    preview: LinkPreviewData;
    onRemove?: () => void;
    compact?: boolean;
    clickable?: boolean;
  }
  
  let { preview, onRemove, compact = false, clickable = true }: Props = $props();
  
  let imageLoaded = $state(false);
  let imageError = $state(false);
  
  function handleImageLoad() {
    console.log('[LinkPreview] Imagen cargada:', preview.imageProxied || preview.image);
    imageLoaded = true;
  }
  
  function handleImageError(e: Event) {
    const imgUrl = preview.imageProxied || preview.image;
    console.error('[LinkPreview] Error al cargar imagen:', imgUrl, e);
    imageError = true;
    if (imgUrl) markImageFailed(imgUrl);
  }
  
  function openLink() {
    if (clickable) {
      window.open(preview.url, '_blank', 'noopener,noreferrer');
    }
  }
</script>

<div 
  class="link-preview"
  class:compact
  class:clickable
  class:has-image={preview.image && !imageError}
  role={clickable ? 'button' : 'article'}
  onclick={openLink}
  onkeydown={(e) => e.key === 'Enter' && openLink()}
>
  <!-- Botón remover -->
  {#if onRemove}
    <button 
      class="remove-btn" 
      onclick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label="Remover preview"
    >
      <X size={16} />
    </button>
  {/if}
  
  <!-- Imagen -->
  {#if preview.image && !imageError && shouldRetryImage(preview.imageProxied || preview.image || '')}
    <div class="preview-image">
      {#if !imageLoaded}
        <div class="image-loader">
          <Loader2 size={24} class="spinner" />
        </div>
      {/if}
      <img 
        src={preview.imageProxied || preview.image} 
        alt={preview.title}
        onload={handleImageLoad}
        onerror={handleImageError}
        class:loaded={imageLoaded}
        style="display: block;"
      />
      
      <!-- Badge de advertencia NSFW -->
      {#if preview.nsfwScore && preview.nsfwScore > 0.7}
        <div class="nsfw-badge">
          <AlertTriangle size={14} />
          <span>Contenido sensible</span>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Contenido -->
  <div class="preview-content">
    <!-- Dominio y proveedor -->
    <div class="preview-header">
      <ExternalLink size={14} />
      <span class="domain">{preview.siteName || getDomainName(preview.url)}</span>
      
      {#if preview.type === 'oembed' && preview.providerName}
        <span class="provider-badge">{preview.providerName}</span>
      {/if}
    </div>
    
    <!-- Título -->
    <h3 class="preview-title">
      {truncateText(preview.title, compact ? 80 : 120)}
    </h3>
    
    <!-- Descripción -->
    {#if preview.description && !compact}
      <p class="preview-description">
        {truncateText(preview.description, 150)}
      </p>
    {/if}
    
    <!-- Advertencia si no es seguro -->
    {#if !preview.isSafe}
      <div class="safety-warning">
        <AlertTriangle size={14} />
        <span>Dominio no verificado</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .link-preview {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
    position: relative;
    max-width: 600px;
  }
  
  .link-preview.clickable {
    cursor: pointer;
  }
  
  .link-preview.clickable:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .link-preview.compact {
    flex-direction: row;
    max-width: 100%;
  }
  
  .link-preview.compact .preview-image {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }
  
  .link-preview.compact .preview-content {
    padding: 12px 14px;
  }
  
  /* Botón remover */
  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-btn:hover {
    background: rgba(220, 38, 38, 0.8);
    transform: scale(1.1);
  }
  
  /* Imagen */
  .preview-image {
    width: 100%;
    height: 200px;
    position: relative;
    background: rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  
  .preview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .preview-image img.loaded {
    opacity: 1;
  }
  
  .image-loader {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
  }
  
  :global(.image-loader .spinner) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .nsfw-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(220, 38, 38, 0.9);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: white;
  }
  
  /* Contenido */
  .preview-content {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .preview-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .domain {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .provider-badge {
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: rgb(96, 165, 250);
  }
  
  .preview-title {
    font-size: 15px;
    font-weight: 600;
    color: white;
    line-height: 1.4;
    margin: 0;
  }
  
  .preview-description {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    margin: 0;
  }
  
  .safety-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    font-size: 12px;
    color: rgb(251, 191, 36);
  }
  
  /* Responsive */
  @media (max-width: 640px) {
    .link-preview:not(.compact) {
      max-width: 100%;
    }
    
    .preview-image {
      height: 180px;
    }
    
    .link-preview.compact .preview-image {
      width: 100px;
      height: 100px;
    }
  }
</style>
