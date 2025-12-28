<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    X,
    Bell,
    Heart,
    MessageCircle,
    UserPlus,
    TrendingUp,
    Check,
    FileText,
  } from "lucide-svelte";
  import { createEventDispatcher, onMount } from "svelte";
  import UserProfileModal from "$lib/UserProfileModal.svelte";
  import {
    markImageFailed,
    shouldRetryImage,
  } from "$lib/stores/failed-images-store";
  import { notificationCounts } from "$lib/stores/notifications";

  const dispatch = createEventDispatcher();

  interface Props {
    isOpen?: boolean;
  }

  let { isOpen = $bindable(false) }: Props = $props();

  // Estado para modal de perfil
  let isProfileModalOpen = $state(false);
  let selectedUserId = $state<number | null>(null);

  // Swipe handlers para cerrar modal
  let modalTouchStartY = 0;
  let scrollContainer: HTMLElement | null = $state(null);

  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }

  function handleModalSwipeMove(e: TouchEvent) {
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;

    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 100) {
      closeModal();
    }
  }

  let filterTab = $state<"all" | "mentions" | "votes" | "follows" | "messages">(
    "all",
  );
  let notifications = $state<any[]>([]);
  let loading = $state(false);

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return "Ahora mismo";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    return `hace ${Math.floor(diff / 86400)} días`;
  }

  async function loadNotifications() {
    if (!isOpen) return;
    loading = true;
    try {
      const res = await fetch(`/api/notifications?filter=${filterTab}`);
      const result = await res.json();
      if (result.success) {
        if (result.counts) {
          notificationCounts.set(result.counts);
        }
        notifications = result.data.map((n: any) => {
          let icon = TrendingUp; // Default
          // Map icons based on type
          if (n.type === "VOTE") icon = TrendingUp;
          else if (n.type === "LIKE") icon = Heart;
          else if (n.type === "COMMENT") icon = MessageCircle;
          else if (n.type === "MENTION") icon = MessageCircle;
          else if (n.type === "NEW_FOLLOWER" || n.type === "FOLLOW_REQUEST")
            icon = UserPlus;
          else if (n.type === "SYSTEM") icon = FileText;
          else if (n.type === "MESSAGE") icon = MessageCircle;

          const meta = n.data || {};

          return {
            id: n.id,
            type: n.type.toLowerCase(),
            icon,
            user: {
              name: n.actor?.displayName || n.actor?.username || "Sistema",
              avatar: n.actor?.avatarUrl || null,
              id: n.actor?.id,
            },
            message: n.message || "Nueva notificación",
            poll: meta.pollTitle || meta.title,
            pollId: meta.pollId || meta.id,
            commentId: meta.commentId,
            time: formatRelativeTime(n.createdAt),
            read: n.read,
            link: meta.link,
          };
        });
      }
    } catch (e) {
      console.error("Error loading notifications:", e);
    } finally {
      loading = false;
    }
  }

  // Effect to load notifications when open or filter changes
  $effect(() => {
    if (isOpen) {
      // Verify filterTab dependency is tracked
      const _ = filterTab;
      loadNotifications();
    }
  });

  function closeModal() {
    isOpen = false;
  }

  // Manejar botón atrás del navegador
  let historyPushed = false;

  $effect(() => {
    if (isOpen && !historyPushed) {
      history.pushState({ modal: "notifications" }, "");
      historyPushed = true;
    } else if (!isOpen) {
      historyPushed = false;
    }
  });

  onMount(() => {
    const handlePopState = () => {
      if (isOpen) {
        closeModal();
      }
    };

    const handleCloseModals = () => {
      if (isOpen) {
        closeModal();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("closeModals", handleCloseModals);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("closeModals", handleCloseModals);
    };
  });

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ all: true }),
      });
      // Optimistic update
      notifications = notifications.map((n) => ({ ...n, read: true }));
      // Update global store
      notificationCounts.set({
        all: 0,
        mentions: 0,
        votes: 0,
        follows: 0,
        messages: 0,
      });
    } catch (e) {
      console.error("Error marking read", e);
    }
  }

  function handleNotificationClick(notification: any) {
    if (notification.link) {
      window.location.href = notification.link;
      return;
    }
    // Si no es leída, marcar como leída individualmente
    if (!notification.read) {
      fetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id: notification.id }),
      });
      notifications = notifications.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n,
      );
      // Decrement visible count conservatively
      notificationCounts.update((c) => ({ ...c, all: Math.max(0, c.all - 1) }));
    }

    console.log("Abrir notificación:", notification.id);
    dispatch("notificationClick", {
      notificationId: notification.id,
      pollId: notification.pollId,
      userId: notification.user?.id,
      type: notification.type,
      commentId: notification.commentId,
      pollTitle: notification.poll,
    });
    isOpen = false;
  }

  function handleAvatarClick(userId: number, event: Event) {
    if (!userId) return;
    event.stopPropagation();
    selectedUserId = userId;
    isProfileModalOpen = true;
    // Cerrar el modal de notificaciones cuando se abre el perfil
    isOpen = false;
  }
