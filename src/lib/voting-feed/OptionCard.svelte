<script lang="ts">
  import { Check, X, Minimize2, Sparkles } from "lucide-svelte";
  import type { VoteOption, PostType, ViewMode } from "./types";
  import { POST_CONFIGS } from "./types";
  import { calculatePercent } from "./helpers";
  import SocialAvatars from "./SocialAvatars.svelte";

  interface Props {
    option: VoteOption;
    postTotalVotes: number;
    hasVoted: boolean;
    isSelected: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onVote: (optionId: string) => void;
    postType: PostType;
    isCorrectOption?: boolean;
    rank?: number | null;
    nextRank?: number;
    totalOptions?: number;
    isHidden?: boolean;
    isEditing?: boolean;
    onEditConfirm?: (text: string) => void;
    viewMode?: ViewMode;
  }

  let {
    option,
    postTotalVotes,
    hasVoted,
    isSelected,
    isExpanded,
    onToggleExpand,
    onVote,
    postType,
    isCorrectOption = false,
    rank = null,
    nextRank = 1,
    totalOptions = 6,
    isHidden = false,
    isEditing = false,
    onEditConfirm,
    viewMode = "feed",
  }: Props = $props();

  // Dynamic rainbow color generator based on position and total options
  // Returns { class: string, style: string } for proper rendering
  function getRankColor(
    position: number,
    total: number,
  ): { class: string; style: string } {
    if (position === 1)
      return {
        class:
          "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950",
        style: "",
      };
    if (position === 2)
      return {
        class: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
        style: "",
      };
    if (position === 3)
      return {
        class: "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100",
        style: "",
      };

    // Rainbow colors for positions 4+
    const rainbowColors = [
      "#10b981", // emerald
      "#14b8a6", // teal
      "#06b6d4", // cyan
      "#0ea5e9", // sky
      "#3b82f6", // blue
      "#6366f1", // indigo
      "#8b5cf6", // violet
      "#a855f7", // purple
      "#d946ef", // fuchsia
      "#ec4899", // pink
      "#f43f5e", // rose
      "#ef4444", // red
      "#f97316", // orange
    ];

    const remainingPositions = total - 3;
    const positionIndex = position - 4;

    let colorIndex: number;
    if (remainingPositions <= rainbowColors.length) {
      colorIndex = positionIndex % rainbowColors.length;
    } else {
      const ratio = positionIndex / (remainingPositions - 1);
      colorIndex = Math.floor(ratio * (rainbowColors.length - 1));
    }

    const bgColor = rainbowColors[colorIndex];
    return { class: "text-white", style: `background-color: ${bgColor};` };
  }

  // Get vote button style based on post type
  function getVoteButtonStyle(type: PostType): {
    bg: string;
    text: string;
    bgHover: string;
    bgSolid: string;
    textSolid: string;
  } {
    const colorMap: Record<
      PostType,
      {
        bg: string;
        text: string;
        bgHover: string;
        bgSolid: string;
        textSolid: string;
      }
    > = {
      standard: {
        bg: "rgba(158, 194, 100, 0.25)",
        text: "#9ec264",
        bgHover: "rgba(158, 194, 100, 0.4)",
        bgSolid: "#9ec264",
        textSolid: "#000000",
      },
      quiz: {
        bg: "rgba(234, 179, 8, 0.25)",
        text: "#eab308",
        bgHover: "rgba(234, 179, 8, 0.4)",
        bgSolid: "#eab308",
        textSolid: "#000000",
      },
      tierlist: {
        bg: "rgba(99, 102, 241, 0.25)",
        text: "#818cf8",
        bgHover: "rgba(99, 102, 241, 0.4)",
        bgSolid: "#6366f1",
        textSolid: "#ffffff",
      },
      swipe: {
        bg: "rgba(239, 68, 68, 0.25)",
        text: "#ef4444",
        bgHover: "rgba(239, 68, 68, 0.4)",
        bgSolid: "#ef4444",
        textSolid: "#ffffff",
      },
      collab: {
        bg: "rgba(16, 185, 129, 0.25)",
        text: "#10b981",
        bgHover: "rgba(16, 185, 129, 0.4)",
        bgSolid: "#10b981",
        textSolid: "#ffffff",
      },
    };
    return colorMap[type] || colorMap.standard;
  }

  let editText = $state("");
  let isExiting = $state(false);
  let inputRef: HTMLTextAreaElement | null = $state(null);
  let imageError = $state(false);
  let fetchedThumbnail = $state<string | null>(null);
  let thumbnailLoading = $state(false);

  // Reset exiting state when the option gets ranked (reappears in the full list)
  $effect(() => {
    if (rank !== null) {
      isExiting = false;
    }
  });

  // Check if URL is a direct image or known image service
  function isDirectImage(url: string): boolean {
    if (!url) return false;
    // Check for image extensions
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)([?#]|$)/i.test(url)) return true;
    // Known image services that serve images without extensions
    if (url.includes("images.unsplash.com")) return true;
    if (url.includes("picsum.photos")) return true;
    if (url.includes("i.imgur.com")) return true;
    if (url.includes("pbs.twimg.com")) return true;
    if (url.includes("cdn.discordapp.com")) return true;
    return false;
  }

  // Determine the actual image URL to use
  const actualImageUrl = $derived(
    fetchedThumbnail ||
      (isDirectImage(option.image || "") ? option.image : null),
  );

  // Determine if we should show image (has image URL and no error)
  // Show image if: type is 'image' OR there's a valid image URL
  const showImage = $derived(
    (option.type === "image" || option.image) && actualImageUrl && !imageError,
  );

  function handleImageError() {
    console.log("[OptionCard] Image failed to load:", actualImageUrl);
    imageError = true;
  }

  // Fetch thumbnail from link-preview API for non-direct-image URLs
  $effect(() => {
    const url = option.image;
    if (!url || isDirectImage(url) || fetchedThumbnail) return;

    thumbnailLoading = true;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((result) => {
        const data = result.data || result;
        const thumbnail =
          data.imageProxied ||
          data.image ||
          data.thumbnailUrl ||
          data.thumbnail_url;
        if (thumbnail) {
          console.log("[OptionCard] Fetched thumbnail:", thumbnail);
          fetchedThumbnail = thumbnail;
        } else {
          console.log("[OptionCard] No thumbnail found for:", url);
        }
      })
      .catch((err) => {
        console.warn("[OptionCard] Failed to fetch thumbnail:", err);
      })
      .finally(() => {
        thumbnailLoading = false;
      });
  });

  const percent = $derived(calculatePercent(option.votes, postTotalVotes));

  function handleVoteAction(e: MouseEvent) {
    e.stopPropagation();
    if (postType === "tierlist" && !rank && !hasVoted) {
      isExiting = true;
      setTimeout(() => {
        onVote(option.id);
      }, 300);
    } else {
      onVote(option.id);
    }
  }

  function handleEditConfirm(e: MouseEvent) {
    e.stopPropagation();
    onEditConfirm?.(editText);
  }

  // Status colors based on vote state
  const statusClasses = $derived.by(() => {
    let statusColor = "";
    let bgOverlay = "";
    let glowEffect = "";

    if (postType === "quiz" && hasVoted) {
      if (isCorrectOption) {
        statusColor = "ring-2 ring-emerald-500/80 border-transparent";
        bgOverlay = "bg-emerald-900/30";
        glowEffect = "shadow-[0_0_20px_rgba(16,185,129,0.3)]";
      } else if (isSelected) {
        statusColor = "ring-2 ring-red-500/80 border-transparent";
        bgOverlay = "bg-red-900/30";
      } else {
        statusColor = "opacity-40 grayscale-[0.8]";
      }
    }

    if (postType === "tierlist" && rank) {
      statusColor = "ring-2 ring-indigo-500 border-transparent";
      glowEffect = "shadow-[0_0_15px_rgba(99,102,241,0.2)]";
      if (rank === 1) {
        statusColor = "ring-2 ring-yellow-400 border-transparent";
        glowEffect = "shadow-[0_0_25px_rgba(250,204,21,0.4)]";
      }
      if (rank === 2) statusColor = "ring-2 ring-slate-300 border-transparent";
      if (rank === 3) statusColor = "ring-2 ring-amber-700 border-transparent";
    }

    return { statusColor, bgOverlay, glowEffect };
  });

  const isReels = $derived(viewMode === "reels");

  const baseClasses = $derived(
    `relative overflow-hidden flex flex-col justify-between cursor-pointer bg-slate-900/60 backdrop-blur-md rounded-xl hover:bg-slate-800/80 transition-all duration-300 ${statusClasses.statusColor} ${statusClasses.glowEffect} ${isExiting ? "scale-0 opacity-0" : "scale-100 opacity-100"}`,
  );
</script>

{#if isHidden && !isExpanded}
  <div class="{baseClasses} w-full h-full opacity-0 pointer-events-none"></div>
{:else}
  <div
    onclick={(e) => {
      e.stopPropagation();
      if (!isEditing && !isExpanded) onToggleExpand();
    }}
    onkeydown={(e) => {
      if (e.key === "Enter" && !isEditing && !isExpanded) onToggleExpand();
    }}
    role="button"
    tabindex="0"
    class="{baseClasses} w-full h-full ease-out group"
  >
    <!-- Background -->
    <div
      class="absolute inset-0 w-full h-full"
      style={!showImage
        ? option.colorFrom?.startsWith("hsl")
          ? `background: linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo || "transparent"})`
          : `background: ${option.colorFrom?.includes("#") ? option.colorFrom : ""}` // Fallback for pure hex
        : ""}
      class:bg-gradient-to-br={!showImage &&
        !option.colorFrom?.startsWith("hsl")}
      class:from-indigo-600={!showImage &&
        !option.colorFrom?.startsWith("hsl") &&
        option.colorFrom?.includes("indigo")}
      class:to-slate-900={!showImage &&
        !option.colorFrom?.startsWith("hsl") &&
        option.colorTo?.includes("slate")}
      class:from-purple-600={!showImage &&
        !option.colorFrom?.startsWith("hsl") &&
        option.colorFrom?.includes("purple")}
    >
      <!-- Optimized legacy fallback: we just use style for HSL and class for everything else -->
      <div
        class="absolute inset-0 w-full h-full {!showImage &&
        !option.colorFrom?.startsWith('hsl')
          ? `bg-gradient-to-br ${option.colorFrom} ${option.colorTo}`
          : ''}"
        style={!showImage && option.colorFrom?.startsWith("hsl")
          ? `background: linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})`
          : ""}
      ></div>
      {#if showImage && !isEditing}
        <img
          src={actualImageUrl}
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-in-out {isExpanded
            ? 'scale-110'
            : 'group-hover:scale-105'}"
          alt=""
          onerror={handleImageError}
        />
        {#if !isExpanded}
          <div
            class="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/10 to-transparent opacity-80 {statusClasses.bgOverlay}"
          ></div>
        {/if}
      {/if}
    </div>

    {#if !isExpanded}
      <!-- Collapsed View -->
      <div
        class="relative z-10 flex flex-col h-full {isReels
          ? 'p-2'
          : 'p-3.5'} w-full animate-in fade-in"
      >
        <!-- Top section: title (fixed height) -->
        <div
          class="flex justify-between items-start gap-1 w-full flex-shrink-0 max-h-12 overflow-hidden"
        >
          {#if isEditing}
            <div class="w-full h-full flex flex-col">
              <span
                class="text-[9px] uppercase font-bold text-indigo-400 mb-1 flex items-center gap-1"
              >
                <Sparkles size={10} /> Nueva Opción
              </span>
              <textarea
                bind:this={inputRef}
                placeholder="Escribe tu idea..."
                class="w-full bg-transparent border-none text-sm font-bold text-white placeholder-white/30 focus:ring-0 resize-none leading-tight outline-none"
                rows={3}
                bind:value={editText}
                onclick={(e) => e.stopPropagation()}
              ></textarea>
              <button
                onclick={handleEditConfirm}
                class="bg-indigo-500 text-white text-[10px] px-2 py-1 rounded-full mt-1"
              >
                OK
              </button>
            </div>
          {:else}
            <span
              class="{isReels
                ? 'text-[0.85rem] sm:text-[0.95rem] md:text-[1.05rem]'
                : 'text-[0.9rem] sm:text-[1rem]'} font-bold leading-tight line-clamp-2 drop-shadow-md text-white/95 group-hover:text-white transition-colors"
            >
              {option.title}
            </span>
          {/if}

          {#if rank}
            {@const rankColors = getRankColor(rank, totalOptions)}
            <div
              class="w-[1.5rem] h-[1.5rem] flex items-center justify-center rounded-full font-black text-[0.7rem] shadow-lg ring-2 ring-black/20 flex-shrink-0 {rankColors.class}"
              style={rankColors.style}
            >
              #{rank}
            </div>
          {/if}
          {#if hasVoted && isSelected && !rank}
            <div class="bg-emerald-500 rounded-full p-1 flex-shrink-0">
              <Check size={10} class="text-white" />
            </div>
          {/if}
        </div>

        <!-- Middle section: percentage (flexible) -->
        {#if !isEditing && (!isReels || hasVoted)}
          <div class="flex-1 flex flex-col items-center justify-center min-h-0">
            <span
              class="{isReels
                ? 'text-4xl'
                : 'text-3xl md:text-4xl'} font-black tracking-tighter drop-shadow-xl transition-all duration-500 {hasVoted
                ? 'text-white scale-100'
                : 'text-transparent scale-90 blur-sm'}"
            >
              {hasVoted ? `${percent}%` : "0%"}
            </span>
          </div>
        {/if}

        {#if isEditing}
          <div class="flex-1"></div>
        {/if}

        <!-- Bottom section: avatars and button (fixed at bottom) -->
        <div
          class="w-full flex items-end justify-between gap-2 flex-shrink-0 mt-auto"
        >
          <div class="flex-1 min-w-0">
            {#if !isEditing}
              <SocialAvatars
                friends={option.friends}
                revealed={hasVoted}
                size="small"
              />
            {/if}
          </div>
          <div class="shrink-0">
            {#if hasVoted && !isEditing}
              <span class="text-[10px] font-medium text-white/60"
                >{option.votes} votos</span
              >
            {:else if !isEditing}
              {#if postType === "tierlist"}
                {#if rank}
                  <button
                    onclick={handleVoteAction}
                    class="bg-red-600 text-white p-1.5 rounded-full active:scale-90 transition-transform"
                  >
                    <X size={12} />
                  </button>
                {:else}
                  {@const btnColors = getRankColor(nextRank, totalOptions)}
                  <button
                    onclick={handleVoteAction}
                    class="{btnColors.class} {isReels
                      ? 'py-1 px-2 text-[0.65rem]'
                      : 'py-1.5 px-3 text-[0.7rem]'} rounded-full font-black shadow-lg active:scale-95 transition-transform min-w-[3.5rem]"
                    style={btnColors.style}
                  >
                    {isReels ? `#${nextRank}` : `Top #${nextRank}`}
                  </button>
                {/if}
              {:else}
                {@const voteStyle = getVoteButtonStyle(postType)}
                <button
                  onclick={handleVoteAction}
                  class="py-1.5 px-4 rounded-full text-[0.7rem] sm:text-[0.8rem] font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-all border border-transparent shadow-black/20"
                  style="background-color: {voteStyle.bgSolid}; color: {voteStyle.textSolid};"
                >
                  {postType === "quiz" ? "Elegir" : "Votar"}
                </button>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Progress bar -->
        {#if hasVoted && !isEditing}
          <div class="absolute bottom-0 left-0 w-full h-1.5 bg-slate-800/50">
            <div
              class="h-full rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-1000 ease-out {isCorrectOption
                ? 'bg-emerald-500'
                : postType === 'quiz'
                  ? 'bg-red-500'
                  : option.bgBar || 'bg-indigo-500'}"
              style="width: {percent}%"
            ></div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Expanded View -->
      <div
        class="relative z-20 flex flex-col h-full w-full animate-in fade-in zoom-in-95 duration-300"
      >
        <div class="absolute top-0 right-0 p-4 z-50">
          <button
            onclick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            class="p-2.5 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md border border-white/10 transition-colors"
          >
            <Minimize2 size={18} />
          </button>
        </div>

        {#if isEditing}
          <!-- Expanded Editing View -->
          <div class="flex-1 flex flex-col items-center justify-center p-6">
            <div class="w-full max-w-md">
              <span
                class="text-sm uppercase font-bold text-[#9ec264] mb-3 flex items-center gap-2 justify-center"
              >
                <Sparkles size={16} /> Nueva Opción
              </span>
              <textarea
                bind:this={inputRef}
                placeholder="Escribe tu idea..."
                class="w-full bg-white/10 border border-white/20 rounded-xl text-xl font-bold text-white placeholder-white/40 focus:ring-2 focus:ring-[#9ec264] resize-none leading-tight outline-none p-4 backdrop-blur-sm"
                rows={4}
                bind:value={editText}
                onclick={(e) => e.stopPropagation()}
              ></textarea>
            </div>
          </div>

          <div
            class="relative z-40 p-6 pb-8 bg-gradient-to-t from-black via-black/60 to-transparent"
          >
            <button
              onclick={handleEditConfirm}
              class="w-full py-4 rounded-full text-sm font-black tracking-widest uppercase shadow-lg transition-all"
              style="background-color: #9ec264; color: black;"
            >
              Añadir Opción
            </button>
          </div>
        {:else}
          <!-- Normal Expanded View - Clicking the empty space closes it -->
          <div
            class="flex-1"
            onclick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onkeydown={(e) => {
              if (e.key === "Escape") onToggleExpand();
            }}
            role="button"
            tabindex="0"
            aria-label="Cerrar vista expandida"
          ></div>

          <!-- Rank badge in expanded view for tierlist -->
          {#if rank}
            <div class="absolute top-4 left-4 z-50">
              <div
                class="w-12 h-12 flex items-center justify-center rounded-full font-black text-xl shadow-xl ring-4 ring-black/30 {rank ===
                1
                  ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950'
                  : rank === 2
                    ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900'
                    : rank === 3
                      ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100'
                      : 'bg-indigo-600 text-white'}"
              >
                #{rank}
              </div>
            </div>
          {/if}

          <div
            class="relative z-40 p-6 pb-8 bg-gradient-to-t from-black via-black/60 to-transparent pt-12"
          >
            <h3
              class="text-2xl font-black text-white leading-tight shadow-black drop-shadow-2xl mb-2"
            >
              {option.title}
            </h3>

            <div class="flex items-end justify-between gap-4">
              <div class="flex flex-col gap-1">
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-5xl font-black leading-none text-white drop-shadow-2xl tracking-tighter"
                  >
                    {hasVoted ? `${percent}%` : "0%"}
                  </span>
                  <span class="text-xs font-bold text-white/60"
                    >{option.votes} votos</span
                  >
                </div>
              </div>

              <div class="shrink-0 mb-1">
                {#if !isEditing}
                  {#if hasVoted}
                    <span class="text-xs font-bold text-white/60"
                      >{option.votes} votos</span
                    >
                  {:else if postType === "tierlist"}
                    {#if rank}
                      <button
                        onclick={(e) => {
                          handleVoteAction(e);
                          onToggleExpand();
                        }}
                        class="bg-red-600 text-white p-2 rounded-full active:scale-90 transition-transform shadow-lg"
                      >
                        <X size={16} />
                      </button>
                    {:else}
                      {@const btnColors = getRankColor(nextRank, totalOptions)}
                      <button
                        onclick={(e) => {
                          handleVoteAction(e);
                          onToggleExpand();
                        }}
                        class="{btnColors.class} py-2 px-6 rounded-full font-black shadow-xl active:scale-95 transition-transform text-sm"
                        style={btnColors.style}
                      >
                        Top #{nextRank}
                      </button>
                    {/if}
                  {:else}
                    {@const voteStyle = getVoteButtonStyle(postType)}
                    <button
                      onclick={(e) => {
                        handleVoteAction(e);
                        onToggleExpand();
                      }}
                      class="py-2.5 px-8 rounded-full text-xs font-black tracking-widest uppercase shadow-xl active:scale-95 transition-all border border-transparent shadow-lg shadow-black/20"
                      style="background-color: {voteStyle.bgSolid}; color: {voteStyle.textSolid};"
                    >
                      {postType === "quiz" ? "Elegir" : "Votar"}
                    </button>
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
