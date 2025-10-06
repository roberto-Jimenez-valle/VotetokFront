<script lang="ts">
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
  };

  let { poll = null } = $props<{ poll: Poll | null }>();
  
  let expanded = $state(false);

  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Debug: Log cuando cambia poll
  $effect(() => {
        if (poll) {
                }
  });

  // Calcular porcentajes usando $derived
  let totalVotes = $derived(poll?.options.reduce((sum: number, opt: PollOption) => sum + opt.votes, 0) || 0);
  let optionsWithPct = $derived(poll?.options.map((opt: PollOption) => ({
    ...opt,
    pct: totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0
  })) || []);
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
    onclick={toggleExpanded}
    aria-expanded={expanded}
    aria-label="Ver opciones de la encuesta"
  >
    <div class="options-bar">
      {#each optionsWithPct as option}
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

  <!-- Opciones expandidas -->
  {#if expanded}
  <div class="options-expanded">
    {#each optionsWithPct.sort((a: any, b: any) => b.pct - a.pct) as option}
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
  </div>
  {/if}
</div>
{/if}

<style>
  .poll-options-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 45; /* Por encima del BottomSheet pero debajo del header */
    background: linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255,255,255,0.1);
    padding: 12px 16px;
    animation: slideUp 0.3s ease;
    transform: translateY(0);
    transition: transform 0.3s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
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
    transition: opacity 0.2s ease;
  }

  .options-bar-container:hover .option-segment {
    opacity: 0.8;
  }

  .expand-icon {
    color: #9ca3af;
    font-size: 12px;
    transition: transform 0.3s ease;
  }

  .options-expanded {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: expandDown 0.3s ease;
  }

  @keyframes expandDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 500px;
    }
  }

  .option-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
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
</style>
