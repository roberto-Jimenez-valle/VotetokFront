<script lang="ts">
  import { Plus } from 'lucide-svelte';
  
  type PollOption = {
    key: string;
    label: string;
    color: string;
    votes: number;
    avatarUrl?: string;
  };

  type Poll = {
    id: number;
    title: string;
    options: PollOption[];
    isCollaborative?: boolean;
  };

  let { poll = null } = $props<{ poll: Poll | null }>();
  
  let expanded = $state(false);
  
  // Reset cuando poll cambia
  $effect(() => {
    if (!poll) {
      expanded = false;
      document.body.classList.remove('poll-options-open');
    }
  });

  function toggleExpanded() {
    expanded = !expanded;
    console.log('[PollOptionsBar] Expanded:', expanded);
    
    // Ocultar BottomSheet solo cuando está expandido
    if (expanded) {
      document.body.classList.add('poll-options-open');
      
      // Forzar repaint en Chrome - técnica de scroll
      setTimeout(() => {
        const overlay = document.querySelector('.options-overlay') as HTMLElement;
        if (overlay) {
          // Forzar reflow con scroll
          overlay.scrollTop = 0;
          // Forzar otro reflow
          void overlay.offsetHeight;
        }
      }, 0);
    } else {
      document.body.classList.remove('poll-options-open');
    }
  }

  function handleBarClick(e: MouseEvent) {
    e.stopPropagation();
    toggleExpanded();
  }

  function handleOverlayClick(e: MouseEvent) {
    e.stopPropagation();
    toggleExpanded();
  }

  function handlePopupClick(e: MouseEvent) {
    e.stopPropagation();
  }
  
  function addNewOption() {
    console.log('Añadiendo nueva opción');
  }
  
  // Función pura para calcular porcentajes (sin reactividad)
  function getOptionsWithPct(options: PollOption[]) {
    const total = options.reduce((sum, opt) => sum + opt.votes, 0);
    return options.map(opt => ({
      ...opt,
      pct: total > 0 ? (opt.votes / total) * 100 : 0
    }));
  }
</script>

{#if poll}
<div class="poll-options-bar">
  <!-- Título de la encuesta -->
  <div class="poll-title-section">
    <h2 class="poll-title">{poll.title}</h2>
  </div>

  <!-- Barra horizontal de colores -->
  <button 
    class="options-bar-container" 
    onclick={handleBarClick}
    aria-expanded={expanded}
    aria-label="Ver opciones de la encuesta"
  >
    <div class="options-bar">
      {#each getOptionsWithPct(poll.options) as option (option.key)}
        <div 
          class="option-segment" 
          style="width: {option.pct}%; background-color: {option.color};"
          title="{option.label}: {option.pct.toFixed(1)}%"
        ></div>
      {/each}
    </div>
    <div class="expand-icon">
      {expanded ? '▲' : '▼'}
    </div>
  </button>

</div>
{/if}

<!-- Overlay independiente para opciones expandidas (fuera del BottomSheet DOM) -->
{#if poll && expanded}
<div 
  class="options-overlay" 
  onclick={handleOverlayClick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Escape') toggleExpanded(); }}
  aria-label="Cerrar opciones"
>
  <div 
    class="options-popup" 
    onclick={handlePopupClick}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="popup-header">
      <h3 class="popup-title">{poll.title}</h3>
      <button 
        class="close-button" 
        onclick={(e) => {
          e.stopPropagation();
          toggleExpanded();
        }}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
    
    <div class="options-list">
      {#each getOptionsWithPct(poll.options).sort((a: any, b: any) => b.pct - a.pct) as option}
        <div class="option-item">
          <div class="option-info">
            {#if option.avatarUrl}
              <img src={option.avatarUrl} alt={option.label} class="option-avatar" />
            {:else}
              <div class="option-avatar-placeholder" style="background-color: {option.color};">
                {option.label.charAt(0)}
              </div>
            {/if}
            <span class="option-label">{option.label}</span>
          </div>
          <div class="option-stats">
            <div class="option-bar-bg">
              <div 
                class="option-bar-fill" 
                style="width: {option.pct}%; background-color: {option.color};"
              ></div>
            </div>
            <span class="option-pct">{option.pct.toFixed(1)}%</span>
          </div>
        </div>
      {/each}
      
      <!-- Botón añadir opción (solo para encuestas colaborativas) -->
      {#if poll?.isCollaborative}
        <button
          type="button"
          class="add-option-button"
          onclick={addNewOption}
          title="Añadir nueva opción"
        >
          <Plus class="w-5 h-5" />
          <span>Añadir opción</span>
        </button>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .poll-options-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20050;
    background: #000000;
    border-top: 1px solid rgba(255,255,255,0.12);
    padding: 12px 16px;
  }

  .poll-title-section {
    margin-bottom: 8px;
  }

  .poll-title {
    font-size: 14px;
    font-weight: 600;
    color: white;
    text-align: center;
    margin: 0;
    line-height: 1.4;
  }

  .options-bar-container {
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
  }

  .options-bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    background: rgba(255,255,255,0.1);
  }

  .option-segment {
    height: 100%;
    flex-shrink: 0;
  }

  .options-bar-container:hover .option-segment {
    opacity: 0.8;
  }

  .expand-icon {
    color: #9ca3af;
    font-size: 12px;
    transition: transform 0.3s ease;
  }

  .options-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000000;
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    /* Forzar repaint en Chrome con animación mínima */
    animation: forceRepaint 0.01s;
  }
  
  @keyframes forceRepaint {
    from { opacity: 0.99; }
    to { opacity: 1; }
  }

  .options-popup {
    width: 100%;
    max-height: 70vh;
    background: #1a1a1f;
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
    /* Forzar repaint */
    animation: forceRepaint 0.01s;
    /* Ayudar con painting en Chrome */
    contain: paint;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }

  .popup-title {
    font-size: 18px;
    font-weight: 700;
    color: white;
    margin: 0;
    flex: 1;
    line-height: 1.3;
  }

  .close-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.08);
    border: none;
    border-radius: 50%;
    color: rgba(255,255,255,0.7);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-left: 12px;
  }

  .close-button:hover {
    background: rgba(255,255,255,0.15);
    color: white;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .options-list::-webkit-scrollbar {
    width: 4px;
  }

  .options-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .options-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .option-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    background: #2d2e33;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    /* Forzar repaint de cada item */
    animation: forceRepaint 0.01s;
  }

  .option-item:hover {
    background: #34353a;
    border-color: rgba(255,255,255,0.2);
  }

  .option-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }

  .option-avatar,
  .option-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .option-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .option-label {
    color: white;
    font-size: 14px;
    font-weight: 500;
  }

  .option-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .option-bar-bg {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .option-bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .option-pct {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    min-width: 45px;
    text-align: right;
  }
  
  /* Botón añadir opción */
  .add-option-button {
    width: 100%;
    padding: 14px 16px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px dashed rgba(59, 130, 246, 0.4);
    border-radius: 12px;
    color: rgba(59, 130, 246, 1);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
  
  .add-option-button:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.6);
    transform: translateY(-1px);
  }
  
  .add-option-button:active {
    transform: scale(0.98);
  }
  /* Deshabilitar BottomSheet cuando el popup está abierto - usando clase global */
  :global(body.poll-options-open .bottom-sheet) {
    display: none !important;
  }
</style>
