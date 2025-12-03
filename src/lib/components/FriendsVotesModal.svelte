<script lang="ts">
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X } from 'lucide-svelte';

  interface Friend {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
    optionKey?: string;
  }

  interface PollOption {
    id: string;
    key: string;
    label: string;
    color: string;
    votes?: number;
  }

  interface Props {
    isOpen: boolean;
    pollTitle: string;
    options: PollOption[];
    friendsByOption: Record<string, Friend[]>;
    onClose: () => void;
  }

  let { 
    isOpen = $bindable(false), 
    pollTitle = '',
    options = [],
    friendsByOption = {},
    onClose 
  }: Props = $props();

  const DEFAULT_AVATAR = '/default-avatar.png';

  // Estado del filtro activo (null = todos)
  let activeFilter = $state<string | null>(null);

  // Contar total de amigos que votaron
  let totalFriendsCount = $derived.by(() => {
    let count = 0;
    for (const opt of options) {
      const optionFriends = friendsByOption[opt.id] || friendsByOption[opt.key] || [];
      count += optionFriends.length;
    }
    return count;
  });

  // Crear lista de todos los amigos con su voto (filtrado)
  let allFriendsWithVotes = $derived.by(() => {
    const friends: Array<Friend & { option: PollOption }> = [];
    
    for (const opt of options) {
      // Si hay filtro activo, solo incluir amigos de esa opción
      if (activeFilter !== null && opt.id !== activeFilter && opt.key !== activeFilter) {
        continue;
      }
      
      const optionFriends = friendsByOption[opt.id] || friendsByOption[opt.key] || [];
      for (const friend of optionFriends) {
        friends.push({
          ...friend,
          option: opt
        });
      }
    }
    
    return friends;
  });

  function setFilter(optionId: string | null) {
    activeFilter = optionId;
  }

  function handleClose() {
    isOpen = false;
    activeFilter = null; // Resetear filtro al cerrar
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  // Bloquear scroll del body cuando el modal está abierto
  $effect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Prevenir propagación del scroll
  function handleWheel(e: WheelEvent) {
    e.stopPropagation();
  }

  function handleTouchMove(e: TouchEvent) {
    e.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div 
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
  >
    <!-- Modal Content -->
    <div 
      class="modal-content"
      onwheel={handleWheel}
      ontouchmove={handleTouchMove}
      transition:fly={{ y: 300, duration: 300, easing: cubicOut }}
    >
      <!-- Handle -->
      <div class="modal-handle"></div>

      <!-- Header -->
      <div class="modal-header">
        <div class="header-info">
          <h2 id="modal-title" class="modal-title">Votos de amigos</h2>
          <p class="modal-subtitle">{pollTitle}</p>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>

      <!-- Options Summary (Horizontal Scroll) -->
      <div class="options-scroll-container">
        <div class="options-summary">
          <!-- Tag "Todos" -->
          <button 
            class="option-chip" 
            class:active={activeFilter === null}
            onclick={() => setFilter(null)}
            type="button"
          >
            <span class="option-label">Todos</span>
            <span class="option-count">{totalFriendsCount}</span>
          </button>
          
          {#each options as opt}
            {@const friends = friendsByOption[opt.id] || friendsByOption[opt.key] || []}
            {#if friends.length > 0}
              <button 
                class="option-chip" 
                class:active={activeFilter === opt.id || activeFilter === opt.key}
                onclick={() => setFilter(opt.id)}
                type="button"
              >
                <span class="option-dot" style="background-color: {opt.color}"></span>
                <span class="option-label">{opt.label}</span>
                <span class="option-count">{friends.length}</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Friends List -->
      <div class="friends-list">
        {#each allFriendsWithVotes as friend, idx}
          <div 
            class="friend-item"
            in:fly={{ y: 20, delay: idx * 50, duration: 200 }}
          >
            <div class="friend-avatar-container">
              <img 
                src={friend.avatarUrl || DEFAULT_AVATAR} 
                alt={friend.name}
                class="friend-avatar"
              />
              <div 
                class="vote-indicator"
                style="background-color: {friend.option.color}"
              ></div>
            </div>
            
            <span class="friend-name">{friend.name}</span>
            
            <span 
              class="friend-option-badge"
              style="background-color: {friend.option.color}20; color: {friend.option.color}; border-color: {friend.option.color}40"
            >
              {friend.option.label}
            </span>
          </div>
        {/each}

        {#if allFriendsWithVotes.length === 0}
          <div class="empty-state">
            <p>Ningún amigo ha votado en esta encuesta todavía</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 2147483647;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .modal-content {
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    border-radius: 24px 24px 0 0;
    padding: 12px 0 2px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .modal-handle {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    margin: 0 auto 16px;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 0 20px;
  }

  .header-info {
    flex: 1;
  }

  .modal-title {
    font-size: 20px;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .modal-subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 4px 0 0;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .options-scroll-container {
    flex-shrink: 0;
    margin: 0 20px 16px 20px;
    padding: 4px 0 16px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .options-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .options-summary {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .option-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .option-chip:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .option-chip.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .option-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    min-height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  .option-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .option-count {
    font-size: 11px;
    font-weight: 700;
    color: white;
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .friends-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 20px 12px 20px;
    overscroll-behavior: contain;
  }

  .friends-list::-webkit-scrollbar {
    width: 4px;
  }

  .friends-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .friends-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .friend-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    transition: background 0.2s;
  }

  .friend-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .friend-avatar-container {
    position: relative;
    flex-shrink: 0;
  }

  .friend-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .vote-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid #1a1a1a;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .friend-name {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friend-option-badge {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid;
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
  }

  .empty-state p {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  /* Desktop */
  @media (min-width: 640px) {
    .modal-content {
      border-radius: 24px;
      margin-bottom: 40px;
      max-height: 70vh;
    }
  }
</style>
