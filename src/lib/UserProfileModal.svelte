<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    X,
    MapPin,
    Calendar,
    Check,
    UserPlus,
    UserMinus,
    UserCheck,
    Clock,
    Loader2,
    TrendingUp,
    BarChart,
    ClipboardList,
    Bookmark,
  } from "lucide-svelte";
  import { createEventDispatcher, onMount } from "svelte";
  import PostCard from "$lib/voting-feed/PostCard.svelte";
  import type {
    Post,
    UserVotes,
    RankingDrafts,
    SwipeIndices,
  } from "$lib/voting-feed/types";
  import CommentsModal from "$lib/components/CommentsModal.svelte";
  import ShareModal from "$lib/components/ShareModal.svelte";
  import { apiCall, apiDelete } from "$lib/api/client";
  import { currentUser } from "$lib/stores";
  import {
    markImageFailed,
    shouldRetryImage,
  } from "$lib/stores/failed-images-store";

  const dispatch = createEventDispatcher();

  interface Props {
    isOpen?: boolean;
    userId?: number | null;
  }

  let { isOpen = $bindable(false), userId = $bindable(null) }: Props = $props();

  // Estados
  let loading = $state(false);
  let error = $state<string | null>(null);
  let userData = $state<any>(null);
  let userPolls = $state<any[]>([]);
  let userVotes = $state<any[]>([]);
  let isFollowing = $state(false);
  let isPending = $state(false);
  let followLoading = $state(false);
  let activeTab = $state<"polls" | "votes" | "saved">("polls");
  let savedPolls = $state<any[]>([]);
  let loadingSaved = $state(false);

  // Estados para PostCard
  let userVotesMap = $state<UserVotes>({});
  let rankingDrafts = $state<RankingDrafts>({});
  let swipeIndices = $state<SwipeIndices>({});
  let expandedPostId = $state<string | null>(null);
  let expandedOptionId = $state<string | null>(null);
  let addingPostId = $state<string | null>(null);

  // Modals
  let isCommentsModalOpen = $state(false);
  let commentsPollId = $state<string | number>("");
  let commentsPollTitle = $state("");
  let isShareModalOpen = $state(false);
  let sharePollHashId = $state("");
  let sharePollTitle = $state("");

  // Swipe handlers para cerrar modal - SOLO si scroll está en top
  let modalTouchStartY = 0;
  let scrollContainer: HTMLElement | null = $state(null);

  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }

  function handleModalSwipeMove(e: TouchEvent) {
    // Solo cerrar si el scroll está en la parte superior
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;

    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 100) {
      closeModal();
    }
  }

  function closeModal() {
    isOpen = false;
    // Resetear datos después de la animación
    setTimeout(() => {
      userData = null;
      userPolls = [];
      userVotes = [];
      savedPolls = [];
      activeTab = "polls";
      error = null;
      userId = null;
    }, 300);
  }

  // Manejar botón atrás del navegador
  let historyPushed = false;

  $effect(() => {
    if (isOpen && !historyPushed) {
      history.pushState({ modal: "profile" }, "");
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

  // Cargar datos del usuario cuando se abre el modal o cambia el userId
  $effect(() => {
    if (isOpen && userId) {
      loadUserData();
    }
  });

  async function loadUserData() {
    loading = true;
    error = null;

    try {
      // Cargar perfil del usuario
      const profileRes = await apiCall(`/api/users/${userId}`);
      if (!profileRes.ok) {
        throw new Error("No se pudo cargar el perfil");
      }
      const profileData = await profileRes.json();
      userData = profileData.data;

      // Cargar encuestas del usuario
      const pollsRes = await apiCall(`/api/users/${userId}/polls?limit=10`);
      if (pollsRes.ok) {
        const pollsData = await pollsRes.json();
        userPolls = pollsData.data;
      }

      // Cargar votos del usuario
      const votesRes = await apiCall(`/api/users/${userId}/votes?limit=10`);
      if (votesRes.ok) {
        const votesData = await votesRes.json();
        const rawVotes = votesData.data || [];

        // Asegurar que cada voto tenga la estructura completa
        userVotes = rawVotes.map((vote: any) => ({
          ...vote,
          poll: {
            ...vote.poll,
            options: (vote.poll?.options || []).map((opt: any) => ({
              ...opt,
              votes: opt.votes || 0,
              key: opt.key || opt.optionKey,
              label: opt.label || opt.optionLabel,
            })),
            stats: vote.poll?.stats || {
              totalVotes: 0,
              interactions: 0,
              comments: 0,
            },
          },
        }));
      } else {
        console.error(
          "[UserProfileModal] Error al cargar votos:",
          votesRes.status,
        );
        userVotes = [];
      }

      // Establecer estado de seguimiento desde la respuesta de la API
      isFollowing = userData.isFollowing || false;
      isPending = userData.isPending || false;

      // Cargar encuestas guardadas solo si es el propio perfil
      const myUserId = $currentUser?.userId || ($currentUser as any)?.id;
      if (myUserId && Number(myUserId) === userData.id) {
        loadSavedPolls();
      }
    } catch (err: any) {
      error = err.message || "Error al cargar el perfil";
      console.error("[UserProfileModal] Error:", err);
    } finally {
      loading = false;
    }
  }

  async function loadSavedPolls() {
    if (!userData?.id) return;

    loadingSaved = true;
    try {
      const res = await apiCall(`/api/users/${userData.id}/bookmarks?limit=20`);
      if (res.ok) {
        const data = await res.json();
        savedPolls = (data.data || []).map((poll: any) => ({
          ...poll,
          options: (poll.options || []).map((opt: any) => ({
            ...opt,
            key: opt.key || opt.optionKey,
            label: opt.label || opt.optionLabel,
          })),
        }));
      }
    } catch (err) {
      console.error("[UserProfileModal] Error al cargar guardados:", err);
    } finally {
      loadingSaved = false;
    }
  }

  // Color palette for options (same as VotingFeed)
  const OPTION_COLORS = [
    { from: "from-red-600", to: "to-red-900", bar: "bg-red-500" },
    { from: "from-blue-600", to: "to-blue-900", bar: "bg-blue-500" },
    { from: "from-emerald-600", to: "to-emerald-900", bar: "bg-emerald-500" },
    { from: "from-amber-600", to: "to-amber-900", bar: "bg-amber-500" },
    { from: "from-purple-600", to: "to-purple-900", bar: "bg-purple-500" },
    { from: "from-pink-600", to: "to-pink-900", bar: "bg-pink-500" },
  ];

  function getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "ahora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  // Transform API poll data to Post format for PostCard
  function transformToPost(apiPoll: any): Post {
    const totalVotes =
      apiPoll.stats?.totalVotes ||
      apiPoll.options?.reduce(
        (sum: number, opt: any) =>
          sum + (opt.votes || opt.voteCount || opt._count?.votes || 0),
        0,
      ) ||
      0;

    return {
      id: apiPoll.hashId || String(apiPoll.id),
      type: apiPoll.type || "standard",
      author:
        apiPoll.user?.displayName ||
        apiPoll.user?.username ||
        userData?.displayName ||
        "Usuario",
      avatar:
        apiPoll.user?.avatarUrl ||
        userData?.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiPoll.userId}`,
      time: getTimeAgo(apiPoll.createdAt || new Date().toISOString()),
      question: apiPoll.title || "Sin título",
      totalVotes,
      comments: apiPoll.stats?.comments || apiPoll._count?.comments || 0,
      reposts: apiPoll.stats?.interactions || apiPoll._count?.interactions || 0,
      likes: 0,
      userId: apiPoll.user?.id || apiPoll.userId,
      collabMode: apiPoll.collabMode,
      collaborators: apiPoll.collaborators,
      isFollowing: false,
      isPending: false,
      isBookmarked: true, // If in saved, it's bookmarked
      endsAt: apiPoll.closedAt,
      correctOptionId: apiPoll.correctOptionHashId,
      options: (apiPoll.options || []).map((opt: any, idx: number) => {
        const colors = OPTION_COLORS[idx % OPTION_COLORS.length];
        const optionImage = opt.imageUrl || opt.image_url;
        return {
          id: opt.hashId || String(opt.id),
          title:
            opt.label ||
            opt.optionLabel ||
            opt.key ||
            opt.optionKey ||
            `Opción ${idx + 1}`,
          votes: opt.votes || opt.voteCount || opt._count?.votes || 0,
          friends: [],
          type: optionImage ? ("image" as const) : ("text" as const),
          image: optionImage,
          colorFrom: colors.from,
          colorTo: colors.to,
          bgBar: colors.bar,
        };
      }),
    };
  }

  // Derived posts transformed to Post format
  let transformedUserPolls = $derived(userPolls.map(transformToPost));
  let transformedUserVotes = $derived(
    userVotes
      .filter((v: any) => v.poll)
      .map((v: any) => transformToPost(v.poll)),
  );
  let transformedSavedPolls = $derived(savedPolls.map(transformToPost));

  // PostCard handlers
  function handleVote(postId: string, value: string | string[]) {
    userVotesMap = { ...userVotesMap, [postId]: value };
  }

  function handleToggleRank(postId: string, optionId: string) {
    const currentDraft = rankingDrafts[postId] || [];
    if (currentDraft.includes(optionId)) {
      rankingDrafts = {
        ...rankingDrafts,
        [postId]: currentDraft.filter((id) => id !== optionId),
      };
    } else {
      rankingDrafts = {
        ...rankingDrafts,
        [postId]: [...currentDraft, optionId],
      };
    }
  }

  function handlePopRank(postId: string) {
    const currentDraft = rankingDrafts[postId] || [];
    if (currentDraft.length === 0) return;
    rankingDrafts = { ...rankingDrafts, [postId]: currentDraft.slice(0, -1) };
  }

  function handleSwipe(postId: string, direction: "left" | "right") {
    const idx = swipeIndices[postId] || 0;
    swipeIndices = { ...swipeIndices, [postId]: idx + 1 };
  }

  function handleAddCollab(postId: string, text: string) {
    if (!text.trim()) {
      addingPostId = null;
      return;
    }
    addingPostId = null;
  }

  function setExpanded(postId: string | null, optionId: string | null) {
    expandedPostId = postId;
    expandedOptionId = optionId;
  }

  function setAdding(postId: string | null) {
    addingPostId = postId;
  }

  function switchToReels(postId: string) {
    // Close profile and open post in reels view
    dispatch("pollClick", { pollId: postId });
    closeModal();
  }

  function handleComment(post: Post) {
    commentsPollId = post.id;
    commentsPollTitle = post.question;
    isCommentsModalOpen = true;
  }

  function handleShare(post: Post) {
    sharePollHashId = post.id;
    sharePollTitle = post.question;
    isShareModalOpen = true;
  }

  function handleRepost(post: Post) {
    // TODO: Implement repost
    console.log("Repost:", post.id);
  }

  function handleAvatarClick(post: Post) {
    // Already in profile modal, could switch to that user's profile
    if (post.userId && post.userId !== userData?.id) {
      userId = post.userId;
      loadUserData();
    }
  }

  async function toggleFollow() {
    if (!userId || followLoading) return;

    followLoading = true;
    try {
      if (isPending) {
        // Cancelar solicitud
        const res = await apiCall(`/api/users/${userId}/follow`, {
          method: "DELETE",
        });
        if (res.ok) isPending = false;
      } else if (isFollowing) {
        // Dejar de seguir
        const res = await apiCall(`/api/users/${userId}/follow`, {
          method: "DELETE",
        });
        if (res.ok) {
          isFollowing = false;
          if (userData)
            userData.stats.followersCount = Math.max(
              0,
              userData.stats.followersCount - 1,
            );
        }
      } else {
        // Seguir
        const res = await apiCall(`/api/users/${userId}/follow`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "pending") {
            isPending = true;
            isFollowing = false;
          } else {
            isFollowing = true;
            isPending = false;
            if (userData) userData.stats.followersCount += 1;
          }
        }
      }
    } catch (err) {
      console.error("[UserProfileModal] Error al seguir/dejar de seguir:", err);
    } finally {
      followLoading = false;
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
    });
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
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
    transition:fly={{ y: "100%", duration: 450, easing: cubicOut }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="user-profile-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header -->
    <div class="modal-header">
      <h2 id="user-profile-modal-title">Perfil</h2>
      <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="modal-content" bind:this={scrollContainer}>
      {#if loading && !userData}
        <div class="loading-state">
          <Loader2 size={48} class="spinner" />
          <p>Cargando perfil...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="retry-btn" onclick={loadUserData}>Reintentar</button>
        </div>
      {:else if userData}
        <!-- Perfil del usuario -->
        <div class="profile-header">
          <!-- Banner (opcional) -->
          <div class="profile-banner"></div>

          <!-- Avatar y botón de seguir -->
          <div class="profile-top">
            <div class="profile-avatar">
              <img
                src={userData.avatarUrl && shouldRetryImage(userData.avatarUrl)
                  ? userData.avatarUrl
                  : `https://i.pravatar.cc/150?u=${userData.username}`}
                alt={userData.displayName}
                referrerpolicy="no-referrer"
                onerror={(e: Event) => {
                  if (e.target && userData.avatarUrl) {
                    (e.target as HTMLImageElement).src =
                      `https://i.pravatar.cc/150?u=${userData.username}`;
                    markImageFailed(userData.avatarUrl);
                  }
                }}
              />
              {#if userData.verified}
                <div class="verified-badge">
                  <Check size={14} />
                </div>
              {/if}
            </div>

            {#if !$currentUser || ($currentUser.userId || ($currentUser as any).id) !== userData.id}
              <button
                class="follow-btn"
                class:following={isFollowing}
                class:pending={isPending}
                onclick={toggleFollow}
                disabled={followLoading}
              >
                {#if followLoading}
                  <Loader2 size={18} class="spinner" />
                {:else if isFollowing}
                  <UserCheck size={18} />
                  <span>Siguiendo</span>
                {:else if isPending}
                  <Clock size={18} />
                  <span>Solicitado</span>
                {:else}
                  <UserPlus size={18} />
                  <span>Seguir</span>
                {/if}
              </button>
            {/if}
          </div>

          <!-- Información del usuario -->
          <div class="profile-info">
            <h3>{userData.displayName}</h3>
            <p class="username">@{userData.username}</p>

            {#if userData.bio}
              <p class="bio">{userData.bio}</p>
            {/if}

            {#if userData.username === "robertojimenezvalle"}
              <a
                href="/production-checklist"
                class="checklist-link"
                onclick={(e) => {
                  e.stopPropagation();
                  closeModal();
                }}
              >
                <ClipboardList size={14} />
                Production Checklist
              </a>
            {/if}

            <div class="profile-meta">
              {#if userData.countryIso3}
                <span class="meta-item">
                  <MapPin size={14} />
                  {userData.countryIso3}
                </span>
              {/if}
              <span class="meta-item">
                <Calendar size={14} />
                Se unió en {formatDate(userData.createdAt)}
              </span>
            </div>
          </div>

          <!-- Stats -->
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value"
                >{formatNumber(userData.stats.pollsCount)}</span
              >
              <span class="stat-label">Encuestas</span>
            </div>
            <div class="stat-item">
              <span class="stat-value"
                >{formatNumber(userData.stats.votesCount)}</span
              >
              <span class="stat-label">Votos</span>
            </div>
            <div class="stat-item">
              <span class="stat-value"
                >{formatNumber(userData.stats.followersCount)}</span
              >
              <span class="stat-label">Seguidores</span>
            </div>
            <div class="stat-item">
              <span class="stat-value"
                >{formatNumber(userData.stats.followingCount)}</span
              >
              <span class="stat-label">Siguiendo</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <button
            class="tab-btn"
            class:active={activeTab === "polls"}
            onclick={() => (activeTab = "polls")}
          >
            <BarChart size={18} />
            <span>Encuestas ({userPolls.length})</span>
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "votes"}
            onclick={() => (activeTab = "votes")}
          >
            <TrendingUp size={18} />
            <span>Votaciones ({userVotes.length})</span>
          </button>
          {#if $currentUser && ($currentUser.userId || ($currentUser as any).id) === userData.id}
            <button
              class="tab-btn"
              class:active={activeTab === "saved"}
              onclick={() => (activeTab = "saved")}
            >
              <Bookmark size={18} />
              <span>Guardadas ({savedPolls.length})</span>
            </button>
          {/if}
        </div>

        <!-- Contenido de tabs -->
        <div class="tab-content">
          {#if activeTab === "polls"}
            <div class="polls-list">
              {#if userPolls.length === 0}
                <div class="empty-state">
                  <BarChart size={48} />
                  <p>Aún no ha publicado encuestas</p>
                </div>
              {:else}
                {#each transformedUserPolls as post (post.id)}
                  <PostCard
                    {post}
                    userVotes={userVotesMap}
                    {rankingDrafts}
                    {swipeIndices}
                    {expandedPostId}
                    {expandedOptionId}
                    {addingPostId}
                    onVote={handleVote}
                    onToggleRank={handleToggleRank}
                    onPopRank={handlePopRank}
                    onSwipe={handleSwipe}
                    onAddCollab={handleAddCollab}
                    {setExpanded}
                    {setAdding}
                    {switchToReels}
                    viewMode="feed"
                    onComment={handleComment}
                    onShare={handleShare}
                    onRepost={handleRepost}
                    onAvatarClick={handleAvatarClick}
                  />
                {/each}
              {/if}
            </div>
          {:else if activeTab === "votes"}
            <div class="votes-list">
              {#if loading}
                <div class="loading-state">
                  <Loader2 size={48} class="spinner" />
                  <p>Cargando votaciones...</p>
                </div>
              {:else if userVotes.length === 0}
                <div class="empty-state">
                  <TrendingUp size={48} />
                  <p>Aún no ha votado en encuestas</p>
                </div>
              {:else}
                {#each transformedUserVotes as post (post.id)}
                  <PostCard
                    {post}
                    userVotes={userVotesMap}
                    {rankingDrafts}
                    {swipeIndices}
                    {expandedPostId}
                    {expandedOptionId}
                    {addingPostId}
                    onVote={handleVote}
                    onToggleRank={handleToggleRank}
                    onPopRank={handlePopRank}
                    onSwipe={handleSwipe}
                    onAddCollab={handleAddCollab}
                    {setExpanded}
                    {setAdding}
                    {switchToReels}
                    viewMode="feed"
                    onComment={handleComment}
                    onShare={handleShare}
                    onRepost={handleRepost}
                    onAvatarClick={handleAvatarClick}
                  />
                {/each}
              {/if}
            </div>
          {:else if activeTab === "saved"}
            <div class="saved-list">
              {#if loadingSaved}
                <div class="loading-state">
                  <Loader2 size={48} class="spinner" />
                  <p>Cargando guardadas...</p>
                </div>
              {:else if savedPolls.length === 0}
                <div class="empty-state">
                  <Bookmark size={48} />
                  <p>No tienes encuestas guardadas</p>
                  <span class="empty-hint"
                    >Pulsa el icono de guardado en las encuestas para añadirlas
                    aquí</span
                  >
                </div>
              {:else}
                {#each transformedSavedPolls as post (post.id)}
                  <PostCard
                    {post}
                    userVotes={userVotesMap}
                    {rankingDrafts}
                    {swipeIndices}
                    {expandedPostId}
                    {expandedOptionId}
                    {addingPostId}
                    onVote={handleVote}
                    onToggleRank={handleToggleRank}
                    onPopRank={handlePopRank}
                    onSwipe={handleSwipe}
                    onAddCollab={handleAddCollab}
                    {setExpanded}
                    {setAdding}
                    {switchToReels}
                    viewMode="feed"
                    onComment={handleComment}
                    onShare={handleShare}
                    onRepost={handleRepost}
                    onAvatarClick={handleAvatarClick}
                  />
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Comments Modal -->
<CommentsModal
  bind:isOpen={isCommentsModalOpen}
  pollId={commentsPollId}
  pollTitle={commentsPollTitle}
/>

<!-- Share Modal -->
<ShareModal
  bind:isOpen={isShareModalOpen}
  pollHashId={sharePollHashId}
  pollTitle={sharePollTitle}
/>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000000;
    backdrop-filter: blur(8px);
  }

  @media (min-width: 768px) {
    .modal-overlay {
      right: auto;
      width: 700px;
    }
  }

  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #181a20;
    z-index: 1000001;
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
    background: #181a20;
    z-index: 10;
  }

  .modal-header h2 {
    font-size: 24px;
    font-weight: 700;
    color: white;
    margin: 0;
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
    padding: 0 20px 20px;
    touch-action: pan-y;
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

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    gap: 16px;
  }

  :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .retry-btn {
    padding: 10px 24px;
    background: rgba(59, 130, 246, 0.3);
    border: none;
    border-radius: 8px;
    color: #60a5fa;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: rgba(59, 130, 246, 0.4);
  }

  /* Profile Header */
  .profile-header {
    position: relative;
  }

  .profile-banner {
    width: 100%;
    height: 120px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .profile-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 1.5rem;
    margin-top: -40px;
  }

  .profile-avatar {
    position: relative;
  }

  .profile-avatar img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid #181a20;
  }

  .verified-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    background: #3b82f6;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #181a20;
  }

  .follow-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: rgba(59, 130, 246, 0.3);
    border: 2px solid #3b82f6;
    border-radius: 24px;
    color: #60a5fa;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .follow-btn:hover {
    background: rgba(59, 130, 246, 0.4);
    transform: scale(1.05);
  }

  .follow-btn.following {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .follow-btn.following:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .follow-btn.pending {
    background: rgba(234, 179, 8, 0.2);
    border-color: rgba(234, 179, 8, 0.5);
    color: #facc15;
  }

  .follow-btn.pending:hover {
    background: rgba(234, 179, 8, 0.3);
  }

  .follow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-info {
    padding: 16px 1.5rem 0;
  }

  .profile-info h3 {
    font-size: 22px;
    font-weight: 700;
    color: white;
    margin: 0 0 4px 0;
  }

  .username {
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    margin: 0 0 12px 0;
  }

  .bio {
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    line-height: 1.5;
    margin: 12px 0;
  }

  .checklist-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #34d399;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    margin-bottom: 12px;
    transition: all 0.2s;
  }

  .checklist-link:hover {
    background: rgba(16, 185, 129, 0.2);
    transform: translateY(-1px);
  }

  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 12px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .stats-row {
    display: flex;
    gap: 20px;
    padding: 20px 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: white;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Tabs */
  .tabs-container {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab-btn.active {
    color: #60a5fa;
    border-bottom-color: #3b82f6;
  }

  /* Tab Content */
  .tab-content {
    padding: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    margin: 0 20px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  .empty-state p {
    margin-top: 16px;
    font-size: 16px;
  }

  /* Polls List - usar PostCard */
  .polls-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .polls-list :global(.post-card) {
    width: 100%;
  }

  /* Votes List - usar PostCard */
  .votes-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .votes-list :global(.post-card) {
    width: 100%;
  }

  /* Saved List - usar PostCard */
  .saved-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .saved-list :global(.post-card) {
    width: 100%;
  }

  .empty-hint {
    display: block;
    margin-top: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    max-width: 250px;
  }
</style>
