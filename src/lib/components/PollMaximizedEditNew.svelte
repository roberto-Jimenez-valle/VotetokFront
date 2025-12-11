<script lang="ts">
  import { X, Info, HelpCircle, Clock, List, Ban, CircleCheck, Palette, Sparkles, Trash2, Circle, Square, Users, Maximize2, Plus, ChevronDown, ThumbsUp, ThumbsDown, Check, Loader2, Minimize2 } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import MediaEmbed from "./MediaEmbed.svelte";

  // --- INTERFACES ---
  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
    isYesNo?: boolean;
    isCorrect?: boolean;
    yesText?: string;
    noText?: string;
    correctAnswer?: 'yes' | 'no';
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollTitle: string;
    onClose: () => void;
    onOptionChange: (optionId: string) => void;
    onTitleChange: (title: string) => void;
    onLabelChange: (optionId: string, newLabel: string) => void;
    onOpenColorPicker: (optionId: string) => void;
    onOpenGiphyPicker: (optionId: string) => void;
    onRemoveMedia: (optionId: string) => void;
    onRemoveOption: (optionId: string) => void;
    onToggleYesNo?: (optionId: string) => void;
    onToggleCorrect?: (optionId: string, answer?: 'yes' | 'no') => void;
    onYesNoTextChange?: (optionId: string, yesText: string, noText: string) => void;
    extractUrlFromText: (text: string) => string | null;
    getLabelWithoutUrl: (label: string) => string;
    pollType?: string;
    pollTypes?: readonly { id: string; label: string; icon: string }[];
    onChangePollType?: (type: string) => void;
    onOpenTypeOptionsModal?: () => void;
    onAddOption?: () => void;
    onAnimateCards?: () => void;
    isAnimatingCards?: boolean;
    canAddOption?: boolean;
    canAnimateCards?: boolean;
    totalOptions?: number;
    duration?: string;
    onDurationChange?: (value: string) => void;
    durations?: readonly { value: string; label: string }[];
    onPublish?: () => void;
    canPublish?: boolean;
  }

  let {
    options = $bindable(),
    activeOptionId = $bindable(),
    pollTitle,
    onClose,
    onOptionChange,
    onTitleChange,
    onLabelChange,
    onOpenColorPicker,
    onOpenGiphyPicker,
    onRemoveMedia,
    onRemoveOption,
    onToggleYesNo,
    onToggleCorrect,
    onYesNoTextChange,
    extractUrlFromText,
    getLabelWithoutUrl,
    pollType = 'single',
    pollTypes = [],
    onChangePollType,
    onOpenTypeOptionsModal,
    onAddOption,
    onAnimateCards,
    isAnimatingCards = false,
    canAddOption = true,
    canAnimateCards = false,
    totalOptions = 0,
    duration = 'never',
    onDurationChange,
    durations = [],
    onPublish,
    canPublish = false,
  }: Props = $props();

  // Estado local
  let inputRef = $state<HTMLTextAreaElement | null>(null);
  let showOptionsDropdown = $state(false);
  let showDurationDropdown = $state(false);

  // Computed
  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  let activeOption = $derived(options[activeIndex] || options[0]);
  let labelText = $derived(activeOption ? getLabelWithoutUrl(activeOption.label) : '');
  
  // Scroll container
  let scrollContainer: HTMLElement | null = null;
  let isScrollingProgrammatically = false;

  // History API
  let isClosingViaBack = false;

  onMount(() => {
    const previousState = history.state;
    const previousUrl = window.location.href;
    history.pushState({ modal: 'maximizedEdit' }, '');

    const handlePopState = () => {
      if (isClosingViaBack) return;
      isClosingViaBack = true;
      history.pushState(previousState, '', previousUrl);
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  });

  // Scroll functions
  function handleScroll() {
    if (isScrollingProgrammatically || !scrollContainer) return;
    const index = Math.round(scrollContainer.scrollLeft / window.innerWidth);
    if (index !== activeIndex && index >= 0 && index < options.length) {
      onOptionChange(options[index].id);
    }
  }

  function scrollToOption(index: number) {
    if (!scrollContainer) return;
    isScrollingProgrammatically = true;
    scrollContainer.scrollTo({ left: index * window.innerWidth, behavior: "smooth" });
    setTimeout(() => isScrollingProgrammatically = false, 500);
  }

  $effect(() => {
    if (activeIndex >= 0 && scrollContainer) {
      const currentScrollIndex = Math.round(scrollContainer.scrollLeft / window.innerWidth);
      if (currentScrollIndex !== activeIndex) {
        scrollToOption(activeIndex);
      }
    }
  });

  // Duration helpers
  function getDurationLabel(dur: string): string {
    if (dur?.startsWith('custom:')) {
      const dateTime = dur.replace('custom:', '');
      const date = new Date(dateTime);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return durations.find(d => d.value === dur)?.label || 'Sin límite';
  }

  // Media detection
  type MediaType = "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud" | "tiktok" | "twitch" | "twitter" | "applemusic" | "deezer" | "dailymotion" | "bandcamp";

  function getMediaType(opt: PollOption): MediaType {
    const url = (opt.imageUrl || extractUrlFromText(opt.label) || '').toLowerCase();
    if (!url) return "text";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("vimeo.com")) return "vimeo";
    if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
    if (url.includes("twitch.tv")) return "twitch";
    if (url.includes("dailymotion.com") || url.includes("dai.ly")) return "dailymotion";
    if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
    if (url.includes("spotify.com")) return "spotify";
    if (url.includes("soundcloud.com")) return "soundcloud";
    if (url.includes("music.apple.com")) return "applemusic";
    if (url.includes("deezer.com")) return "deezer";
    if (url.includes("bandcamp.com")) return "bandcamp";
    return "image";
  }

  function getMediaUrl(opt: PollOption): string {
    return opt.imageUrl || extractUrlFromText(opt.label) || '';
  }

  // Handle option text change
  function handleOptionTextChange(optId: string, newText: string) {
    const opt = options.find(o => o.id === optId);
    if (!opt) return;
    const currentUrl = extractUrlFromText(opt.label);
    if (currentUrl) {
      onLabelChange(optId, newText ? `${newText} ${currentUrl}` : currentUrl);
    } else {
      onLabelChange(optId, newText);
    }
  }
</script>

<div class="poll-editor-fullscreen">
  <!-- QUESTION AREA -->
  <div class="question-area">
    <div class="question-header">
      <div class="question-content">
        <h2 class="question-placeholder">¿Cuál es tu pregunta?</h2>
        
        <!-- Config Badges -->
        <div class="config-badges">
          <button 
            class="config-badge" 
            onclick={() => showOptionsDropdown = !showOptionsDropdown}
            type="button"
          >
            <List size={16} />
            <span>{totalOptions || options.length} opciones</span>
            <ChevronDown size={14} class="chevron {showOptionsDropdown ? 'open' : ''}" />
          </button>
          <span class="badge-separator">•</span>
          <button 
            class="config-badge" 
            onclick={() => showDurationDropdown = !showDurationDropdown}
            type="button"
          >
            <Clock size={16} />
            <span>{getDurationLabel(duration)}</span>
            <ChevronDown size={14} class="chevron {showDurationDropdown ? 'open' : ''}" />
          </button>
        </div>
      </div>

      <!-- Help Buttons -->
      <div class="help-buttons">
        <button class="help-btn info-btn" type="button" aria-label="Información">
          <Info size={18} />
        </button>
        <button class="help-btn question-btn" type="button" aria-label="Ayuda">
          <HelpCircle size={18} />
        </button>
      </div>
    </div>

    <!-- Progress Indicators -->
    <div class="progress-indicators">
      {#each options as opt, idx}
        <button
          class="indicator {idx === activeIndex ? 'active' : ''}"
          style="--indicator-color: {opt.color};"
          onclick={() => { onOptionChange(opt.id); scrollToOption(idx); }}
          type="button"
          aria-label="Ir a opción {idx + 1}"
        ></button>
      {/each}
    </div>
  </div>

  <!-- MAIN CARD CANVAS -->
  <main class="card-canvas">
    <div 
      bind:this={scrollContainer}
      class="cards-scroll"
      onscroll={handleScroll}
    >
      {#each options as opt, i (opt.id)}
        {@const type = getMediaType(opt)}
        {@const mediaUrl = getMediaUrl(opt)}
        {@const optLabelText = getLabelWithoutUrl(opt.label)}
        {@const hasMedia = type !== 'text'}
        
        <div class="card-slide" style="scroll-snap-stop: always;">
          <div 
            class="main-card" 
            style="--card-bg: {hasMedia ? 'transparent' : opt.color}; --card-gradient: linear-gradient(to bottom right, {opt.color}, {opt.color}dd);"
          >
            <!-- Decorative Pattern -->
            <div class="card-pattern"></div>

            <!-- Media Background (if has media) -->
            {#if hasMedia && i === activeIndex}
              <div class="media-background">
                {#key `media-${opt.id}`}
                  <MediaEmbed
                    url={mediaUrl}
                    mode="full"
                    width="100%"
                    height="100%"
                    autoplay={true}
                  />
                {/key}
                <!-- Remove media button -->
                <button
                  type="button"
                  class="remove-media-btn"
                  onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                  aria-label="Eliminar media"
                >
                  <X size={20} />
                </button>
              </div>
              <div class="media-gradient"></div>
            {/if}

            <!-- Floating Actions (Right Side) -->
            <div class="floating-actions">
              <button
                type="button"
                class="tool-btn {opt.isYesNo ? 'active' : ''}"
                onclick={(e) => { e.stopPropagation(); onToggleYesNo?.(opt.id); }}
                aria-label="Toggle Sí/No"
                title="Sí/No"
              >
                <Ban size={18} />
              </button>
              <button
                type="button"
                class="tool-btn {opt.isCorrect || opt.correctAnswer ? 'active' : ''}"
                onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id); }}
                aria-label="Marcar correcta"
                title={opt.isCorrect || opt.correctAnswer ? 'Opción correcta' : 'Marcar como correcta'}
              >
                <CircleCheck size={18} />
              </button>
              <button
                type="button"
                class="tool-btn"
                onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                aria-label="Cambiar color"
                title="Color"
              >
                <Palette size={18} />
              </button>
              <button
                type="button"
                class="tool-btn sparkles-btn"
                onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                aria-label="Buscar GIF"
                title="GIF"
              >
                <Sparkles size={18} />
              </button>
              {#if options.length > 2}
                <button
                  type="button"
                  class="tool-btn danger-btn"
                  onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                  aria-label="Eliminar opción"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              {/if}
            </div>

            <!-- Content Area -->
            <div 
              class="card-content" 
              onclick={() => inputRef?.focus()}
              onkeydown={(e) => e.key === 'Enter' && inputRef?.focus()}
              role="textbox"
              tabindex="0"
            >
              <!-- Spacer -->
              <div class="spacer"></div>

              <!-- Text Input -->
              <textarea
                bind:this={inputRef}
                class="card-textarea"
                placeholder="Escribe aquí..."
                value={optLabelText}
                oninput={(e) => handleOptionTextChange(opt.id, e.currentTarget.value)}
                rows={2}
                maxlength={200}
              ></textarea>

              <!-- Character Count -->
              <div class="char-count">
                <span>{optLabelText.length}/200</span>
              </div>

              <!-- Divider & Options - Solo si isYesNo está activo -->
                {#if opt.isYesNo}
                <!-- Mensaje de correcta centrado -->
                {#if opt.correctAnswer}
                  <div class="yesno-correct-label" transition:fly={{ y: 10, duration: 200 }}>
                    <CircleCheck size={10} />
                    <span>"{opt.correctAnswer === 'yes' ? (opt.yesText || 'Sí') : (opt.noText || 'No')}" es correcta</span>
                  </div>
                {/if}

                <div class="divider" transition:fly={{ y: 10, duration: 200 }}></div>

                <div class="options-row" transition:fly={{ y: 10, duration: 200 }}>
                  <!-- Option Yes -->
                  <button
                    type="button"
                    class="option-btn {opt.correctAnswer === 'yes' ? 'selected' : ''}"
                    onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'yes'); }}
                  >
                    {#if opt.isCorrect}
                      <div class="option-selector {opt.correctAnswer === 'yes' ? 'selected' : ''}">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    {/if}
                    <div class="option-content">
                      <input
                        type="text"
                        class="option-input"
                        placeholder="👍 Sí"
                        value={opt.yesText || ''}
                        oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, e.currentTarget.value, opt.noText || ''); }}
                        onclick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </button>

                  <!-- Option No -->
                  <button
                    type="button"
                    class="option-btn {opt.correctAnswer === 'no' ? 'selected' : ''}"
                    onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'no'); }}
                  >
                    {#if opt.isCorrect}
                      <div class="option-selector {opt.correctAnswer === 'no' ? 'selected' : ''}">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    {/if}
                    <div class="option-content">
                      <input
                        type="text"
                        class="option-input"
                        placeholder="👎 No"
                        value={opt.noText || ''}
                        oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, opt.yesText || '', e.currentTarget.value); }}
                        onclick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </button>
                </div>
              {/if}

              <!-- Mensaje de opción correcta sin Sí/No -->
              {#if !opt.isYesNo && opt.isCorrect}
                <div class="correct-answer-hint" transition:fly={{ y: 10, duration: 200 }}>
                  <CircleCheck size={12} />
                  <span>Esta opción es correcta</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </main>

  <!-- BOTTOM TOOLS -->
  <div class="bottom-tools">
    <div class="type-buttons">
      {#each pollTypes as type}
        <button
          type="button"
          class="type-btn {pollType === type.id ? 'active' : ''} {type.id === 'collaborative' ? 'purple' : ''}"
          onclick={() => { onChangePollType?.(type.id); onOpenTypeOptionsModal?.(); }}
          aria-label="Tipo: {type.label}"
          title={type.label}
        >
          {#if type.icon === 'circle'}
            <Circle size={20} />
          {:else if type.icon === 'check-square'}
            <Square size={20} />
          {:else if type.icon === 'users'}
            <Users size={20} />
          {/if}
        </button>
      {/each}
      
      <!-- Animate button -->
      {#if canAnimateCards}
        <button
          type="button"
          class="type-btn active purple"
          onclick={() => onAnimateCards?.()}
          disabled={isAnimatingCards}
          aria-label="Animar con GIFs"
          title="Animar con GIFs"
        >
          {#if isAnimatingCards}
            <Loader2 size={20} class="spinning" />
          {:else}
            <Sparkles size={20} />
          {/if}
        </button>
      {/if}
      
      <!-- Minimize button -->
      <button
        type="button"
        class="type-btn"
        onclick={onClose}
        aria-label="Minimizar"
        title="Minimizar"
      >
        <Maximize2 size={20} />
      </button>
      
      <!-- Add option button -->
      {#if canAddOption}
        <button
          type="button"
          class="type-btn"
          onclick={() => onAddOption?.()}
          aria-label="Añadir opción"
          title="Añadir opción"
        >
          <Plus size={20} />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .poll-editor-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2147483640;
    display: flex;
    flex-direction: column;
    background: #0F1115;
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
    max-width: 100%;
    margin: 0 auto;
  }

  @media (min-width: 768px) {
    .poll-editor-fullscreen {
      max-width: 700px;
    }
  }

  /* QUESTION AREA */
  .question-area {
    padding: 0 24px;
    padding-top: max(24px, env(safe-area-inset-top));
    flex-shrink: 0;
  }

  .question-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .question-content {
    flex: 1;
  }

  .question-placeholder {
    font-size: 30px;
    font-weight: 700;
    color: #64748b;
    margin: 0 0 8px 0;
  }

  .config-badges {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .config-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }

  .config-badge:hover {
    color: #94a3b8;
  }

  .config-badge :global(svg) {
    opacity: 0.7;
  }

  .config-badge :global(.chevron) {
    opacity: 0.5;
    transition: transform 0.2s;
  }

  .config-badge :global(.chevron.open) {
    transform: rotate(180deg);
  }

  .badge-separator {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #334155;
  }

  .help-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-left: 8px;
  }

  .help-btn {
    padding: 8px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .help-btn.info-btn {
    background: rgba(30, 41, 59, 0.5);
    color: #64748b;
  }

  .help-btn.info-btn:hover {
    background: rgba(30, 41, 59, 0.8);
    color: #94a3b8;
  }

  .help-btn.question-btn {
    background: rgba(79, 70, 229, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .help-btn.question-btn:hover {
    background: rgba(79, 70, 229, 0.25);
  }

  /* Progress Indicators */
  .progress-indicators {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 24px;
  }

  .indicator {
    height: 4px;
    width: 48px;
    border-radius: 9999px;
    background: var(--indicator-color);
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 0 10px color-mix(in srgb, var(--indicator-color) 50%, transparent);
  }

  .indicator.active {
    transform: scaleY(1.5);
  }

  /* CARD CANVAS */
  .card-canvas {
    flex: 1;
    position: relative;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }

  .cards-scroll {
    display: flex;
    overflow-x: scroll;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    scroll-behavior: smooth;
  }

  .cards-scroll::-webkit-scrollbar {
    display: none;
  }

  .card-slide {
    flex-shrink: 0;
    width: 100%;
    scroll-snap-align: center;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .main-card {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--card-gradient);
    border-radius: 32px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    padding: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .card-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background: radial-gradient(circle at center, white, transparent);
    pointer-events: none;
  }

  /* Media Background */
  .media-background {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 32px;
    overflow: hidden;
  }

  .media-background :global(.media-embed),
  .media-background :global(.embed-container),
  .media-background :global(img),
  .media-background :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }

  .media-gradient {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.5) 40%, transparent 100%);
    pointer-events: none;
  }

  .remove-media-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    padding: 10px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
  }

  .remove-media-btn:hover {
    background: rgba(239, 68, 68, 0.5);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* Floating Actions */
  .floating-actions {
    position: absolute;
    bottom: 112px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 20;
  }

  .tool-btn {
    padding: 8px;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    border: none;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-btn:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  .tool-btn.active {
    background: white;
    color: #ec4899;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transform: scale(1.1);
  }

  .tool-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .tool-btn.danger-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .tool-btn.sparkles-btn {
    opacity: 0.8;
  }

  .tool-btn.sparkles-btn:hover {
    opacity: 1;
  }

  /* Card Content */
  .card-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-top: 16px;
  }

  .spacer {
    flex: 1;
    cursor: text;
  }

  .card-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: white;
    font-size: 36px;
    font-weight: 700;
    line-height: 1.2;
    padding: 0;
    padding-right: 48px;
    margin-bottom: 4px;
  }

  .card-textarea::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .char-count {
    padding-left: 4px;
    padding-bottom: 8px;
  }

  .char-count span {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 700;
  }

  .divider {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin-bottom: 16px;
  }

  /* Options Row */
  .options-row {
    display: flex;
    gap: 12px;
    margin-bottom: 4px;
  }

  .option-btn {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: white;
    border: 2px solid transparent;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
  }

  .option-btn:hover {
    border-color: rgba(236, 72, 153, 0.2);
  }

  .option-btn.selected {
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  }

  .option-selector {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s;
    z-index: 10;
  }

  .option-selector.selected {
    background: #22c55e;
    border-color: #22c55e;
    color: white;
  }

  .option-btn:hover .option-selector:not(.selected) {
    border-color: #86efac;
  }

  .option-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding-right: 4px;
  }

  .option-content :global(.thumbs-up) {
    color: #22c55e;
    fill: #dcfce7;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .option-content :global(.thumbs-down) {
    color: #ef4444;
    fill: #fee2e2;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .option-input {
    width: 100%;
    background: #f1f5f9;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px 12px;
    font-weight: 700;
    font-size: 16px;
    color: #334155;
    outline: none;
    transition: all 0.2s;
  }

  .option-input::placeholder {
    color: #94a3b8;
  }

  .option-input:hover {
    background: #e2e8f0;
  }

  .option-input:focus {
    background: white;
    border-color: rgba(34, 197, 94, 0.5);
  }

  /* BOTTOM TOOLS */
  .bottom-tools {
    padding: 0 16px 16px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    flex-shrink: 0;
  }

  .type-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .type-buttons::-webkit-scrollbar {
    display: none;
  }

  .type-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #334155;
    background: rgba(30, 41, 59, 0.5);
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .type-btn:hover {
    border-color: #475569;
    color: #94a3b8;
  }

  .type-btn.active {
    background: #ec4899;
    border-color: #ec4899;
    color: white;
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.5);
  }

  .type-btn.active.purple {
    background: #6366f1;
    border-color: #6366f1;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
  }

  .type-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Etiqueta de respuesta correcta (con Sí/No) */
  .yesno-correct-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    margin-bottom: 8px;
  }

  .yesno-correct-label :global(svg) {
    flex-shrink: 0;
  }

  /* Mensaje de opción correcta (sin Sí/No) */
  .correct-answer-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    margin-top: 12px;
  }

  .correct-answer-hint :global(svg) {
    flex-shrink: 0;
  }
</style>
