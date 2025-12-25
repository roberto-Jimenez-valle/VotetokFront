<script lang="ts">
  import { fly, scale } from "svelte/transition";
  import {
    BarChart2,
    Check,
    X,
    Heart,
    MoreHorizontal,
    MoreVertical,
    MessageCircle,
    Repeat2,
    Bookmark,
    Share2,
    Plus,
    Send,
    RotateCcw,
    Maximize,
    Trophy,
    ListOrdered,
    Flame,
    Users,
    ArrowLeft,
    ArrowLeftRight,
    Clock,
    Infinity as InfinityIcon,
    Globe,
    Lock,
    UserPlus,
    UserCheck,
  } from "lucide-svelte";
  import type {
    Post,
    PostType,
    UserVotes,
    RankingDrafts,
    SwipeIndices,
    ViewMode,
  } from "./types";
  import { POST_CONFIGS } from "./types";
  import OptionCard from "./OptionCard.svelte";
  import Countdown from "$lib/ui/Countdown.svelte";

  interface Props {
    post: Post;
    userVotes: UserVotes;
    rankingDrafts: RankingDrafts;
    swipeIndices: SwipeIndices;
    expandedPostId: string | null;
    expandedOptionId: string | null;
    addingPostId: string | null;
    onVote: (postId: string, value: string | string[]) => void;
    onToggleRank: (postId: string, optionId: string) => void;
    onPopRank: (postId: string) => void;
    onSwipe: (postId: string, direction: "left" | "right") => void;
    onAddCollab: (
      postId: string,
      text: string,
      image?: string | null,
      color?: string,
    ) => void;
    setExpanded: (postId: string | null, optionId: string | null) => void;
    setAdding: (postId: string | null) => void;
    switchToReels: (postId: string) => void;
    viewMode?: ViewMode;
    // New interaction handlers
    onComment?: (post: Post) => void;
    onShare?: (post: Post) => void;
    onRepost?: (post: Post) => void;
    onAvatarClick?: (post: Post) => void;
  }

  let {
    post,
    userVotes,
    rankingDrafts,
    swipeIndices,
    expandedPostId,
    expandedOptionId,
    addingPostId,
    onVote,
    onToggleRank,
    onPopRank,
    onSwipe,
    onAddCollab,
    setExpanded,
    setAdding,
    switchToReels,
    viewMode = "feed",
    onComment,
    onShare,
    onRepost,
    onAvatarClick,
  }: Props = $props();

  import { currentUser } from "$lib/stores/auth";
  import { loginModalOpen } from "$lib/stores/globalState";
  import PostOptionsModal from "$lib/components/PostOptionsModal.svelte";
  import CollabOptionEditor from "$lib/components/CollabOptionEditor.svelte";

  // Follow logic
  let isFollowing = $state(post.isFollowing || false);
  let isPending = $state(post.isPending || false);
  let showOptionsModal = $state(false);
  let showCollabEditor = $state(false);

  function handleCollabSubmit(text: string, img?: string, color?: string) {
    onAddCollab(post.id, text);
    // TODO: En el futuro pasar img y color cuando el backend lo soporte
    showCollabEditor = false;
  }

  // Bookmark logic
  let isBookmarked = $state(post.isBookmarked || false);
  let isBookmarking = $state(false);

  function handleReport() {
    alert(
      "Reporte enviado. Gracias por ayudar a mantener segura la comunidad.",
    );
    // TODO: Implement actual report API
  }

  function handleDelete() {
    if (confirm("¿Estás seguro de que quieres eliminar esta encuesta?")) {
      // TODO: Implement actual delete API
      alert("Encuesta eliminada (simulación)");
    }
  }

  $effect(() => {
    isFollowing = post.isFollowing || false;
    isPending = post.isPending || false;
    isBookmarked = post.isBookmarked || false;
  });

  const isSelf = $derived(
    $currentUser &&
      ((post.userId &&
        post.userId === ($currentUser.userId || ($currentUser as any).id)) ||
        post.author === $currentUser.username),
  );

  async function handleFollow() {
    if (!$currentUser) {
      loginModalOpen.set(true);
      return;
    }
    const oldFollow = isFollowing;
    const oldPending = isPending;

    // Optimistic update
    if (isPending) {
      isPending = false;
    } else if (isFollowing) {
      isFollowing = false;
    } else {
      // Si no sabemos si es privado, mostramos 'Siguiendo' temporalmente
      // El servidor corregirá si es 'pending'
      isFollowing = true;
    }

    try {
      const targetId = post.userId;
      if (!targetId) throw new Error("No user ID");

      // Si antes teniamos algo (pending o follow) y ahora nada -> DELETE
      // Si antes nada y ahora algo -> POST
      const isDeleting =
        (oldFollow || oldPending) && !isFollowing && !isPending;
      const method = isDeleting ? "DELETE" : "POST";

      const res = await fetch(`/api/users/${targetId}/follow`, { method });
      if (!res.ok) throw new Error("API Error");

      if (!isDeleting) {
        const data = await res.json();
        if (data.success && data.status) {
          isFollowing = data.status === "accepted";
          isPending = data.status === "pending";
        }
      }
    } catch (e) {
      isFollowing = oldFollow;
      isPending = oldPending;
      console.error("Error following:", e);
    }
  }

  async function handleBookmark() {
    if (!$currentUser) {
      loginModalOpen.set(true);
      return;
    }

    if (isBookmarking) return; // Prevent double-clicks

    const oldBookmarked = isBookmarked;

    // Optimistic update
    isBookmarked = !isBookmarked;
    isBookmarking = true;

    try {
      const method = oldBookmarked ? "DELETE" : "POST";
      const res = await fetch(`/api/polls/${post.id}/bookmark`, { method });

      if (!res.ok) {
        throw new Error("API Error");
      }
    } catch (e) {
      // Revert on error
      isBookmarked = oldBookmarked;
      console.error("Error bookmarking:", e);
    } finally {
      isBookmarking = false;
    }
  }

  const canAddOption = $derived.by(() => {
    // Si la encuesta está cerrada, nadie puede añadir
    if (isClosed) return false;

    // Si no hay usuario logueado, no puede añadir
    if (!$currentUser) return false;

    // Si soy el creador, siempre puedo añadir
    if (isSelf) return true;

    // Verificar permisos basados en collabMode
    const mode = (post as any).collabMode || "me";

    if (mode === "public") return true;
    if (mode === "me") return false;

    if (mode === "selected") {
      const collaborators = (post as any).collaborators || [];
      const userId = $currentUser.userId || ($currentUser as any).id;
      return collaborators.some((c: any) => c.userId === userId);
    }

    return false;
  });

  let swipeAnim = $state<"left" | "right" | null>(null);
  let expandedScrollRef: HTMLElement | null = $state(null);
  let currentExpandedIndex = $state(0);

  // Track if the countdown just expired (for real-time visual update)
  let expiredByCountdown = $state(false);

  function handleCountdownExpire() {
    expiredByCountdown = true;
  }

  // Scroll to the clicked option when expanded, or to last option when adding
  $effect(() => {
    if (expandedPostId === post.id && expandedOptionId && expandedScrollRef) {
      const optionIndex = sortedOptions.findIndex(
        (o) => o.id === expandedOptionId,
      );
      if (optionIndex >= 0) {
        currentExpandedIndex = optionIndex;
        requestAnimationFrame(() => {
          if (expandedScrollRef) {
            expandedScrollRef.scrollTo({
              left: optionIndex * expandedScrollRef.offsetWidth,
              behavior: "instant",
            });
          }
        });
      }
    }
    // When adding, scroll to the last option (the new one)
    if (isAdding && expandedScrollRef) {
      const lastIndex = displayOptions.length - 1;
      currentExpandedIndex = lastIndex;
      requestAnimationFrame(() => {
        if (expandedScrollRef) {
          expandedScrollRef.scrollTo({
            left: lastIndex * expandedScrollRef.offsetWidth,
            behavior: "instant",
          });
        }
      });
    }
  });

  function handleExpandedScroll(e: Event) {
    const target = e.target as HTMLElement;
    if (target) {
      const index = Math.round(target.scrollLeft / target.offsetWidth);
      currentExpandedIndex = index;
    }
  }

  function scrollToExpandedOption(index: number) {
    if (expandedScrollRef) {
      expandedScrollRef.scrollTo({
        left: index * expandedScrollRef.offsetWidth,
        behavior: "smooth",
      });
    }
  }

  function checkIsCorrect(optionId: string | number) {
    if (post.type !== "quiz") return false;
    const optIdStr = String(optionId);
    const correctIdStr = String(post.correctOptionId);
    const correctHash = (post as any).correctOptionHashId;
    return (
      optIdStr === correctIdStr || (correctHash && optIdStr === correctHash)
    );
  }

  const config = $derived(POST_CONFIGS[post.type] || POST_CONFIGS.standard);
  // Check if closed by initial date OR by countdown expiring in real-time
  const isClosed = $derived(
    expiredByCountdown ||
      (post.endsAt ? new Date(post.endsAt) < new Date() : false),
  );
  const hasVoted = $derived(!!userVotes[post.id]);
  const shouldShowResults = $derived(hasVoted || isClosed);
  const rankingDraft = $derived(rankingDrafts[post.id] || []);
  const isRankingComplete = $derived(
    post.type === "tierlist" &&
      !shouldShowResults &&
      rankingDraft.length === post.options.length,
  );
  const swipeIndex = $derived(swipeIndices[post.id] || 0);
  const isAdding = $derived(addingPostId === post.id);
  const isReels = $derived(viewMode === "reels");

  const maxItemsGrid = $derived(isReels ? 6 : 4);
  const containerHeight = $derived(isReels ? "flex-1 min-h-0" : "h-72");

  function handleSwipeTrigger(dir: "left" | "right") {
    if (swipeAnim) return;
    swipeAnim = dir;
    setTimeout(() => {
      onSwipe(post.id, dir);
      swipeAnim = null;
    }, 300);
  }

  const finalRanking = $derived(
    hasVoted ? (userVotes[post.id] as string[]) : rankingDraft,
  );

  const displayOptions = $derived.by(() => {
    let options = [...post.options];

    if (post.type === "tierlist") {
      if (!hasVoted) {
        if (isRankingComplete) {
          options.sort((a, b) => {
            const idxA = rankingDraft.indexOf(a.id);
            const idxB = rankingDraft.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          });
        } else {
          options = options.filter((o) => !rankingDraft.includes(o.id));
        }
      } else {
        options.sort((a, b) => {
          const idxA = finalRanking.indexOf(a.id);
          const idxB = finalRanking.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });
      }
    }

    if (isAdding && post.type !== "swipe") {
      options.push({
        id: "temp-new-option",
        title: "",
        votes: 0,
        friends: [],
        type: "text",
        colorFrom: "from-slate-700",
        colorTo: "to-slate-800",
        bgBar: "bg-slate-500",
      });
    }
    return options;
  });

  const sortedOptions = $derived.by(() => {
    let sorted = [...post.options];
    if (post.type === "tierlist" && finalRanking && finalRanking.length > 0) {
      sorted.sort(
        (a, b) => finalRanking.indexOf(a.id) - finalRanking.indexOf(b.id),
      );
    }
    return sorted;
  });

  function getIconComponent(iconName: string) {
    const icons: Record<string, any> = {
      BarChart2,
      Trophy,
      ListOrdered,
      Flame,
      Users,
      ArrowLeftRight,
    };
    return icons[iconName] || BarChart2;
  }

  function getRankForOption(optionId: string): number | null {
    if (post.type !== "tierlist") return null;
    if (hasVoted) {
      const r = (finalRanking as string[]).indexOf(optionId);
      return r !== -1 ? r + 1 : null;
    } else if (isRankingComplete) {
      const r = rankingDraft.indexOf(optionId);
      return r !== -1 ? r + 1 : null;
    }
    return null;
  }

  function isOptionSelected(optionId: string): boolean {
    const vote = userVotes[post.id];
    if (Array.isArray(vote)) {
      return vote.includes(optionId);
    }
    return vote === optionId;
  }

  // State for showing closed poll info popup
  let showClosedInfo = $state(false);

  // Quiz Feedback State
  let quizFeedback = $state<"correct" | "incorrect" | null>(null);

  function toggleClosedPollInfo() {
    showClosedInfo = !showClosedInfo;
    if (showClosedInfo) {
      setTimeout(() => {
        showClosedInfo = false;
      }, 4000);
    }
  }

  const closedDateFormatted = $derived.by(() => {
    if (!post.endsAt) return null;
    const date = new Date(post.endsAt);
    return {
      date: date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  function handleOptionVote(optionId: string) {
    if (isClosed) return;

    // Auth Check
    if (!$currentUser) {
      loginModalOpen.set(true);
      return;
    }

    // Visibility Check (Basic Client-Side)
    // If private/friends-only and not author/friend (complex logic, relying mostly on backend,
    // but at least auth check blocks anonymous votes)

    if (post.type === "tierlist") {
      onToggleRank(post.id, optionId);
    } else {
      // Quiz Feedback Logic
      // Quiz Feedback Logic
      if (post.type === "quiz") {
        // Robust check: compare as strings to handle number/string mismatch
        // AND check against hashId if available (in case frontend uses hashes)
        const targetId = String(optionId);
        const correctId = String(post.correctOptionId);
        const correctHash = (post as any).correctOptionHashId;

        const isCorrect =
          targetId === correctId || (correctHash && targetId === correctHash);

        quizFeedback = isCorrect ? "correct" : "incorrect";

        // Auto-hide feedback after 2s
        setTimeout(() => {
          quizFeedback = null;
        }, 2500);
      }

      onVote(post.id, optionId);
    }
  }
</script>

<article
  class="relative {isReels
    ? 'flex-1 h-full flex flex-col overflow-hidden'
    : 'mb-3'} w-full"
>
  {#if !isReels}
    <div
      class="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none opacity-50"
    ></div>
  {/if}

  <div class="relative {isReels ? 'flex-1 flex flex-col min-h-0' : 'pl-0.5'}">
    <!-- Header -->
    {#if !isReels}
      {@const Icon = getIconComponent(config.icon)}
      <div class="px-5 pt-2 pb-2">
        <div class="flex gap-3">
          <!-- Avatar -->
          <div
            class="relative flex-shrink-0 group cursor-pointer self-start"
            onclick={() => onAvatarClick?.(post)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === "Enter" && onAvatarClick?.(post)}
          >
            <div
              class="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-[#9ec264] to-[#7ba347] shadow-lg group-hover:shadow-[#9ec264]/20 transition-all"
            >
              <img
                src={post.avatar}
                alt={post.author}
                class="w-full h-full rounded-full bg-slate-800 object-cover border-2 border-slate-900"
              />
            </div>
          </div>

          <!-- Content Column -->
          <div class="flex-1 min-w-0 flex flex-col pt-0.5">
            <!-- Row 1: Name & Follow -->
            <div class="flex items-center gap-2 mb-0.5">
              <button
                onclick={() => onAvatarClick?.(post)}
                class="font-bold text-white text-sm tracking-tight hover:text-[#9ec264] cursor-pointer truncate transition-colors text-left"
                style="max-width: 14ch;"
                title={post.author}
              >
                {post.author}
              </button>
              {#if !isSelf}
                <button
                  onclick={handleFollow}
                  class="bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-lg transition-colors flex-shrink-0 ml-1 flex items-center {isFollowing
                    ? '!bg-emerald-500/20 !text-emerald-400'
                    : ''} {isPending
                    ? '!bg-yellow-500/20 !text-yellow-400'
                    : ''}"
                >
                  {#if isFollowing}
                    <UserCheck size={14} class="mr-1" />
                    <span>Siguiendo</span>
                  {:else if isPending}
                    <Clock size={14} class="mr-1" />
                    <span>Solicitado</span>
                  {:else}
                    <UserPlus size={14} class="mr-1" />
                    <span>Seguir</span>
                  {/if}
                </button>
              {/if}
            </div>

            <!-- Row 2: Metadata (Time • Expiration • Extra) -->
            <div
              class="flex items-center gap-2 mb-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium"
            >
              <!-- Time posted -->
              <span class="flex-shrink-0">{post.time}</span>
              <span class="text-slate-700">•</span>

              <!-- Expiration -->
              {#if post.endsAt}
                <div
                  class="flex items-center gap-1 text-orange-400/90 flex-shrink-0"
                >
                  <Clock size={10} strokeWidth={2.5} />
                  <Countdown
                    date={post.endsAt}
                    fallback="Expira pronto"
                    onExpire={handleCountdownExpire}
                  />
                </div>
              {:else}
                <div
                  class="flex items-center gap-1 text-slate-500 flex-shrink-0"
                  title="Sin límite"
                >
                  <InfinityIcon size={12} strokeWidth={2.5} />
                </div>
              {/if}

              <span class="text-slate-700">•</span>

              <!-- Extra Item (Category/Public Scope) -->
              <div class="flex items-center gap-1 text-slate-500 flex-shrink-0">
                <Globe size={10} strokeWidth={2.5} />
                <span>Público</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Actions -->
          <div class="flex flex-col items-end gap-2 ml-1 flex-shrink-0">
            <!-- Actions (Top) -->
            <div class="flex items-center gap-1">
              <button
                onclick={() => switchToReels(post.id)}
                class="text-slate-500 hover:text-indigo-400 p-1.5 rounded-full hover:bg-white/5 transition-all active:scale-95"
                title="Ver en modo Top"
              >
                <img
                  src="/rel_ico.PNG"
                  alt="Reels"
                  class="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity"
                />
              </button>
              <button
                onclick={() => (showOptionsModal = true)}
                class="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-full transition-all active:scale-95"
                title="Más opciones"
              >
                <MoreVertical size={20} />
              </button>
            </div>
          </div>
        </div>

        <!-- Question + Badge Row -->
        <div class="flex items-start justify-between gap-3 mt-1.5 px-0.5">
          <p
            class="text-white/95 text-[1rem] font-bold leading-snug break-words flex-1"
          >
            {post.question}
          </p>

          <div
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md {config.badge} bg-opacity-10 border border-current/20 flex-shrink-0 self-start mt-0.5"
          >
            <Icon size={10} strokeWidth={3} />
            <span class="text-[0.65rem] font-black uppercase tracking-widest"
              >{config.label}</span
            >
          </div>
        </div>
      </div>
    {:else}
      {@const Icon = getIconComponent(config.icon)}
      <div
        class="px-5 pt-2 pb-2 bg-gradient-to-b from-black/60 via-black/30 to-transparent"
      >
        <div class="flex gap-3">
          <!-- Back Button (Reels Only) -->
          <button
            onclick={() => switchToReels("")}
            class="self-start p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors mt-0.5"
          >
            <ArrowLeft size={20} />
          </button>

          <!-- Avatar -->
          <div
            class="relative flex-shrink-0 group cursor-pointer self-start"
            onclick={() => onAvatarClick?.(post)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === "Enter" && onAvatarClick?.(post)}
          >
            <div
              class="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-[#9ec264] to-[#7ba347] shadow-lg group-hover:shadow-[#9ec264]/20 transition-all"
            >
              <img
                src={post.avatar}
                alt={post.author}
                class="w-full h-full rounded-full bg-slate-800 object-cover border-2 border-slate-900"
              />
            </div>
          </div>

          <!-- Content Column -->
          <div class="flex-1 min-w-0 flex flex-col pt-0.5">
            <!-- Row 1: Name & Follow -->
            <div class="flex items-center gap-2 mb-0.5">
              <button
                onclick={() => onAvatarClick?.(post)}
                class="font-bold text-white text-sm tracking-tight hover:text-[#9ec264] cursor-pointer truncate transition-colors text-left"
                style="max-width: 14ch;"
                title={post.author}
              >
                {post.author}
              </button>
              {#if !isSelf}
                <button
                  onclick={handleFollow}
                  class="bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-lg transition-colors flex-shrink-0 ml-1 flex items-center {isFollowing
                    ? '!bg-emerald-500/20 !text-emerald-400'
                    : ''} {isPending
                    ? '!bg-yellow-500/20 !text-yellow-400'
                    : ''}"
                >
                  {#if isFollowing}
                    <UserCheck size={14} class="mr-1" />
                    <span>Siguiendo</span>
                  {:else if isPending}
                    <Clock size={14} class="mr-1" />
                    <span>Solicitado</span>
                  {:else}
                    <UserPlus size={14} class="mr-1" />
                    <span>Seguir</span>
                  {/if}
                </button>
              {/if}
            </div>

            <!-- Row 2: Metadata (Time • Expiration • Extra) -->
            <div
              class="flex items-center gap-2 mb-1.5 text-[10px] sm:text-[11px] text-slate-300 font-medium"
            >
              <!-- Time posted -->
              <span class="flex-shrink-0">{post.time}</span>
              <span class="text-slate-400">•</span>

              <!-- Expiration -->
              {#if post.endsAt}
                <div
                  class="flex items-center gap-1 text-orange-400/90 flex-shrink-0"
                >
                  <Clock size={10} strokeWidth={2.5} />
                  <Countdown
                    date={post.endsAt}
                    fallback="Expira pronto"
                    onExpire={handleCountdownExpire}
                  />
                </div>
              {:else}
                <div
                  class="flex items-center gap-1 text-slate-300 flex-shrink-0"
                  title="Sin límite"
                >
                  <InfinityIcon size={12} strokeWidth={2.5} />
                </div>
              {/if}

              <span class="text-slate-400">•</span>

              <!-- Extra Item (Category/Public Scope) -->
              <div class="flex items-center gap-1 text-slate-300 flex-shrink-0">
                <Globe size={10} strokeWidth={2.5} />
                <span>Público</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Actions -->
          <div class="flex flex-col items-end gap-2 ml-1 flex-shrink-0">
            <!-- Actions (Top) -->
            <div class="flex items-center gap-1">
              <button
                onclick={() => (showOptionsModal = true)}
                class="text-slate-200 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-all active:scale-95 bg-black/20 backdrop-blur-sm"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
        </div>

        <!-- Question + Badge Row -->
        <div class="flex items-start justify-between gap-3 mt-1.5 px-0.5">
          <p
            class="text-white/95 text-lg font-bold leading-snug break-words flex-1 drop-shadow-md"
          >
            {post.question}
          </p>

          <div
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md {config.badge} bg-opacity-20 border border-white/20 backdrop-blur-sm flex-shrink-0 self-start mt-0.5"
          >
            <Icon size={10} strokeWidth={3} />
            <span class="text-[0.65rem] font-black uppercase tracking-widest"
              >{config.label}</span
            >
          </div>
        </div>
      </div>
    {/if}

    <div
      class="w-full relative mt-1 {isReels
        ? 'flex-1 flex flex-col min-h-0'
        : ''}"
    >
      <!-- Swipe Mode -->
      {#if post.type === "swipe" && !shouldShowResults}
        <div
          class="{containerHeight} relative w-full flex justify-center items-center overflow-hidden px-4 py-2"
        >
          {#if post.options[swipeIndex]}
            <div
              class="absolute inset-0 z-0 w-full h-full bg-slate-800 rounded-2xl shadow-xl overflow-hidden transform scale-95 opacity-50 translate-y-2"
            >
              {#if post.options[swipeIndex + 1]}
                <img
                  src={post.options[swipeIndex + 1].image}
                  class="absolute inset-0 w-full h-full object-cover grayscale"
                  alt=""
                />
              {/if}
            </div>

            <div
              class="absolute inset-0 z-10 w-full h-full bg-slate-800 rounded-2xl shadow-2xl overflow-hidden {swipeAnim ===
              'left'
                ? 'transition-all duration-300 -translate-x-[150%] -rotate-12 opacity-0'
                : swipeAnim === 'right'
                  ? 'transition-all duration-300 translate-x-[150%] rotate-12 opacity-0'
                  : 'transition-all duration-300'}"
            >
              <img
                src={post.options[swipeIndex].image ||
                  `https://picsum.photos/seed/${post.options[swipeIndex].id}/600/800`}
                class="absolute inset-0 w-full h-full object-cover"
                alt=""
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"
              ></div>
              <div class="absolute bottom-20 left-6 right-6 z-10">
                <h3
                  class="text-3xl font-black text-white drop-shadow-lg leading-none"
                >
                  {post.options[swipeIndex].title}
                </h3>
                <p
                  class="text-xs font-bold text-white/60 mt-2 uppercase tracking-widest"
                >
                  {swipeIndex + 1} de {post.options.length}
                </p>
              </div>
              <div
                class="absolute bottom-5 w-full flex justify-center gap-10 px-8 z-30"
              >
                <button
                  onclick={() => handleSwipeTrigger("left")}
                  class="p-4 bg-slate-950/50 hover:bg-red-500/90 text-red-500 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95"
                >
                  <X size={28} />
                </button>
                <button
                  onclick={() => handleSwipeTrigger("right")}
                  class="p-4 bg-slate-950/50 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95"
                  style="color: #9ec264;"
                >
                  <Heart size={28} fill="currentColor" />
                </button>
              </div>
            </div>
          {:else}
            <div class="text-white text-center">
              <Check size={40} class="mx-auto mb-2 text-emerald-500" />
              <p class="font-bold">¡Completado!</p>
            </div>
          {/if}
        </div>
      {:else}
        <!-- GRID PRINCIPAL -->
        {@const count = displayOptions.length}
        {@const maxVisible = isReels ? 6 : 4}
        {@const useCarousel = count > maxVisible}
        <div
          class="w-full relative z-10 {isReels
            ? `flex-1 flex flex-col ${post.type === 'swipe' ? 'pt-12' : 'pt-2'} px-4 pb-6 min-h-0`
            : 'pl-5 pr-5 pt-1'}"
        >
          <div
            class="relative w-full {isReels
              ? 'flex-1 py-[5px]'
              : `${containerHeight} py-[5px]`} {useCarousel
              ? 'overflow-x-auto scrollbar-hide'
              : ''}"
          >
            {#if useCarousel}
              {#if post.type === "tierlist"}
                <div class="flex gap-2 h-full" style="min-width: max-content;">
                  {#each displayOptions as opt, idx (opt.id)}
                    {@const rank = getRankForOption(opt.id)}
                    <div
                      style="width: {isReels
                        ? '42vw'
                        : '10rem'}; flex-shrink: 0;"
                      class="relative overflow-hidden rounded-xl h-full"
                    >
                      <OptionCard
                        option={opt}
                        postTotalVotes={post.totalVotes}
                        hasVoted={shouldShowResults}
                        isSelected={hasVoted && isOptionSelected(opt.id)}
                        isCorrectOption={false}
                        isExpanded={false}
                        isEditing={opt.id === "temp-new-option"}
                        isHidden={expandedPostId === post.id &&
                          expandedOptionId === opt.id}
                        onToggleExpand={() => setExpanded(post.id, opt.id)}
                        onEditConfirm={(txt, img, col) =>
                          onAddCollab(post.id, txt, img, col)}
                        onVote={handleOptionVote}
                        {rank}
                        nextRank={rankingDraft.length + 1}
                        totalOptions={post.options.length}
                        postType={post.type}
                        {viewMode}
                      />
                    </div>
                  {/each}
                </div>
              {:else}
                {@const hasLongText = displayOptions.some(
                  (opt) => opt.title && opt.title.length > 40,
                )}
                {@const itemsPerPage = isReels ? (hasLongText ? 4 : 6) : 4}
                {@const totalPages = Math.ceil(count / itemsPerPage)}
                <div
                  class="flex gap-3 h-full snap-x snap-mandatory overflow-x-auto scrollbar-hide pl-1"
                  style="scroll-snap-type: x mandatory; scroll-padding-left: 4px;"
                >
                  {#each Array(totalPages) as _, pageIdx}
                    {@const pageOptions = displayOptions.slice(
                      pageIdx * itemsPerPage,
                      (pageIdx + 1) * itemsPerPage,
                    )}
                    {@const forceList =
                      isReels && (pageOptions.length === 2 || hasLongText)}
                    {@const pageGridRows = forceList
                      ? pageOptions.length
                      : isReels
                        ? pageOptions.length <= 2
                          ? 1
                          : pageOptions.length <= 4
                            ? 2
                            : 3
                        : 2}
                    {@const isLastPage = pageIdx === totalPages - 1}
                    {@const rowHeight = forceList ? "16rem" : "1fr"}
                    <div
                      class="flex-shrink-0 h-full snap-start grid gap-4 place-content-center"
                      style="width: {isLastPage
                        ? '100%'
                        : '92%'}; grid-template-columns: {forceList
                        ? '1fr'
                        : '1fr 1fr'}; grid-template-rows: repeat({pageGridRows}, {rowHeight});"
                    >
                      {#each pageOptions as opt, idx (opt.id)}
                        {@const rank = getRankForOption(opt.id)}
                        {@const pageCount = pageOptions.length}
                        {@const itemStyle = (() => {
                          if (pageCount === 1)
                            return "grid-column: 1 / -1; grid-row: 1 / -1;";
                          if (pageCount === 2) {
                            return forceList
                              ? "grid-column: 1 / -1;"
                              : "grid-row: 1 / -1;";
                          }
                          if (pageCount === 3 && idx === 0)
                            return "grid-column: 1 / -1;";
                          return "";
                        })()}
                        <div
                          style={itemStyle}
                          class="relative overflow-hidden rounded-xl h-full"
                        >
                          <OptionCard
                            option={opt}
                            postTotalVotes={post.totalVotes}
                            hasVoted={shouldShowResults}
                            isSelected={hasVoted && isOptionSelected(opt.id)}
                            isCorrectOption={checkIsCorrect(opt.id)}
                            isExpanded={false}
                            isEditing={opt.id === "temp-new-option"}
                            isHidden={expandedPostId === post.id &&
                              expandedOptionId === opt.id}
                            onToggleExpand={() => setExpanded(post.id, opt.id)}
                            onEditConfirm={(txt, img, col) =>
                              onAddCollab(post.id, txt, img, col)}
                            onVote={handleOptionVote}
                            {rank}
                            nextRank={rankingDraft.length + 1}
                            totalOptions={post.options.length}
                            postType={post.type}
                            {viewMode}
                          />
                        </div>
                      {/each}
                    </div>
                  {/each}
                </div>
              {/if}
            {:else}
              {@const gridRows = isReels
                ? count <= 2
                  ? 1
                  : count <= 4
                    ? 2
                    : 3
                : 2}
              {@const rowHeight = "1fr"}
              <div
                class="grid gap-2 h-full"
                style="grid-template-columns: 1fr 1fr; grid-template-rows: repeat({gridRows}, {rowHeight});"
              >
                {#each displayOptions as opt, idx (opt.id)}
                  {@const rank = getRankForOption(opt.id)}
                  {@const itemStyle = (() => {
                    if (count === 1)
                      return "grid-column: 1 / -1; grid-row: 1 / -1;";
                    if (count === 2) return "grid-row: 1 / -1;";
                    if (count === 3 && idx === 0) return "grid-column: 1 / -1;";
                    if (count === 5 && idx === 4) return "grid-column: 1 / -1;";
                    return "";
                  })()}
                  <div
                    style={itemStyle}
                    class="relative overflow-hidden rounded-xl transition-all duration-300 group h-full"
                  >
                    <OptionCard
                      option={opt}
                      postTotalVotes={post.totalVotes}
                      hasVoted={shouldShowResults}
                      isSelected={hasVoted && isOptionSelected(opt.id)}
                      isCorrectOption={checkIsCorrect(opt.id)}
                      isExpanded={false}
                      isEditing={opt.id === "temp-new-option"}
                      isHidden={expandedPostId === post.id &&
                        expandedOptionId === opt.id}
                      onToggleExpand={() => setExpanded(post.id, opt.id)}
                      onEditConfirm={(txt, img, col) =>
                        onAddCollab(post.id, txt, img, col)}
                      onVote={handleOptionVote}
                      {rank}
                      nextRank={rankingDraft.length + 1}
                      totalOptions={post.options.length}
                      postType={post.type}
                      {viewMode}
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if expandedPostId === post.id || isAdding}
        {@const expandedOptions = isAdding ? displayOptions : sortedOptions}
        <div
          class="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xl rounded-xl overflow-hidden animate-in fade-in duration-300 ring-1 ring-white/10 shadow-2xl"
        >
          <div
            class="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            bind:this={expandedScrollRef}
            onscroll={handleExpandedScroll}
          >
            {#each expandedOptions as opt, idx}
              {@const rank = getRankForOption(opt.id)}
              <div class="w-full h-full flex-shrink-0 snap-center relative">
                <OptionCard
                  option={opt}
                  postTotalVotes={post.totalVotes}
                  hasVoted={shouldShowResults}
                  isSelected={hasVoted && isOptionSelected(opt.id)}
                  isCorrectOption={checkIsCorrect(opt.id)}
                  isExpanded={true}
                  isEditing={opt.id === "temp-new-option"}
                  onToggleExpand={() => {
                    setExpanded(null, null);
                    setAdding(null);
                    // Switch to Reels mode when clicking on expanded option
                    switchToReels(post.id);
                  }}
                  onEditConfirm={(txt, img, col) => {
                    onAddCollab(post.id, txt, img, col);
                    setAdding(null);
                  }}
                  onVote={(optId) => {
                    handleOptionVote(optId);
                    setExpanded(null, null);
                    setAdding(null);
                  }}
                  postType={post.type}
                  totalOptions={post.options.length}
                  {rank}
                  {viewMode}
                />
              </div>
            {/each}
          </div>

          <!-- Pagination Dots for Expanded View -->
          {#if expandedOptions.length > 1}
            <div
              class="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-40 pointer-events-none"
            >
              {#each expandedOptions as _, i}
                <div
                  class="w-1.5 h-1.5 rounded-full transition-all duration-300 {i ===
                  currentExpandedIndex
                    ? 'bg-white w-3'
                    : 'bg-white/30'}"
                ></div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Tierlist Ranking Tray (Docked) -->
    {#if post.type === "tierlist" && !hasVoted && rankingDraft.length > 0}
      <div
        class="relative z-20 px-4 py-3 bg-slate-900/40 border-y border-white/5 backdrop-blur-md flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-300"
      >
        <!-- Selected Options Tray -->
        <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {#each rankingDraft as optionId, idx}
            {@const opt = post.options.find((o) => o.id === optionId)}
            {#if opt}
              <button
                onclick={() => onToggleRank(post.id, optionId)}
                class="relative flex-shrink-0 animate-in zoom-in-75 duration-200 group/tray"
                title="Quitar de la lista"
              >
                <div
                  class="w-12 h-12 rounded-lg overflow-hidden border border-indigo-500/30 shadow-lg bg-slate-900 group-hover/tray:border-red-500/50 transition-colors"
                >
                  {#if opt.image}
                    <img
                      src={opt.image}
                      class="w-full h-full object-cover group-hover/tray:opacity-50 transition-opacity"
                      alt=""
                    />
                  {:else}
                    <div
                      class="w-full h-full bg-gradient-to-br {opt.colorFrom} {opt.colorTo} flex items-center justify-center p-1 group-hover/tray:opacity-50 transition-opacity"
                    >
                      <span
                        class="text-white text-[8px] font-black text-center leading-tight uppercase"
                        >{opt.title.substring(0, 8)}</span
                      >
                    </div>
                  {/if}
                  <div
                    class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/tray:opacity-100 transition-opacity"
                  >
                    <X size={16} class="text-white drop-shadow-md" />
                  </div>
                </div>
                <div
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[9px] font-black text-white border border-slate-950 shadow-md group-hover/tray:bg-red-600 transition-colors"
                >
                  {idx + 1}
                </div>
              </button>
            {/if}
          {/each}
        </div>

        <div class="flex items-center justify-center gap-2">
          <button
            onclick={() => onPopRank(post.id)}
            class="bg-white/5 hover:bg-white/10 text-white font-bold px-[0.7rem] py-[0.4rem] rounded-lg border border-white/10 flex items-center gap-[0.4rem] text-[0.7rem] transition-all active:scale-95"
          >
            <RotateCcw size="0.9rem" /> Deshacer
          </button>
          {#if isRankingComplete}
            <button
              onclick={() => onVote(post.id, [...rankingDraft])}
              class="flex-1 bg-white text-indigo-950 font-black px-[1rem] py-[0.4rem] rounded-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-[0.5rem] text-[0.7rem]"
            >
              CONFIRMAR <Check size="0.9rem" strokeWidth={3} />
            </button>
          {:else}
            <div
              class="flex-1 bg-white/5 border border-white/5 rounded-lg px-[0.7rem] py-[0.4rem] flex items-center justify-center"
            >
              <span
                class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest"
              >
                Faltan {post.options.length - rankingDraft.length}
              </span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Footer Icons -->
    <div
      class="mt-auto shrink-0 pt-2 {isReels
        ? 'pb-4'
        : 'pb-0'} flex items-center justify-between {isReels ? 'px-6' : 'px-4'}"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-[0.4rem] text-slate-400 bg-slate-900/50 px-[0.7rem] py-[0.3rem] rounded-full border border-white/5 text-[0.75rem] font-bold"
        >
          <BarChart2 size="0.75rem" class={config.color} />
          <span>{post.totalVotes.toLocaleString()}</span>
        </div>
      </div>
      <div
        class="flex items-center {isReels ? 'gap-[0.8rem]' : 'gap-[1.2rem]'}"
      >
        <div
          class="flex items-center {isReels ? 'gap-[1rem]' : 'gap-[1.5rem]'}"
        >
          <button
            onclick={() => onComment?.(post)}
            class="flex items-center gap-[0.4rem] text-slate-400 hover:text-blue-400 transition-colors group"
          >
            <MessageCircle
              size="1.1rem"
              class="group-hover:scale-110 transition-transform"
            />
            <span class="text-[0.7rem] font-bold">{post.comments || 0}</span>
          </button>
          <button
            onclick={() => onRepost?.(post)}
            class="flex items-center gap-[0.4rem] text-slate-400 hover:text-emerald-400 transition-colors group"
          >
            <Repeat2
              size="1.1rem"
              class="group-hover:scale-110 transition-transform"
            />
            <span class="text-[0.7rem] font-bold">{post.reposts || 0}</span>
          </button>
          <button
            onclick={handleBookmark}
            disabled={isBookmarking}
            class="transition-colors hover:scale-110 transform {isBookmarked
              ? 'text-yellow-400'
              : 'text-slate-400 hover:text-yellow-400'} {isBookmarking
              ? 'opacity-50'
              : ''}"
            title={isBookmarked ? "Quitar de guardados" : "Guardar encuesta"}
          >
            <Bookmark
              size="1.1rem"
              fill={isBookmarked ? "currentColor" : "none"}
            />
          </button>
          <button
            onclick={() => onShare?.(post)}
            class="text-slate-400 hover:text-indigo-400 transition-colors hover:scale-110 transform"
          >
            <Share2 size="1.1rem" />
          </button>
        </div>
        {#if isClosed || canAddOption}
          <div class="w-px h-[1rem] bg-white/10"></div>
        {/if}
        <div class="relative">
          {#if isClosed}
            <!-- Poll is closed - show lock icon with popup on click -->
            <button
              onclick={toggleClosedPollInfo}
              class="flex items-center justify-center w-[2.2rem] h-[2.2rem] rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/30 hover:bg-slate-600/50 hover:text-slate-400 transition-all active:scale-95"
              title="Encuesta cerrada"
            >
              <Lock size="1rem" strokeWidth={2.5} />
            </button>

            <!-- Info popup -->
            {#if showClosedInfo}
              <div
                class="absolute bottom-full right-0 mb-2 w-56 p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50"
              >
                <!-- Arrow -->
                <div
                  class="absolute -bottom-1.5 right-4 w-3 h-3 bg-slate-900/95 rotate-45 border-r border-b border-white/10"
                ></div>

                <div class="flex items-center gap-2 mb-2">
                  <div class="p-1.5 rounded-lg bg-red-500/20">
                    <Lock size={14} class="text-red-400" />
                  </div>
                  <span class="text-sm font-bold text-white"
                    >Encuesta Cerrada</span
                  >
                </div>

                {#if closedDateFormatted}
                  <p class="text-xs text-slate-400 mb-1.5">
                    Finalizó el <span class="text-slate-300 font-medium"
                      >{closedDateFormatted.date}</span
                    >
                    a las
                    <span class="text-slate-300 font-medium"
                      >{closedDateFormatted.time}</span
                    >
                  </p>
                {/if}

                <div
                  class="flex items-center gap-1.5 pt-2 border-t border-white/5"
                >
                  <BarChart2 size={12} class="text-indigo-400" />
                  <span class="text-xs text-slate-400">Total:</span>
                  <span class="text-xs font-bold text-white"
                    >{post.totalVotes.toLocaleString()} votos</span
                  >
                </div>
              </div>
            {/if}
          {:else}
            <!-- Poll is open - show add button if user has permission -->
            {#if canAddOption}
              <button
                onclick={() => setAdding(post.id)}
                class="flex items-center justify-center w-[2.2rem] h-[2.2rem] rounded-full text-black transition-all duration-300 shadow-lg group hover:scale-110"
                style="background-color: #9ec264;"
              >
                <Plus
                  size="1.1rem"
                  strokeWidth={3}
                  class="group-hover:rotate-90 transition-transform duration-300"
                />
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
  <!-- Quiz Feedback Overlay -->
  {#if quizFeedback === "correct"}
    <div
      class="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden rounded-xl"
      in:scale={{ duration: 300, start: 0.8 }}
      out:scale={{ duration: 200, start: 0.8, opacity: 0 }}
    >
      <div class="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px]"></div>
      <div
        class="text-[5rem] md:text-[8rem] animate-bounce drop-shadow-2xl z-10"
      >
        🎉
      </div>

      <!-- Simple CSS confetti particles -->
      {#each Array(12) as _, i}
        <div
          class="absolute w-2 h-2 rounded-full animate-ping"
          style="
                      top: {50 + (Math.random() * 40 - 20)}%;
                      left: {50 + (Math.random() * 40 - 20)}%;
                      background-color: {[
            '#ff0000',
            '#00ff00',
            '#0000ff',
            '#ffff00',
            '#ff00ff',
          ][Math.floor(Math.random() * 5)]};
                      opacity: 0.8;
                      animation-duration: {0.6 + Math.random() * 0.4}s;
                      animation-delay: {Math.random() * 0.1}s;
                  "
        ></div>
      {/each}

      <div
        class="absolute bottom-10 bg-emerald-500 py-2 px-6 rounded-full text-white font-black text-xl shadow-lg animate-bounce"
      >
        ¡Correcto!
      </div>
    </div>
  {:else if quizFeedback === "incorrect"}
    <div
      class="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden rounded-xl"
      in:scale={{ duration: 300, start: 0.8 }}
      out:scale={{ duration: 200, start: 0.8, opacity: 0 }}
    >
      <div class="absolute inset-0 bg-red-500/20 backdrop-blur-[2px]"></div>
      <div
        class="text-[5rem] md:text-[8rem] animate-pulse drop-shadow-2xl z-10"
      >
        😢
      </div>

      <div
        class="absolute bottom-10 bg-red-500 py-2 px-6 rounded-full text-white font-black text-xl shadow-lg"
      >
        ¡Fallaste!
      </div>
    </div>
  {/if}
</article>

<PostOptionsModal
  isOpen={showOptionsModal}
  {post}
  onClose={() => (showOptionsModal = false)}
  onReport={handleReport}
  onDelete={handleDelete}
/>