</script>

{#if isOpen}
  <!-- Overlay -->
  <div
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    onclick={closeModal}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Escape" && closeModal()}
  ></div>

  <!-- Modal -->
  <div
    class="modal-container"
    transition:fly={{ y: "100%", duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="notifications-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-header-content">
        <Bell size={24} />
        <h2 id="notifications-modal-title">Notificaciones</h2>
        {#if $notificationCounts.all > 0}
          <span class="notification-badge">{$notificationCounts.all}</span>
        {/if}
      </div>
      <div class="header-actions">
        <button
          onclick={markAllAsRead}
          class="mark-read-btn"
          aria-label="Marcar todas como leídas"
        >
          <Check size={18} />
        </button>
        <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
          <X size={24} />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="modal-content">
      <!-- Filtros -->
      <div class="filter-tabs">
        <button
          class="filter-tab"
          class:active={filterTab === "all"}
          onclick={() => (filterTab = "all")}
        >
          Todas
          {#if $notificationCounts.all > 0}<span class="tab-badge"
              >{$notificationCounts.all}</span
            >{/if}
        </button>
        <button
          class="filter-tab"
          class:active={filterTab === "mentions"}
          onclick={() => (filterTab = "mentions")}
        >
          Menciones
          {#if $notificationCounts.mentions > 0}<span class="tab-badge"
              >{$notificationCounts.mentions}</span
            >{/if}
        </button>
        <button
          class="filter-tab"
          class:active={filterTab === "votes"}
          onclick={() => (filterTab = "votes")}
        >
          Votos
          {#if $notificationCounts.votes > 0}<span class="tab-badge"
              >{$notificationCounts.votes}</span
            >{/if}
        </button>
        <button
          class="filter-tab"
          class:active={filterTab === "follows"}
          onclick={() => (filterTab = "follows")}
        >
          Seguidores
          {#if $notificationCounts.follows > 0}<span class="tab-badge"
              >{$notificationCounts.follows}</span
            >{/if}
        </button>
        <button
          class="filter-tab"
          class:active={filterTab === "messages"}
          onclick={() => (filterTab = "messages")}
        >
          Mensajes
          {#if $notificationCounts.messages > 0}<span class="tab-badge"
              >{$notificationCounts.messages}</span
            >{/if}
        </button>
      </div>

      <!-- Lista de notificaciones -->
      <div class="notifications-list" bind:this={scrollContainer}>
        {#each notifications as notification (notification.id)}
          <div class="notification-item" class:unread={!notification.read}>
            <div
              class="notification-avatar"
              onclick={(e) => handleAvatarClick(notification.id, e)}
              role="button"
              tabindex="0"
              aria-label="Ver perfil de {notification.user.name}"
              onkeydown={(e) =>
                e.key === "Enter" && handleAvatarClick(notification.id, e)}
            >
              <img
                src={shouldRetryImage(notification.user.avatar)
                  ? notification.user.avatar
                  : "/default-avatar.svg"}
                alt={notification.user.name}
                onerror={(e: Event) => {
                  if (e.target) {
                    (e.target as HTMLImageElement).src = "/default-avatar.svg";
                    markImageFailed(notification.user.avatar);
                  }
                }}
              />
              <div
                class="notification-icon"
                class:vote={notification.type === "vote"}
                class:like={notification.type === "like"}
                class:follow={notification.type === "follow"}
                class:comment={notification.type === "comment"}
              >
                {#if notification.icon}
                  {@const Icon = notification.icon}
                  <Icon size={14} />
                {/if}
              </div>
            </div>

            <div
              class="notification-content"
              onclick={() => handleNotificationClick(notification)}
              role="button"
              tabindex="0"
              onkeydown={(e) =>
                e.key === "Enter" && handleNotificationClick(notification)}
            >
              <div class="notification-text">
                <strong>{notification.user.name}</strong>
                {notification.message}
                {#if notification.poll}
                  <span class="notification-poll">{notification.poll}</span>
                {/if}
              </div>
              <div class="notification-time">{notification.time}</div>
            </div>

            {#if !notification.read}
              <div class="unread-dot"></div>
            {/if}
          </div>
        {/each}
      </div>

      {#if notifications.length === 0}
        <div class="empty-state">
          <Bell size={48} />
          <p>No tienes notificaciones</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Modal de perfil de usuario -->
  <UserProfileModal
    bind:isOpen={isProfileModalOpen}
    bind:userId={selectedUserId}
    onStatsClick={(detail) => dispatch("statsClick", detail)}
    onComment={(detail) => dispatch("comment", detail)}
    onShare={(detail) => dispatch("share", detail)}
    onRepost={(detail) => dispatch("repost", detail)}
    onFollowChange={(detail) => dispatch("followChange", detail)}
    onOpenOptions={(detail) => dispatch("openOptions", detail)}
  />
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 30000;
    backdrop-filter: blur(8px);
  }

  @media (min-width: 768px) {
    .modal-overlay {
      left: 0;
      right: auto;
      width: 700px;
    }
  }

  @media (min-width: 1024px) {
    .modal-overlay {
      left: 5rem;
    }
  }

  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #000000;
    z-index: 30001;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .modal-container {
      left: 0;
      right: auto;
      width: 100%;
      max-width: 700px;
      border-radius: 0 1.25rem 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
  }

  @media (min-width: 1024px) {
    .modal-container {
      left: 5rem;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: #000000;
    z-index: 10;
  }

  .modal-header-content {
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
  }

  .modal-header-content h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .notification-badge {
    background: #ef4444;
    color: white;
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
    min-width: 20px;
    text-align: center;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mark-read-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .mark-read-btn:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .close-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .modal-content::-webkit-scrollbar {
    width: 4px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .filter-tabs::-webkit-scrollbar {
    display: none;
  }

  .filter-tab {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .filter-tab:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .filter-tab.active {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 700;
    height: 16px;
    min-width: 16px;
    padding: 0 4px;
    border-radius: 8px;
    margin-left: 6px;
  }

  .notifications-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
    position: relative;
  }

  .notification-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .notification-item.unread {
    background: rgba(59, 130, 246, 0.08);
  }

  .notification-avatar {
    position: relative;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .notification-avatar:hover {
    transform: scale(1.1);
  }

  .notification-avatar img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
  }

  .notification-icon {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #16181e;
  }

  .notification-icon.vote {
    background: #3b82f6;
    color: white;
  }

  .notification-icon.like {
    background: #ef4444;
    color: white;
  }

  .notification-icon.follow {
    background: #10b981;
    color: white;
  }

  .notification-icon.comment {
    background: #8b5cf6;
    color: white;
  }

  .notification-content {
    flex: 1;
    cursor: pointer;
  }

  .notification-text {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 4px;
  }

  .notification-text strong {
    color: white;
    font-weight: 600;
  }

  .notification-poll {
    color: #60a5fa;
    font-weight: 600;
  }

  .notification-time {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    flex-shrink: 0;
    margin-top: 6px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  .empty-state p {
    margin-top: 16px;
    font-size: 16px;
  }
</style>
