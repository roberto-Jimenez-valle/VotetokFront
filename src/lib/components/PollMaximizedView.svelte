<script lang="ts">
  import { X } from 'lucide-svelte';
  import MediaEmbed from './MediaEmbed.svelte';
  import { fade, fly } from 'svelte/transition';

  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollTitle: string;
    onClose: () => void;
    onOptionChange: (optionId: string) => void;
    onTitleChange: (title: string) => void;
    onLabelChange: (optionId: string, label: string) => void;
    onOpenColorPicker: (optionId: string) => void;
  }

  let { 
    options, 
    activeOptionId = $bindable(), 
    pollTitle,
    onClose,
    onOptionChange,
    onTitleChange,
    onLabelChange,
    onOpenColorPicker
  }: Props = $props();

  // Opción activa derivada (readonly, calculada reactivamente)
  let activeOption = $derived(options.find(opt => opt.id === activeOptionId));
  let activeIndex = $derived(options.findIndex(opt => opt.id === activeOptionId));
  let percentage = $derived(Math.round(100 / options.length));

  // Debug logs
  $effect(() => {
    console.log('[PollMaximizedView] Renderizando:', {
      totalOptions: options.length,
      activeOptionId,
      activeIndex,
      activeOption: activeOption ? {
        id: activeOption.id,
        label: activeOption.label,
        hasImageUrl: !!activeOption.imageUrl,
        imageUrl: activeOption.imageUrl
      } : null,
      percentage
    });
  });

  // Estado local SOLO para swipe visual
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let isDragging = $state(false);

  // Navegación simple
  function goToPrevious() {
    if (activeIndex > 0) {
      onOptionChange(options[activeIndex - 1].id);
    }
  }

  function goToNext() {
    if (activeIndex < options.length - 1) {
      onOptionChange(options[activeIndex + 1].id);
    }
  }

  function goToOption(optionId: string) {
    onOptionChange(optionId);
  }

  // Swipe handlers simplificados
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = true;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // Solo swipe horizontal con threshold de 50px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > deltaY) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    
    isDragging = false;
  }

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') goToPrevious();
      else if (e.key === 'ArrowRight') goToNext();
      else onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop y contenedor principal -->
<div 
  class="maximized-container"
  role="dialog"
  aria-modal="true"
  aria-label="Vista maximizada de encuesta"
  transition:fade={{ duration: 200 }}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
