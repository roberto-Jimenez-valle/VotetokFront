<script lang="ts">
  import { fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { DARK_PALETTES, LIGHT_PALETTES } from '$lib/config/palettes';
  
  export let isOpen = false;
  export let pollId: number | string;
  export let pollHashId: string = ''; // ID hasheado para URLs públicas
  export let pollTitle: string = '';
  
  const dispatch = createEventDispatcher();
  
  let activeTab: 'share' | 'embed' = 'share';
  let embedTheme: 'dark' | 'light' = 'dark';
  let selectedPaletteIndex = 0;
  let copied = false;
  let copiedEmbed = false;
  
  $: currentPalettes = embedTheme === 'light' ? LIGHT_PALETTES : DARK_PALETTES;
  $: selectedPalette = currentPalettes[selectedPaletteIndex] || currentPalettes[0];
  
  // Usar hashId para URLs públicas si está disponible
  $: publicId = pollHashId || pollId;
  $: baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  $: shareUrl = `${baseUrl}/poll/${publicId}`;
  $: embedUrl = `${baseUrl}/embed/globe/${publicId}?theme=${embedTheme}&palette=${selectedPalette.name}`;
  $: embedCode = `<iframe src="${embedUrl}" width="320" height="600" frameborder="0" style="border-radius:12px"></iframe>`;
  
  function selectPalette(index: number) {
    selectedPaletteIndex = index;
  }
  
  function switchTheme(theme: 'dark' | 'light') {
    embedTheme = theme;
    selectedPaletteIndex = 0;
  }
  
  function close() {
    isOpen = false;
    dispatch('close');
  }
  
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }
  
  async function copyEmbedCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      copiedEmbed = true;
      setTimeout(() => copiedEmbed = false, 2000);
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copiedEmbed = true;
      setTimeout(() => copiedEmbed = false, 2000);
    }
  }
  
  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: pollTitle || 'Encuesta en VouTop',
          text: `Vota en esta encuesta: ${pollTitle}`,
          url: shareUrl
        });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  }
  
  function shareTwitter() {
    const text = encodeURIComponent(`Vota en esta encuesta: ${pollTitle}`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=550,height=420');
  }
  
  function shareWhatsApp() {
    const text = encodeURIComponent(`Vota en esta encuesta: ${pollTitle} ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }
  
  function shareTelegram() {
    const text = encodeURIComponent(`Vota en esta encuesta: ${pollTitle}`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  }
  
  function shareFacebook() {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div 
    class="modal-backdrop" 
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="0"
    transition:fly={{ duration: 200 }}
  ></div>
  
  <!-- Modal -->
  <div class="share-modal" transition:fly={{ y: 100, duration: 300 }}>
    <!-- Header -->
    <div class="modal-header">
      <h2>Compartir encuesta</h2>
      <button class="close-btn" onclick={close} type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <!-- Tabs -->
    <div class="tabs">
      <button 
        class="tab {activeTab === 'share' ? 'active' : ''}" 
        onclick={() => activeTab = 'share'}
        type="button"
      >
        Compartir
      </button>
      <button 
        class="tab {activeTab === 'embed' ? 'active' : ''}" 
        onclick={() => activeTab = 'embed'}
        type="button"
      >
        Embeber
      </button>
    </div>
    
    {#if activeTab === 'share'}
      <!-- Share Tab -->
      <div class="tab-content">
        <!-- Copy Link -->
        <div class="link-box">
          <input type="text" value={shareUrl} readonly />
          <button class="copy-btn {copied ? 'copied' : ''}" onclick={copyLink} type="button">
            {#if copied}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            {/if}
          </button>
        </div>
        
        <!-- Social Buttons -->
        <div class="social-buttons">
          <button class="social-btn native" onclick={shareNative} type="button" title="Compartir">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
            </svg>
            <span>Compartir</span>
          </button>
          
          <button class="social-btn twitter" onclick={shareTwitter} type="button" title="Twitter/X">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Twitter</span>
          </button>
          
          <button class="social-btn whatsapp" onclick={shareWhatsApp} type="button" title="WhatsApp">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span>WhatsApp</span>
          </button>
          
          <button class="social-btn telegram" onclick={shareTelegram} type="button" title="Telegram">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span>Telegram</span>
          </button>
          
          <button class="social-btn facebook" onclick={shareFacebook} type="button" title="Facebook">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>Facebook</span>
          </button>
        </div>
      </div>
    {:else}
      <!-- Embed Tab -->
      <div class="tab-content">
        <!-- Controles compactos: Tema + Paleta -->
        <div class="embed-controls">
          <div class="theme-toggle-compact">
            <button 
              class="theme-btn-compact {embedTheme === 'dark' ? 'active' : ''}" 
              onclick={() => switchTheme('dark')}
              type="button"
              title="Tema oscuro"
            >🌙</button>
            <button 
              class="theme-btn-compact {embedTheme === 'light' ? 'active' : ''}" 
              onclick={() => switchTheme('light')}
              type="button"
              title="Tema claro"
            >☀️</button>
          </div>
          <div class="palette-row">
            {#each currentPalettes.slice(0, 8) as palette, i}
              <button 
                class="palette-dot-compact {selectedPaletteIndex === i ? 'active' : ''}"
                style="background: {palette.bg};"
                onclick={() => selectPalette(i)}
                title={palette.name}
                type="button"
              ></button>
            {/each}
          </div>
        </div>
        
        <!-- Preview -->
        <div class="embed-preview">
          <iframe 
            src={embedUrl} 
            width="100%" 
            height="600"
            frameborder="0"
            title="Preview del embed"
          ></iframe>
        </div>
        
        <!-- Code Box -->
        <div class="code-box">
          <code>{embedCode}</code>
          <button class="copy-code-btn {copiedEmbed ? 'copied' : ''}" onclick={copyEmbedCode} type="button">
            {copiedEmbed ? '¡Copiado!' : 'Copiar código'}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 9998;
  }
  
  .share-modal {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0f 100%);
    border-radius: 20px 20px 0 0;
    z-index: 9999;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: white;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .tab {
    flex: 1;
    padding: 12px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  
  .tab.active {
    color: white;
  }
  
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  }
  
  .tab-content {
    padding: 20px;
    overflow-y: auto;
  }
  
  .link-box {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  
  .link-box input {
    flex: 1;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: white;
    font-size: 14px;
  }
  
  .copy-btn {
    padding: 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .copy-btn:hover {
    transform: scale(1.05);
  }
  
  .copy-btn.copied {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
  
  .social-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  
  .social-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .social-btn:hover {
    transform: scale(1.02);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .social-btn span {
    font-size: 12px;
    opacity: 0.8;
  }
  
  .social-btn.native { color: #a78bfa; }
  .social-btn.twitter { color: #1da1f2; }
  .social-btn.whatsapp { color: #25d366; }
  .social-btn.telegram { color: #0088cc; }
  .social-btn.facebook { color: #1877f2; }
  
  /* Controles compactos de embed */
  .embed-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
  }
  
  .theme-toggle-compact {
    display: flex;
    gap: 4px;
  }
  
  .theme-btn-compact {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .theme-btn-compact:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .theme-btn-compact.active {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-color: transparent;
  }
  
  .palette-row {
    display: flex;
    gap: 4px;
    flex: 1;
  }
  
  .palette-dot-compact {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .palette-dot-compact:hover {
    transform: scale(1.15);
  }
  
  .palette-dot-compact.active {
    border-color: white;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
  }
  
  .embed-preview {
    border-radius: 36px;
    overflow: hidden;
    margin-bottom: 16px;
    background: #0a0a0f;
    border: none;
  }
  
  .embed-preview iframe {
    display: block;
    border-radius: 36px;
    border: none;
    outline: none;
  }
  
  .code-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
  }
  
  .code-box code {
    display: block;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    word-break: break-all;
    margin-bottom: 12px;
    max-height: 80px;
    overflow-y: auto;
  }
  
  .copy-code-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .copy-code-btn:hover {
    transform: scale(1.01);
    opacity: 0.95;
  }
  
  .copy-code-btn.copied {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
  
  @media (max-width: 500px) {
    .share-modal {
      max-width: 100%;
      border-radius: 16px 16px 0 0;
    }
    
    .social-buttons {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
