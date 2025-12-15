<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  const { poll, theme, compact, baseUrl } = data;
  
  let selectedOption: string | null = null;
  let hasVoted = false;
  let isVoting = false;
  let currentCardIndex = 0;
  let scrollContainer: HTMLElement;
  
  // Calcular el índice de tarjeta visible durante el scroll
  function handleScroll() {
    if (!scrollContainer) return;
    const cardWidth = scrollContainer.offsetWidth * 0.75; // 75% del ancho
    const scrollLeft = scrollContainer.scrollLeft;
    currentCardIndex = Math.round(scrollLeft / cardWidth);
  }
  
  // Navegar a una tarjeta específica
  function goToCard(index: number) {
    if (!scrollContainer) return;
    const cardWidth = scrollContainer.offsetWidth * 0.75;
    scrollContainer.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    });
    currentCardIndex = index;
  }
  
  // Formatear números
  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
  
  // Manejar voto
  async function handleVote(optionKey: string) {
    if (hasVoted || isVoting) return;
    
    selectedOption = optionKey;
    isVoting = true;
    
    try {
      const response = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionKey }),
        credentials: 'include'
      });
      
      if (response.ok) {
        hasVoted = true;
        // Incrementar voto localmente
        const option = poll.options.find(o => o.key === optionKey);
        if (option) {
          option.votes++;
          poll.totalVotes++;
          // Recalcular porcentajes
          poll.options = poll.options.map(o => ({
            ...o,
            percentage: poll.totalVotes > 0 ? Math.round((o.votes / poll.totalVotes) * 100) : 0
          }));
        }
      } else {
        // Si falla (ej: no autenticado), abrir en nueva pestaña
        window.open(`${baseUrl}/poll/${poll.id}`, '_blank');
      }
    } catch (e) {
      window.open(`${baseUrl}/poll/${poll.id}`, '_blank');
    } finally {
      isVoting = false;
    }
  }
  
  // Abrir encuesta completa
  function openFullPoll() {
    window.open(`${baseUrl}/poll/${poll.id}`, '_blank');
  }
</script>

