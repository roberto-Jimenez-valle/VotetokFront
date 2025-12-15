<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  const { poll, theme, compact, baseUrl } = data;
  
  let selectedOption: string | null = null;
  let hasVoted = false;
  let isVoting = false;
  
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
  <!-- Header con logo -->
  <header class="embed-header">
    <button class="logo-link" onclick={openFullPoll} title="Abrir en VouTop">
      <img src="{baseUrl}/logo_min.png" alt="VouTop" class="logo-img" />
    </button>
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
  </header>
  
  <!-- Título -->
  <h1 class="poll-title">{poll.title}</h1>
  
  <!-- Opciones -->
  <div class="options-list">
    {#each poll.options as option}
      <button 
        class="option-btn"
        class:selected={selectedOption === option.key}
        class:voted={hasVoted}
        disabled={isVoting}
        onclick={() => handleVote(option.key)}
      >
        <div class="option-bar" style="width: {hasVoted ? option.percentage : 0}%; background-color: {option.color};"></div>
        <span class="option-text">{option.text}</span>
        {#if hasVoted}
          <span class="option-percent">{option.percentage}%</span>
        {/if}
      </button>
    {/each}
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
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  
  .embed-container.compact .option-btn {
    padding: 8px 12px;
    font-size: 12px;
  }
  
  /* Header */
  .embed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .poll-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .user-info {
    display: flex;
    flex-direction: column;
  }
  
  .username {
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .verified {
    color: #3b82f6;
    font-size: 12px;
  }
  
  .votes-count {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .logo-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: transform 0.2s, opacity 0.2s;
    display: flex;
    align-items: center;
  }
  
  .logo-link:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }
  
  .logo-img {
    height: 32px;
    width: auto;
    object-fit: contain;
  }
  
  .embed-container.compact .logo-img {
    height: 24px;
  }
  
  /* Título */
  .poll-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
  }
  
  /* Opciones */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  
  .option-btn {
    position: relative;
    width: 100%;
    padding: 14px 16px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  
  .dark .option-btn {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }
  
  .light .option-btn {
    background: rgba(0, 0, 0, 0.05);
    color: #1a1a2e;
  }
  
  .option-btn:not(:disabled):hover {
    transform: scale(1.01);
  }
  
  .dark .option-btn:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.12);
  }
  
  .light .option-btn:not(:disabled):hover {
    background: rgba(0, 0, 0, 0.08);
  }
  
  .option-btn:disabled {
    cursor: default;
  }
  
  .option-btn.selected {
    box-shadow: 0 0 0 2px #6366f1;
  }
  
  .option-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-radius: 12px;
    opacity: 0.3;
    transition: width 0.5s ease-out;
  }
  
  .option-text {
    position: relative;
    z-index: 1;
  }
  
  .option-percent {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-weight: 700;
    font-size: 14px;
    z-index: 1;
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
