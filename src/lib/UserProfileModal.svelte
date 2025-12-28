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
    BarChart2,
    ClipboardList,
    Bookmark,
    Users,
    Vote,
    Heart,
  } from "lucide-svelte";
  import { createEventDispatcher, onMount } from "svelte";
  import PostCard from "$lib/voting-feed/PostCard.svelte";
  import type {
    Post,
    UserVotes,
    RankingDrafts,
    SwipeIndices,
  } from "$lib/voting-feed/types";
  import { transformApiPollToPost } from "$lib/voting-feed/pollUtils";
  import CommentsModal from "$lib/components/CommentsModal.svelte";
  import ShareModal from "$lib/components/ShareModal.svelte";
  import { apiCall, apiDelete } from "$lib/api/client";
  import { currentUser } from "$lib/stores/auth";
  import { logout } from "$lib/stores/auth";
  import { loginModalOpen } from "$lib/stores/globalState";
  import {
    markImageFailed,
    shouldRetryImage,
  } from "$lib/stores/failed-images-store";
  import {
    Settings,
    Bell,
    Shield,
    Moon,
    Globe,
    HelpCircle,
    LogOut,
    ArrowLeft,
  } from "lucide-svelte";

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
  let activeTab = $state<
    "polls" | "votes" | "saved" | "followers" | "following"
  >("polls");
  let savedPolls = $state<any[]>([]);
  let loadingSaved = $state(false);
  let showSettings = $state(false);

  // Followers/Following lists
  let followersList = $state<any[]>([]);
  let followingList = $state<any[]>([]);
  let loadingFollowers = $state(false);
  let loadingFollowing = $state(false);
  let hasLoadedFollowers = $state(false);
  let hasLoadedFollowing = $state(false);

  // Estados para PostCard
  // Estados para PostCard
  let userVotesMap = $state<UserVotes>({});
  let rankingDrafts = $state<RankingDrafts>({});
  let swipeIndices = $state<SwipeIndices>({});
  let expandedPostId = $state<string | null>(null);
  let expandedOptionId = $state<string | null>(null);
  let addingPostId = $state<string | null>(null);

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
      console.log("[UserProfileModal] Follow state set from API:", {
        isFollowing,
        isPending,
        userData_isFollowing: userData.isFollowing,
        userData_isPending: userData.isPending,
      });

      // Cargar los votos del USUARIO ACTUAL (no del perfil) para saber qué encuestas ya votó
      const myUserId = $currentUser?.userId || ($currentUser as any)?.id;
      if (myUserId) {
        try {
          const myVotesRes = await apiCall(`/api/polls/my-votes`);
          if (myVotesRes.ok) {
            const myVotesData = await myVotesRes.json();
            const votes = myVotesData.data || myVotesData || [];

            // Transform to userVotesMap format (same as VotingFeed)
            const votesMap: UserVotes = {};
            (Array.isArray(votes) ? votes : []).forEach((vote: any) => {
              const pollId = vote.poll?.hashId || String(vote.pollId);
              const optionId = vote.option?.hashId || String(vote.optionId);

              if (!pollId || !optionId) return;

              if (votesMap[pollId]) {
                if (Array.isArray(votesMap[pollId])) {
                  (votesMap[pollId] as string[]).push(optionId);
                } else {
                  votesMap[pollId] = [votesMap[pollId] as string, optionId];
                }
              } else {
                votesMap[pollId] = optionId;
              }
            });
            userVotesMap = votesMap;
          }
        } catch (e) {
          console.error(
            "[UserProfileModal] Error loading current user votes:",
            e,
          );
        }
      }

      // Cargar encuestas guardadas solo si es el propio perfil
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

  async function loadFollowers() {
    if (!userData?.id || loadingFollowers) return;

    loadingFollowers = true;
    try {
      const res = await apiCall(`/api/users/${userData.id}/followers`);
      if (res.ok) {
        const data = await res.json();
        followersList = data.data || [];
      }
    } catch (err) {
      console.error("[UserProfileModal] Error loading followers:", err);
    } finally {
      loadingFollowers = false;
      hasLoadedFollowers = true;
    }
  }

  async function loadFollowing() {
    if (!userData?.id || loadingFollowing) return;

    loadingFollowing = true;
    try {
      const res = await apiCall(`/api/users/${userData.id}/following`);
      if (res.ok) {
        const data = await res.json();
        followingList = data.data || [];
      }
    } catch (err) {
      console.error("[UserProfileModal] Error loading following:", err);
    } finally {
      loadingFollowing = false;
      hasLoadedFollowing = true;
    }
  }

  function handleTabChange(tab: typeof activeTab) {
    activeTab = tab;

    // Load data on demand
    if (tab === "followers" && !hasLoadedFollowers) {
      loadFollowers();
    } else if (tab === "following" && !hasLoadedFollowing) {
      loadFollowing();
    } else if (tab === "saved" && savedPolls.length === 0) {
      loadSavedPolls();
    }
  }

  // Use shared transformation utility from pollUtils
  function transformToPost(apiPoll: any): Post {
    return transformApiPollToPost(apiPoll, {
      isProfileContext: true,
      profileUser: userData,
      parentIsFollowing: isFollowing,
      parentIsPending: isPending,
      activeTab,
    });
  }

  function deduplicatePosts(posts: Post[]): Post[] {
    const seen = new Set();
    return posts.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }

  // Derived posts transformed to Post format
  let transformedUserPolls = $derived(
    deduplicatePosts(userPolls.map(transformToPost)),
  );
  let transformedUserVotes = $derived(
    deduplicatePosts(
      userVotes
        .filter((v: any) => v.poll)
        .map((v: any) => transformToPost(v.poll)),
    ),
  );
  let transformedSavedPolls = $derived(
    deduplicatePosts(savedPolls.map(transformToPost)),
  );

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
    // Pass the current list of polls (likely from the active tab if they are polls)
    // If we are in 'votes' or 'saved', we might want those?
    // The user said "sus encuestas" (their polls), so usually implies the "polls" tab.
    // Let's send the transformedUserPolls if activeTab is polls, otherwise maybe just the single poll or whatever list is active.

    let contextPolls: Post[] = [];
    if (activeTab === "polls") {
      contextPolls = transformedUserPolls;
    } else if (activeTab === "votes") {
      contextPolls = transformedUserVotes;
    } else if (activeTab === "saved") {
      contextPolls = transformedSavedPolls;
    }

    dispatch("pollClick", { pollId: postId, polls: contextPolls });
    closeModal();
  }

  function handleComment(post: Post) {
    dispatch("comment", { post });
  }

  function handleShare(post: Post) {
    dispatch("share", { post });
  }

  function handleRepost(post: Post) {
    if (!$currentUser) {
      loginModalOpen.set(true);
      return;
    }
    dispatch("repost", { post });
  }

  function handleStatsClick(post: Post) {
    console.log("[UserProfileModal] Stats click for poll:", post.id);
    dispatch("statsClick", { post });
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
    if (!$currentUser) {
      loginModalOpen.set(true);
      return;
    }

    followLoading = true;
    try {
      if (isPending) {
        // Cancelar solicitud
        const res = await apiCall(`/api/users/${userId}/follow`, {
          method: "DELETE",
        });
        if (res.ok) {
          isPending = false;
          dispatch("followChange", {
            userId,
            isFollowing: false,
            isPending: false,
          });
        }
      } else if (isFollowing) {
        // Dejar de seguir
        const res = await apiCall(`/api/users/${userId}/follow`, {
          method: "DELETE",
        });
        if (res.ok) {
          isFollowing = false;
          dispatch("followChange", {
            userId,
            isFollowing: false,
            isPending: false,
          });
          if (userData)
            userData.stats.followersCount = Math.max(
              0,
              userData.stats.followersCount - 1,
            );
        }
      } else {
        // Seguir
        try {
          const res = await apiCall(`/api/users/${userId}/follow`, {
            method: "POST",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "pending") {
              isPending = true;
              isFollowing = false;
              dispatch("followChange", {
                userId,
                isFollowing: false,
                isPending: true,
              });
            } else {
              isFollowing = true;
              isPending = false;
              dispatch("followChange", {
                userId,
                isFollowing: true,
                isPending: false,
              });
              if (userData) userData.stats.followersCount += 1;
            }
          } else {
            // Handle error response
            if (res.status === 400) {
              const errData = await res.json().catch(() => ({}));
              // Check if error is "relationship exists"
              if (errData.message && errData.message.includes("existe")) {
                console.log(
                  "[UserProfileModal] Ya se sigue al usuario, actualizando estado local.",
                );
                isFollowing = true;
                isPending = false;
                dispatch("followChange", {
                  userId,
                  isFollowing: true,
                  isPending: false,
                });
              }
            } else {
              console.error("[UserProfileModal] Error al seguir:", res.status);
            }
          }
        } catch (postErr: any) {
          console.error("[UserProfileModal] Exception al seguir:", postErr);
          // Si el error viene de apiCall, a veces lanza excepción con status
          if (postErr.status === 400) {
            console.log(
              "[UserProfileModal] 400 caught via exception, asumiendo ya seguido.",
            );
            isFollowing = true;
            isPending = false;
            dispatch("followChange", {
              userId,
              isFollowing: true,
              isPending: false,
            });
          }
        }
      }
    } catch (err) {
      console.error("[UserProfileModal] Error al seguir/dejar de seguir:", err);
    } finally {
      followLoading = false;
    }
  }

  async function handleUnfollowUser(targetUserId: number) {
    try {
      const res = await apiCall(`/api/users/${targetUserId}/follow`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Remove from list immediately for better UX
        followingList = followingList.filter((u) => u.id !== targetUserId);
        // Also update local counters if this is the current user viewing their own profile
        if (
          userData &&
          userData.id ===
            Number($currentUser?.userId || ($currentUser as any)?.id)
        ) {
          userData.stats.followingCount = Math.max(
            0,
            userData.stats.followingCount - 1,
          );
        }
      }
    } catch (err) {
      console.error("[UserProfileModal] Error unfollowing from list:", err);
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

  function handleLogout() {
    console.log("[UserProfileModal] 🚪 Cerrando sesión...");
    logout();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("voutop-test-user");
    }
    currentUser.set(null);
    closeModal();
    setTimeout(() => {
      window.location.reload();
    }, 100);
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
      {#if showSettings}
        <button
          onclick={() => (showSettings = false)}
          class="close-btn"
          aria-label="Volver"
        >
          <ArrowLeft size={24} />
        </button>
        <h2>Ajustes</h2>
      {:else}
        <h2 id="user-profile-modal-title">Perfil</h2>
      {/if}

      <div class="flex items-center gap-2">
        {#if !showSettings && $currentUser && ($currentUser.userId || ($currentUser as any).id) === userData?.id}
          <button
            onclick={() => (showSettings = true)}
            class="close-btn"
            aria-label="Ajustes"
          >
            <Settings size={24} />
          </button>
        {/if}
        <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
          <X size={24} />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="modal-content" bind:this={scrollContainer}>
      {#if showSettings}
        <!-- Menú de Ajustes (Importado del antiguo ProfileModal) -->
        <div class="settings-view" transition:fade={{ duration: 200 }}>
          <div class="menu-section">
            <h4 class="menu-title">Cuenta</h4>

            <button
              class="menu-item"
              onclick={() => console.log("Configuración")}
            >
              <Settings size={20} />
              <span>Configuración</span>
            </button>

            <button
              class="menu-item"
              onclick={() => console.log("Notificaciones")}
            >
              <Bell size={20} />
              <span>Notificaciones</span>
            </button>

            <button class="menu-item" onclick={() => console.log("Privacidad")}>
              <Shield size={20} />
              <span>Privacidad y seguridad</span>
            </button>
          </div>

          <div class="divider"></div>

          <div class="menu-section">
            <h4 class="menu-title">Apariencia</h4>

            <button class="menu-item" onclick={() => console.log("Tema")}>
              <Moon size={20} />
              <span>Modo oscuro</span>
              <div class="toggle-switch active">
                <div class="toggle-thumb"></div>
              </div>
            </button>

            <button class="menu-item" onclick={() => console.log("Idioma")}>
              <Globe size={20} />
              <span>Idioma</span>
              <span class="menu-value">Español</span>
            </button>
          </div>

          <div class="divider"></div>

          <div class="menu-section">
            <h4 class="menu-title">Soporte</h4>

            <button class="menu-item" onclick={() => console.log("Ayuda")}>
              <HelpCircle size={20} />
              <span>Ayuda y soporte</span>
            </button>
          </div>

          <div class="divider"></div>

          <!-- Botón de logout -->
          <button class="logout-btn" onclick={handleLogout}>
            <LogOut size={20} />
            <span>Cerrar sesión</span>
          </button>

          <div class="text-center mt-8 text-xs text-slate-600">
            v0.9.5 (Beta)
          </div>
        </div>
      {:else if loading && !userData}
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
          <!-- Avatar y botón de seguir (Banner eliminado) -->
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
        </div>

        <!-- Profile Tabs (Sticky on scroll) -->
        <nav class="profile-tabs">
          <button
            class="tab-pill"
            class:active={activeTab === "polls"}
            onclick={() => handleTabChange("polls")}
          >
            <span class="tab-icon"><BarChart2 size={18} /></span>
            <span class="tab-num"
              >{formatNumber(userData.stats.pollsCount)}</span
            >
            {#if activeTab === "polls"}
              <span class="tab-name">Encuestas</span>
            {/if}
          </button>

          <button
            class="tab-pill"
            class:active={activeTab === "votes"}
            onclick={() => handleTabChange("votes")}
          >
            <span class="tab-icon"><Vote size={18} /></span>
            <span class="tab-num"
              >{formatNumber(userData.stats.votesCount)}</span
            >
            {#if activeTab === "votes"}
              <span class="tab-name">Votos</span>
            {/if}
          </button>

          <button
            class="tab-pill"
            class:active={activeTab === "followers"}
            onclick={() => handleTabChange("followers")}
          >
            <span class="tab-icon"><Users size={18} /></span>
            <span class="tab-num"
              >{formatNumber(userData.stats.followersCount)}</span
            >
            {#if activeTab === "followers"}
              <span class="tab-name">Seguidores</span>
            {/if}
          </button>

          <button
            class="tab-pill"
            class:active={activeTab === "following"}
            onclick={() => handleTabChange("following")}
          >
            <span class="tab-icon"><UserPlus size={18} /></span>
            <span class="tab-num"
              >{formatNumber(userData.stats.followingCount)}</span
            >
            {#if activeTab === "following"}
              <span class="tab-name">Siguiendo</span>
            {/if}
          </button>

          {#if $currentUser && (Number($currentUser.userId) === userData.id || Number(($currentUser as any).id) === userData.id)}
            <button
              class="tab-pill"
              class:active={activeTab === "saved"}
              onclick={() => handleTabChange("saved")}
            >
              <span class="tab-icon"><Bookmark size={18} /></span>
              {#if activeTab === "saved"}
                <span class="tab-name">Guardados</span>
              {/if}
            </button>
          {/if}
        </nav>

        <!-- Contenido de tabs -->
        <div class="tab-content">
          {#if activeTab === "polls"}
            <div class="polls-list">
              {#if userPolls.length === 0}
                <div class="empty-state">
                  <BarChart2 size={48} />
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
                    onStatsClick={handleStatsClick}
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
                    onStatsClick={handleStatsClick}
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
                    onStatsClick={handleStatsClick}
                  />
                {/each}
              {/if}
            </div>
          {:else if activeTab === "followers"}
            <div class="users-list">
              {#if loadingFollowers}
                <div class="loading-state">
                  <Loader2 size={48} class="spinner" />
                  <p>Cargando seguidores...</p>
                </div>
              {:else if followersList.length === 0}
                <div class="empty-state">
                  <Users size={48} />
                  <p>Aún no tiene seguidores</p>
                </div>
              {:else}
                {#each followersList as user (user.id)}
                  <div
                    class="user-card"
                    onclick={() => {
                      dispatch("userClick", { userId: user.id });
                    }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) =>
                      e.key === "Enter" &&
                      dispatch("userClick", { userId: user.id })}
                  >
                    <img
                      src={user.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.displayName || user.username}
                      class="user-avatar"
                    />
                    <div class="user-info">
                      <span class="user-name"
                        >{user.displayName || user.username}</span
                      >
                      <span class="user-username">@{user.username}</span>
                    </div>
                    {#if user.verified}
                      <span class="verified-badge-inline">✓</span>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          {:else if activeTab === "following"}
            <div class="users-list">
              {#if loadingFollowing}
                <div class="loading-state">
                  <Loader2 size={48} class="spinner" />
                  <p>Cargando siguiendo...</p>
                </div>
              {:else if followingList.length === 0}
                <div class="empty-state">
                  <UserPlus size={48} />
                  <p>Aún no sigue a nadie</p>
                </div>
              {:else}
                {#each followingList as user (user.id)}
                  <div
                    class="user-card"
                    onclick={() => {
                      dispatch("userClick", { userId: user.id });
                    }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) =>
                      e.key === "Enter" &&
                      dispatch("userClick", { userId: user.id })}
                  >
                    <img
                      src={user.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.displayName || user.username}
                      class="user-avatar"
                    />
                    <div class="user-info">
                      <span class="user-name"
                        >{user.displayName || user.username}</span
                      >
                      <span class="user-username">@{user.username}</span>
                    </div>
                    {#if user.verified}
                      <span class="verified-badge-inline">✓</span>
                    {/if}

                    {#if $currentUser && (Number($currentUser.userId) === userData.id || Number(($currentUser as any).id) === userData.id)}
                      <button
                        class="unfollow-list-btn"
                        onclick={(e) => {
                          e.stopPropagation();
                          handleUnfollowUser(user.id);
                        }}
                      >
                        Dejar de seguir
                      </button>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

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
    background: #000000;
    z-index: 1000001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    .modal-container {
      left: 0;
      right: auto;
      width: 100%;
      max-width: 500px;
      border-radius: 0 20px 0 0;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
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
    padding: 0;
    touch-action: pan-y;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    /* Eliminamos flex para que sticky funcione mejor */
    position: relative;
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

  .profile-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 1rem 1.5rem 0;
    margin-top: 0;
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
    padding: 16px 20px 0;
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

  /* Profile Tabs - Fixed & Elegant */
  .profile-tabs {
    display: flex;
    gap: 12px;
    padding: 0 20px;
    background: #000000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: sticky;
    top: -1.5px; /* Solapamiento forzado para eliminar el 'filo' */
    margin-top: -1px; /* Tirar un pelín hacia arriba */
    z-index: 100;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    height: 72px;
    align-items: center;
    /* Asegurar que se vean */
    visibility: visible;
    opacity: 1;
  }

  .profile-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    flex-shrink: 0;
    height: 44px; /* Botones más grandes y cómodos */
  }

  .tab-pill:hover {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .tab-pill.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
    /* Brillo sutil en lugar de azul eléctrico */
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.05);
  }

  .tab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    opacity: 0.8;
  }

  .tab-pill.active .tab-icon {
    opacity: 1;
    color: #ffffff;
  }

  .tab-num {
    font-weight: 700;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .tab-name {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-left: 4px;
    color: rgba(255, 255, 255, 0.9);
    animation: fadeInSlide 0.3s ease-out forwards;
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateX(-5px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .tab-content {
    background: #000000;
    min-height: 100%;
  }

  /* User Cards List */
  .users-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 20px 20px;
  }

  .tab-content {
    padding: 0;
  }

  .polls-list,
  .saved-list {
    padding: 12px 20px 20px;
  }

  .unfollow-list-btn {
    margin-left: auto;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .unfollow-list-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .verified-badge-inline {
    width: 16px;
    height: 16px;
    background: #3b82f6;
    color: white;
    font-size: 10px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -4px;
    margin-right: 8px;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .user-card:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .user-card:active {
    background: rgba(255, 255, 255, 0.08);
  }

  .user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .user-name {
    color: white;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-username {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .verified-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: #3b82f6;
    border-radius: 50%;
    color: white;
    font-size: 10px;
    font-weight: bold;
    flex-shrink: 0;
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
  .polls-list,
  .votes-list,
  .saved-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .polls-list :global(.post-card),
  .votes-list :global(.post-card),
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

  /* Ajustar profile-top al no haber banner */
  .profile-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-top: 1rem;
  }

  .profile-avatar {
    position: relative;
    margin-top: 0;
  }

  .profile-avatar img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #000;
    background: #1e293b;
  }

  /* Estilos para el menú de ajustes */
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 20px 0;
  }

  .menu-section {
    margin-bottom: 20px;
  }

  .menu-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    margin-bottom: 6px;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .menu-item span:first-of-type {
    flex: 1;
  }

  .menu-value {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    position: relative;
    transition: all 0.3s;
  }

  .toggle-switch.active {
    background: #3b82f6;
  }

  .toggle-thumb {
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    left: 3px;
    transition: all 0.3s;
  }

  .toggle-switch.active .toggle-thumb {
    left: 23px;
  }

  .logout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.15);
    border: none;
    border-radius: 16px;
    color: #ef4444;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    transform: scale(1.02);
  }
</style>