<svelte:head>
  <title>{poll.title} - VouTop Embed</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="embed-container {theme}" class:compact>
  <!-- Header: Usuario izquierda, Logo derecha -->
  <header class="embed-header">
    <div class="poll-info">
      {#if poll.user?.avatarUrl}
        <img src={poll.user.avatarUrl} alt="" class="avatar" />
      {/if}
      <div class="user-info">
        <span class="username">
          {poll.user?.displayName || poll.user?.username || 'Usuario'}
          {#if poll.user?.verified}
            <span class="verified">✓</span>
          {/if}
        </span>
        <span class="votes-count">{formatNumber(poll.totalVotes)} votos</span>
      </div>
    </div>
    <button class="logo-link" onclick={openFullPoll} title="Abrir en VouTop">
      <img src="{baseUrl}/logo_min.png" alt="VouTop" class="logo-img" />
    </button>
  </header>
  
  <!-- Título -->
  <h1 class="poll-title">{poll.title}</h1>
  
  <!-- Opciones como tarjetas estilo OG Image con scroll horizontal -->
  <div class="options-scroll-wrapper">
    <div 
      class="options-scroll" 
      bind:this={scrollContainer}
      onscroll={handleScroll}
    >
      {#each poll.options as option, index}
        <button 
          class="option-card"
          class:selected={selectedOption === option.key}
          class:voted={hasVoted}
          disabled={isVoting}
          style="--card-color: {option.color}; background: {option.color};"
          onclick={() => handleVote(option.key)}
        >
          <!-- Comilla superior -->
          <span class="quote-top">"</span>
          
          <!-- Texto centrado -->
          <div class="card-text-wrapper">
            <span class="card-text">{option.text}</span>
          </div>
          
          <!-- Comilla inferior -->
          <span class="quote-bottom">"</span>
          
          <!-- Separador y porcentaje -->
          <div class="card-footer">
            <div class="separator-line"></div>
            <div class="vote-stats">
              <span class="percentage">{hasVoted ? option.percentage : 0}%</span>
              <span class="votes-label">DE LOS VOTOS</span>
            </div>
          </div>
          
          {#if selectedOption === option.key}
            <div class="selected-check">✓</div>
          {/if}
        </button>
      {/each}
    </div>
    
    <!-- Indicadores de paginación -->
    {#if poll.options.length > 1}
      <div class="scroll-indicators">
        {#each poll.options as _, index}
          <button 
            class="indicator-dot"
            class:active={currentCardIndex === index}
            onclick={() => goToCard(index)}
            aria-label="Ir a opción {index + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Footer -->
  <footer class="embed-footer">
    <button class="votetok-link" onclick={openFullPoll}>
      <span class="logo-text">VouTop</span>
      <span class="cta">Votar</span>
    </button>
  </footer>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .embed-container {
    width: 100%;
    min-height: 100vh;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }
  
  /* Tema oscuro (default) */
  .embed-container.dark {
    background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
    color: white;
  }
  
  /* Tema claro */
  .embed-container.light {
    background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
    color: #1a1a2e;
  }
  
  /* Versión compacta */
  .embed-container.compact {
    padding: 12px;
    gap: 8px;
  }
  
  .embed-container.compact .poll-title {
    font-size: 14px;
  }
  
  /* Header */
  .embed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  
  .poll-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  
  .user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .username {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .verified {
    color: #3b82f6;
    font-size: 11px;
    flex-shrink: 0;
  }
  
  .votes-count {
    font-size: 11px;
    opacity: 0.7;
  }
  
  .logo-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 6px;
    transition: transform 0.2s, opacity 0.2s;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  
  .logo-link:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }
  
  .logo-img {
    height: 24px;
    width: auto;
    object-fit: contain;
  }
  
  .embed-container.compact .logo-img {
    height: 20px;
  }
  
  /* Título */
  .poll-title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  /* Opciones con scroll horizontal - Estilo OG Image */
  .options-scroll-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
  
  .options-scroll {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    padding: 12px 8px;
    scrollbar-width: none;
  }
  
  .options-scroll::-webkit-scrollbar {
    display: none;
  }
  
  .option-card {
    flex: 0 0 75%;
    min-width: 75%;
    scroll-snap-align: center;
    position: relative;
    display: flex;
    flex-direction: column;
    border: none;
    border-radius: 16px;
    padding: 14px 18px;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    min-height: 150px;
    color: white;
    text-align: center;
    box-shadow: 6px 6px 16px rgba(0,0,0,0.4);
  }
  
  .option-card:not(:disabled):hover {
    transform: scale(1.02) translateY(-4px);
  }
  
  .option-card:disabled {
    cursor: default;
  }
  
  .option-card.selected {
    box-shadow: 0 0 0 4px white, 8px 8px 24px rgba(0,0,0,0.5);
  }
  
  /* Comillas decorativas */
  .quote-top {
    position: absolute;
    top: 10px;
    left: 14px;
    font-family: Georgia, serif;
    font-size: 32px;
    opacity: 0.25;
    line-height: 1;
    color: white;
  }
  
  .quote-bottom {
    position: absolute;
    bottom: 50px;
    right: 14px;
    font-family: Georgia, serif;
    font-size: 32px;
    opacity: 0.25;
    line-height: 1;
    color: white;
  }
  
  /* Texto central */
  .card-text-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 12px 12px;
    position: relative;
    z-index: 2;
  }
  
  .card-text {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.5;
    color: white;
    text-align: center;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  
  /* Footer con porcentaje */
  .card-footer {
    margin-top: auto;
  }
  
  .separator-line {
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
  }
  
  .vote-stats {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  
  .percentage {
    font-size: 20px;
    font-weight: 800;
    color: white;
  }
  
  .votes-label {
    font-size: 9px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.5px;
  }
  
  /* Check de selección */
  .selected-check {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: var(--card-color);
  }
  
  /* Indicadores de paginación */
  .scroll-indicators {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 8px 0;
  }
  
  .indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }
  
  .dark .indicator-dot {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .light .indicator-dot {
    background: rgba(0, 0, 0, 0.2);
  }
  
  .indicator-dot.active {
    width: 24px;
    border-radius: 4px;
  }
  
  .dark .indicator-dot.active {
    background: white;
  }
  
  .light .indicator-dot.active {
    background: #1a1a2e;
  }
  
  /* Versión compacta */
  .embed-container.compact .option-card {
    min-height: 160px;
    padding: 16px 20px;
  }
  
  .embed-container.compact .quote-top,
  .embed-container.compact .quote-bottom {
    font-size: 36px;
  }
  
  .embed-container.compact .card-text {
    font-size: 15px;
  }
  
  .embed-container.compact .percentage {
    font-size: 22px;
  }
  
  /* Footer */
  .embed-footer {
    margin-top: auto;
    padding-top: 8px;
  }
  
  .votetok-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
  }
  
  .votetok-link:hover {
    transform: scale(1.02);
    opacity: 0.95;
  }
  
  .logo-text {
    font-weight: 800;
  }
  
  .cta {
    opacity: 0.9;
  }
</style>