>
  <!-- Título editable de la encuesta -->
  <div class="poll-title-section">
    <textarea
      class="poll-title-input"
      placeholder="¿Cuál es tu pregunta?"
      value={pollTitle}
      oninput={(e) => onTitleChange((e.target as HTMLTextAreaElement).value)}
      rows="2"
      maxlength="280"
    ></textarea>
  </div>

  <!-- Contenedor de la opción activa -->
  {#if activeOption}
    {#key activeOptionId}
      <div class="option-content-container">
        <!-- Media Preview con texto dentro -->
        <div class="media-preview">
          {#if activeOption.imageUrl}
            <MediaEmbed 
              url={activeOption.imageUrl}
              mode="full"
              width="100%"
              height="auto"
            />
          {:else}
            <div class="no-media-placeholder" style="background: {activeOption.color}20;">
              <div style="font-size: 64px; opacity: 0.3;">📊</div>
            </div>
          {/if}

          <!-- Texto con flechas en el bottom del preview -->
          <div class="text-with-arrows">
            <!-- Textarea arriba -->
            <textarea
              class="option-label-input"
              placeholder="Opción {activeIndex + 1}"
              value={activeOption.label}
              oninput={(e) => onLabelChange(activeOption.id, (e.target as HTMLTextAreaElement).value)}
              rows="2"
              maxlength="150"
            ></textarea>

            <!-- Flechas debajo a los lados -->
            <div class="arrows-below">
              <button
                type="button"
                class="nav-arrow-side left"
                onclick={goToPrevious}
                aria-label="Opción anterior"
                style="visibility: {activeIndex > 0 ? 'visible' : 'hidden'};"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              <button
                type="button"
                class="nav-arrow-side right"
                onclick={goToNext}
                aria-label="Siguiente opción"
                style="visibility: {activeIndex < options.length - 1 ? 'visible' : 'hidden'};"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/key}
  {/if}

  <!-- Porcentaje abajo a la izquierda -->
  {#if activeOption}
    <div class="percentage-bottom-left">
      <span class="percentage-text">{percentage}%</span>
    </div>
  {/if}

  <!-- Botones de acción en el bottom derecho -->
  {#if activeOption}
    <div class="action-buttons-bottom">
      <!-- Botón de cambiar color (izquierda) -->
      <button
        type="button"
        class="color-button"
        style="background: {activeOption.color};"
        onclick={() => onOpenColorPicker(activeOption.id)}
        aria-label="Cambiar color"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      <!-- Botón de minimizar (derecha) -->
      <button
        type="button"
        class="minimize-button"
        onclick={onClose}
        aria-label="Minimizar"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      </button>
    </div>
  {/if}

  <!-- Barra inferior con color y dots -->
  <div class="bottom-bar">
    <!-- Dots de navegación - todos opacos -->
    <div class="navigation-dots">
      {#each options as option, idx}
        <button
          type="button"
          class="dot"
          class:active={option.id === activeOptionId}
          style="background: {option.color};"
          onclick={() => goToOption(option.id)}
          aria-label="Ir a opción {idx + 1}"
        ></button>
      {/each}
    </div>
    
    <!-- Franja de color que sube según porcentaje -->
    {#if activeOption}
      <div class="color-stripe" style="background: {activeOption.color}; height: {Math.max(8, percentage)}px;"></div>
    {/if}
  </div>

</div>

<style>
  .maximized-container {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: pan-y;
  }

  .close-button {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10000;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: auto;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  /* Título editable de la encuesta */
  .poll-title-section {
    padding: 20px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .poll-title-input {
    width: 100%;
    background: transparent;
    border: none;
    color: white;
    font-size: 20px;
    font-weight: 600;
    padding: 16px 20px;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.4;
    transition: all 0.2s;
  }

  .poll-title-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Contenedor principal de la opción */
  .option-content-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0;
    padding-bottom: 100px;
    gap: 0;
  }

  /* Media preview - centrado vertical, todo el ancho */
  .media-preview {
    width: 100vw;
    height: 75vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    position: relative;
  }

  .media-preview :global(.media-embed) {
    width: 100% !important;
    flex: 1;
    border-radius: 0 !important;
    background: transparent !important;
    display: flex;
    align-items: center;
    overflow: hidden !important;
    justify-content: center;
  }

  .media-preview :global(.media-embed.full-mode) {
    width: 100% !important;
    height: 100% !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  .media-preview :global(.media-embed iframe) {
    width: 100% !important;
    min-width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    border-radius: 0 !important;
  }

  .media-preview :global(.media-embed video),
  .media-preview :global(.media-embed img) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    object-fit: contain !important;
    object-position: center !important;
    border-radius: 0 !important;
  }

  .no-media-placeholder {
    width: 100%;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 0;
  }

  /* Contenedor principal de texto y botones - horizontal */
  .option-text-container {
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: flex-end;
  }

  /* Texto con flechas debajo - vertical, dentro del preview */
  .text-with-arrows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 12px;
    width: 100%;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
    backdrop-filter: blur(10px);
  }

  /* Flechas debajo a los lados */
  .arrows-below {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Porcentaje abajo a la izquierda, por encima de dots */
  .percentage-bottom-left {
    position: fixed;
    bottom: 80px;
    left: 20px;
    z-index: 1000;
  }

  .percentage-text {
    font-size: 64px;
    font-weight: 700;
    color: white;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
  }

  /* Botones de acción casi en el bottom derecho - horizontal */
  .action-buttons-bottom {
    position: fixed;
    bottom: 80px;
    right: 20px;
    display: flex;
    flex-direction: row;
    gap: 12px;
    z-index: 1000;
  }

  .option-label-input {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 12px 16px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.5;
    transition: all 0.2s;
  }

  .option-label-input:focus {
    background: transparent;
  }

  .option-label-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* Flechas laterales discretas - solo en desktop */
  .nav-arrow-side {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  /* Mostrar flechas solo en desktop (>768px) */
  @media (min-width: 768px) {
    .nav-arrow-side {
      display: flex;
    }
  }

  .nav-arrow-side:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .nav-arrow-side:active {
    transform: scale(0.95);
  }

  /* Botón de cambiar color */
  .color-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    color: white;
    pointer-events: auto;
  }

  .color-button:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .color-button:active {
    transform: scale(0.95);
  }

  /* Botón de minimizar */
  .minimize-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    color: white;
    pointer-events: auto;
  }

  .minimize-button:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .minimize-button:active {
    transform: scale(0.95);
  }

  .percentage-display {
    display: flex;
    justify-content: center;
  }

  .percentage-text {
    font-size: 48px;
    font-weight: 700;
    color: white;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
    letter-spacing: -0.02em;
  }

  /* Barra inferior */
  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }

  .navigation-dots {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    justify-content: center;
    background: transparent;
    z-index: 1001;
    pointer-events: auto;
  }

  .color-stripe {
    width: 100%;
    max-height: 100px;
    min-height: 8px;
    transition: all 0.3s ease;
    align-self: flex-end;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    pointer-events: auto;
  }

  .dot.active {
    width: 24px;
    border-radius: 4px;
  }

  .option-counter {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 14px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 12px;
    z-index: 999;
    pointer-events: none;
  }

  /* Flechas de navegación */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 1001;
    pointer-events: auto;
  }

  .nav-arrow.left {
    left: 20px;
  }

  .nav-arrow.right {
    right: 20px;
  }

  .nav-arrow:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-arrow:active {
    transform: translateY(-50%) scale(0.95);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .poll-title h2 {
      font-size: 14px;
    }

    .option-label {
      font-size: 18px;
    }

    .percentage-text {
      font-size: 20px;
    }
  }
</style>
