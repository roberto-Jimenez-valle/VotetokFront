<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut, elasticOut } from "svelte/easing";
  import {
    X,
    TrendingUp,
    BarChart3,
    PieChart,
    Globe, // Changed from Globe2
    ChevronDown,
    Loader2,
    Eye,
    EyeOff,
  } from "lucide-svelte";
  import GlobeGL from "$lib/GlobeGL.svelte";
  import { onMount } from "svelte";

  interface FriendVote {
    id: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  }

  interface PollOption {
    id?: string;
    key: string;
    label?: string;
    color: string;
    votes?: number;
    optionKey?: string;
    optionLabel?: string;
    optionText?: string;
    text?: string;
    friendVotes?: FriendVote[];
  }

  interface PollCreator {
    id: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  }

  interface Props {
    isOpen: boolean;
    pollId: string | number;
    pollTitle: string;
    options: PollOption[];
    pollCreator?: PollCreator;
    onClose: () => void;
    onOpenInGlobe?: () => void;
  }

  let {
    isOpen = $bindable(false),
    pollId,
    pollTitle = "Estadísticas",
    options = [],
    pollCreator,
    onClose,
    onOpenInGlobe,
  }: Props = $props();

  // Helper to get option label from various possible property names
  function getOptionLabel(option: PollOption | any): string {
    // Try all possible property names
    const label =
      option?.label ||
      option?.optionLabel ||
      option?.optionText ||
      option?.text ||
      option?.name;
    if (!label) {
      console.warn(
        "[StatsModal] Option missing label. Full option object:",
        option,
      );
      // Last resort: return a numbered option
      return `Opción ${option?.key || option?.optionKey || option?.id || "?"}`;
    }
    return label;
  }

  // Log options on mount for debugging
  $effect(() => {
    if (isOpen && options.length > 0) {
      console.log("[StatsModal] Options received:", options);
    }
  });

  const DEFAULT_AVATAR =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';

  // View state - now includes globe
  type ChartView = "stats" | "trend" | "globe";
  let activeView = $state<ChartView>("stats");

  // Time ranges
  const timeRanges = [
    { id: "24h", label: "24H", hours: 24 },
    { id: "7d", label: "7D", hours: 168 },
    { id: "30d", label: "30D", hours: 720 },
    { id: "all", label: "Todo", hours: 8760 },
  ];
  let selectedRange = $state("7d");

  // Data state
  let isLoading = $state(false);
  let totalVotes = $state(0);
  let historicalData: Array<{
    timestamp: number;
    optionsData: Array<{ optionKey: string; votes: number }>;
  }> = $state([]);

  // Interaction state
  let selectedOption = $state<string | null>(null);
  let hoveredOption = $state<string | null>(null);
  let touchStartY = $state(0);
  let modalTranslateY = $state(0);

  // Options visibility toggle
  let visibleOptions = $state<Set<string>>(new Set());
  let showAllOptions = $state(true);

  // Country filter
  let selectedCountry = $state<string>("global");
  let showCountryDropdown = $state(false);
  const countries = [
    { code: "global", name: "Global", flag: "🌍" },
    { code: "ESP", name: "España", flag: "🇪🇸" },
    { code: "MEX", name: "México", flag: "🇲🇽" },
    { code: "ARG", name: "Argentina", flag: "🇦🇷" },
    { code: "USA", name: "EE.UU.", flag: "🇺🇸" },
    { code: "COL", name: "Colombia", flag: "🇨🇴" },
  ];

  // Initialize visible options when modal opens
  $effect(() => {
    if (isOpen && options.length > 0 && visibleOptions.size === 0) {
      visibleOptions = new Set(options.map((o) => o.key || o.optionKey || ""));
    }
  });

  function toggleOption(key: string) {
    const newSet = new Set(visibleOptions);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    visibleOptions = newSet;
    showAllOptions = newSet.size === options.length;
  }

  function toggleAllOptions() {
    if (showAllOptions) {
      visibleOptions = new Set();
      showAllOptions = false;
    } else {
      visibleOptions = new Set(options.map((o) => o.key || o.optionKey || ""));
      showAllOptions = true;
    }
  }

  // Computed values
  const sortedOptions = $derived.by(() => {
    console.log("[StatsModal] Computing sortedOptions, options:", options);
    return [...options].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  });

  const maxVotes = $derived.by(() => {
    return Math.max(...options.map((o) => o.votes || 0), 1);
  });

  // Construct post object for GlobeGL
  const post = $derived({
    id: pollId,
    title: pollTitle,
    question: pollTitle,
    totalVotes,
    options: options.map((o) => ({
      ...o,
      id: o.id || o.key,
      numericId: o.id || o.key,
      title: getOptionLabel(o),
      votes: o.votes || 0,
    })),
    user: pollCreator,
  });

  // Aggregate all friends who voted across all options
  let participatingFriends = $state<FriendVote[]>([]);

  $effect(() => {
    const friends = new Map<number, FriendVote>();
    for (const option of options) {
      if (option.friendVotes) {
        for (const friend of option.friendVotes) {
          friends.set(friend.id, friend);
        }
      }
    }
    participatingFriends = Array.from(friends.values());
  });

  // Track last loaded poll to prevent duplicate calls
  let lastLoadedPollId = $state<string | number | null>(null);
  let lastLoadedRange = $state<string | null>(null);

  // Load data when modal opens
  $effect(() => {
    if (
      isOpen &&
      pollId &&
      (lastLoadedPollId !== pollId || lastLoadedRange !== selectedRange)
    ) {
      loadData();
    }
  });

  async function loadData() {
    if (isLoading) return;

    // Mark as loading with current values
    lastLoadedPollId = pollId;
    lastLoadedRange = selectedRange;
    isLoading = true;

    try {
      const range = timeRanges.find((r) => r.id === selectedRange);
      const days = range ? Math.ceil(range.hours / 24) : 7;

      const response = await fetch(
        `/api/polls/${pollId}/votes-history?days=${days}`,
      );
      if (response.ok) {
        const result = await response.json();
        historicalData = result.data || [];

        // Calculate total votes from options
        totalVotes = options.reduce((sum, o) => sum + (o.votes || 0), 0);
      }
    } catch (error) {
      console.error("[StatsModal] Error:", error);
    } finally {
      isLoading = false;
    }
  }

  function changeRange(rangeId: string) {
    if (selectedRange !== rangeId) {
      selectedRange = rangeId;
      loadData();
    }
  }

  function handleClose() {
    isOpen = false;
    lastLoadedPollId = null;
    lastLoadedRange = null;
    onClose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e: TouchEvent) {
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0) {
      modalTranslateY = Math.min(diff * 0.5, 150);
    }
  }

  function handleTouchEnd() {
    if (modalTranslateY > 80) {
      handleClose();
    }
    modalTranslateY = 0;
  }

  function getPercentage(votes: number): number {
    return totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  // Donut chart calculations (filtered by visibility)
  const donutSegments = $derived.by(() => {
    const segments: Array<{
      option: PollOption;
      startAngle: number;
      endAngle: number;
      percentage: number;
    }> = [];
    let currentAngle = -90; // Start from top

    // Only include visible options
    const visibleOpts = sortedOptions.filter((o) =>
      visibleOptions.has(o.key || o.optionKey || ""),
    );
    const visibleTotalVotes = visibleOpts.reduce(
      (sum, o) => sum + (o.votes || 0),
      0,
    );

    for (const option of visibleOpts) {
      const percentage =
        visibleTotalVotes > 0
          ? ((option.votes || 0) / visibleTotalVotes) * 100
          : 0;
      const angle = (percentage / 100) * 360;
      segments.push({
        option,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        percentage,
      });
      currentAngle += angle;
    }
    return segments;
  });

  function describeArc(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): string {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  // Block body scroll
  $effect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  });
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && handleClose()} />

{#if isOpen}
  <div
    class="modal-backdrop"
    transition:fade={{ duration: 200 }}
    role="button"
    tabindex="-1"
    onclick={handleBackdropClick}
  >
    <div
      class="modal-container"
      transition:fly={{ y: "100%", duration: 350, easing: cubicOut }}
      style="transform: translateY({modalTranslateY}px)"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      <!-- Drag indicator -->
      <div class="drag-indicator">
        <div class="drag-bar"></div>
      </div>

      <!-- Globe Background Layer -->
      {#if activeView === "globe"}
        <div class="globe-background" transition:fade={{ duration: 300 }}>
          <GlobeGL embedMode={true} initialPoll={post} />
          <div class="globe-overlay-gradient"></div>
        </div>
      {/if}

      <!-- Header -->
      <header class="modal-header relative z-10">
        <div class="header-content">
          {#if pollCreator}
            <img
              src={pollCreator.avatarUrl || DEFAULT_AVATAR}
              alt={pollCreator.displayName || pollCreator.username}
              class="creator-avatar"
            />
          {/if}
          <div class="header-text">
            <h1 class="modal-title">{pollTitle}</h1>
            <div class="total-votes">
              <span class="votes-number">{formatNumber(totalVotes)}</span>
              <span class="votes-label">votos</span>
              {#if participatingFriends.length > 0}
                <div class="header-friends">
                  {#each participatingFriends.slice(0, 3) as friend}
                    <img
                      src={friend.avatarUrl || DEFAULT_AVATAR}
                      class="header-friend-avatar"
                      alt={friend.username}
                      title={friend.displayName || friend.username}
                    />
                  {/each}
                  {#if participatingFriends.length > 3}
                    <span class="header-more-friends"
                      >+{participatingFriends.length - 3}</span
                    >
                  {/if}
                </div>
              {:else if pollCreator}
                <span class="creator-name">· por @{pollCreator.username}</span>
              {/if}
            </div>
          </div>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Cerrar">
          <X size={20} strokeWidth={2.5} />
        </button>
      </header>

      <!-- Chart Type Selector + Globe Button -->
      <nav class="view-selector relative z-10">
        <div class="view-tabs">
          <button
            class="view-btn {activeView === 'stats' ? 'active' : ''}"
            onclick={() => (activeView = "stats")}
          >
            <PieChart size={18} />
            <span>Estadísticas</span>
          </button>
          <button
            class="view-btn {activeView === 'trend' ? 'active' : ''}"
            onclick={() => (activeView = "trend")}
          >
            <TrendingUp size={18} />
            <span>Tendencia</span>
          </button>
          <button
            class="view-btn {activeView === 'globe' ? 'active' : ''}"
            onclick={() => (activeView = "globe")}
            title="Ver en el globo"
          >
            <Globe size={18} />
            <span>Globo</span>
          </button>
        </div>
      </nav>

      <!-- Options Pills Bar -->
      <div class="options-bar relative z-10">
        <button
          class="eye-toggle {showAllOptions ? 'active' : ''}"
          onclick={toggleAllOptions}
          title={showAllOptions ? "Ocultar todas" : "Mostrar todas"}
        >
          {#if showAllOptions}
            <Eye size={16} />
          {:else}
            <EyeOff size={16} />
          {/if}
        </button>

        <div class="options-pills">
          {#each options as option}
            {@const optKey = option.key || option.optionKey || ""}
            {@const isVisible = visibleOptions.has(optKey)}
            <button
              class="option-pill {isVisible ? 'active' : ''}"
              style="--pill-color: {option.color}"
              onclick={() => toggleOption(optKey)}
            >
              <span class="pill-dot" style="background: {option.color}"></span>
              <span class="pill-label">{getOptionLabel(option)}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Main Chart Area -->
      <main
        class="chart-area relative z-10"
        style={activeView === "globe" ? "pointer-events: none;" : ""}
      >
        {#if isLoading}
          <div class="loading-state">
            <Loader2 size={32} class="spinner" />
          </div>
        {:else}
          <!-- Visualization Section -->
          <div
            class="visualization-container"
            style="position: relative; width: 100%; {activeView === 'globe'
              ? 'display: none;'
              : 'height: 320px; min-height: 320px; margin-bottom: 24px; flex-shrink: 0;'}"
            in:fade={{ duration: 200 }}
          >
            <!-- Stats View: Donut -->
            {#if activeView === "stats"}
              <div class="donut-container" style="height: 100%; padding: 0;">
                <svg
                  viewBox="0 0 200 200"
                  class="donut-chart"
                  style="width: auto; height: 100%; max-height: 280px;"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    stroke-width="28"
                  />
                  {#each donutSegments as segment, i}
                    {@const isActive =
                      selectedOption === segment.option.key ||
                      hoveredOption === segment.option.key}
                    {@const strokeWidth = isActive ? 32 : 28}
                    {#if segment.percentage > 0}
                      <path
                        d={describeArc(
                          100,
                          100,
                          70,
                          segment.startAngle,
                          segment.endAngle - 0.5,
                        )}
                        fill="none"
                        stroke={segment.option.color}
                        stroke-width={strokeWidth}
                        stroke-linecap="butt"
                        class="donut-segment"
                        class:active={isActive}
                        style="--delay: {i * 50}ms"
                      />
                    {/if}
                  {/each}
                </svg>
                <div class="donut-center">
                  {#if selectedOption}
                    {@const opt = options.find((o) => o.key === selectedOption)}
                    <span class="center-value" style="color: {opt?.color}"
                      >{getPercentage(opt?.votes || 0).toFixed(1)}%</span
                    >
                    <span class="center-label">{opt?.label}</span>
                  {:else}
                    <span class="center-value">{totalVotes}</span>
                    <span class="center-label">Total</span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Trend View: Line Chart -->
            {#if activeView === "trend"}
              {#if historicalData.length > 1}
                <div
                  class="line-chart-container"
                  style="height: 100%; border: none; background: transparent; padding: 0;"
                >
                  <svg
                    viewBox="0 0 100 80"
                    preserveAspectRatio="none"
                    class="line-chart"
                  >
                    <!-- Grid lines -->
                    {#each [0, 25, 50, 75, 100] as y}
                      <line
                        x1="0"
                        y1={80 - y * 0.7}
                        x2="100"
                        y2={80 - y * 0.7}
                        stroke="rgba(255,255,255,0.08)"
                        stroke-width="0.3"
                      />
                    {/each}

                    <!-- Gradient fills for each option -->
                    <defs>
                      {#each options.filter( (o) => visibleOptions.has(o.key || o.optionKey || ""), ) as option}
                        <linearGradient
                          id="gradient-{option.key}"
                          x1="0%"
                          y1="0%"
                          x2="0%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stop-color={option.color}
                            stop-opacity="0.4"
                          />
                          <stop
                            offset="100%"
                            stop-color={option.color}
                            stop-opacity="0"
                          />
                        </linearGradient>
                      {/each}
                    </defs>

                    <!-- Area fills and lines for each visible option -->
                    {#each options.filter( (o) => visibleOptions.has(o.key || o.optionKey || ""), ) as option, optIdx}
                      {@const dataPoints = historicalData.map((d, i) => {
                        const optData = d.optionsData?.find(
                          (o) =>
                            o.optionKey === option.key ||
                            o.optionKey === option.optionKey ||
                            d.optionsData?.indexOf(o) === optIdx,
                        );
                        const maxVal = Math.max(
                          ...historicalData.flatMap(
                            (d) => d.optionsData?.map((o) => o.votes) || [0],
                          ),
                          1,
                        );
                        const x =
                          historicalData.length > 1
                            ? (i / (historicalData.length - 1)) * 100
                            : 50;
                        const y = 75 - ((optData?.votes || 0) / maxVal) * 65;
                        return { x, y, votes: optData?.votes || 0 };
                      })}
                      {@const points = dataPoints
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      {@const areaPath = `M ${dataPoints[0]?.x || 0},80 L ${points} L ${dataPoints[dataPoints.length - 1]?.x || 100},80 Z`}

                      <!-- Area fill -->
                      <path
                        d={areaPath}
                        fill="url(#gradient-{option.key})"
                        class="trend-area"
                      />

                      <!-- Line -->
                      {#if points && points.length > 0}
                        <polyline
                          {points}
                          fill="none"
                          stroke={option.color}
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="trend-line"
                        />
                      {/if}

                      <!-- Interactive data points -->
                      {#each dataPoints as point, i}
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="3"
                          fill={option.color}
                          stroke="#0a0a0c"
                          stroke-width="1.5"
                          class="data-point"
                        >
                          <title
                            >{getOptionLabel(option)}: {point.votes} votos</title
                          >
                        </circle>
                      {/each}
                    {/each}
                  </svg>
                </div>
              {:else}
                <div class="empty-state" style="height: 100%;">
                  <TrendingUp size={48} strokeWidth={1} />
                  <p>No hay suficientes datos para mostrar tendencias</p>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Options List / Legend (Visible ONLY if NOT in Globe view) -->
          {#if activeView !== "globe"}
            <div
              class="options-list"
              style="padding-bottom: 20px; pointer-events: auto;"
            >
              {#each sortedOptions.filter( (o) => visibleOptions.has(o.key || o.optionKey || ""), ) as option, i}
                {@const pct = getPercentage(option.votes || 0)}
                {@const width = pct}
                <button
                  class="option-item"
                  class:active={selectedOption === option.key}
                  onclick={() =>
                    (selectedOption =
                      selectedOption === option.key ? null : option.key)}
                  style="--item-delay: {i * 40}ms"
                >
                  <div
                    class="option-color"
                    style="background: {option.color}"
                  ></div>
                  <div class="option-content">
                    <div class="option-header">
                      <span class="option-label">{getOptionLabel(option)}</span>
                      <span class="option-pct">{pct.toFixed(1)}%</span>
                    </div>
                    <div class="option-bar">
                      <div
                        class="option-bar-fill"
                        style="width: {width}%; background: {option.color}"
                      ></div>
                    </div>
                    <div class="option-footer">
                      <span class="option-votes"
                        >{formatNumber(option.votes || 0)} votos</span
                      >
                      {#if option.friendVotes && option.friendVotes.length > 0}
                        <div class="friend-avatars">
                          {#each option.friendVotes.slice(0, 3) as friend}
                            <img
                              src={friend.avatarUrl || DEFAULT_AVATAR}
                              alt={friend.displayName || friend.username}
                              class="friend-avatar"
                              title={friend.displayName || friend.username}
                            />
                          {/each}
                          {#if option.friendVotes.length > 3}
                            <span class="more-friends"
                              >+{option.friendVotes.length - 3}</span
                            >
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </main>

      <!-- Time Range Selector -->
      <!-- Time Range Selector (Only for Trend view) -->
      {#if activeView === "trend"}
        <footer class="time-selector">
          {#each timeRanges as range}
            <button
              class="time-btn {selectedRange === range.id ? 'active' : ''}"
              onclick={() => changeRange(range.id)}
            >
              {range.label}
            </button>
          {/each}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 9999999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .modal-container {
    position: relative;
    width: 100%;
    height: 100%;
    max-height: 100vh;
    max-height: 100dvh;
    background: linear-gradient(180deg, #0a0a0c 0%, #111114 50%, #0a0a0c 100%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Drag indicator */
  .drag-indicator {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
    flex-shrink: 0;
  }

  .drag-bar {
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  /* Header */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 20px 16px;
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: white;
    margin: 0;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .total-votes {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .votes-number {
    font-size: 28px;
    font-weight: 800;
    color: white;
    letter-spacing: -0.5px;
  }

  .votes-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  /* Header with creator */
  .creator-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .header-text {
    flex: 1;
    min-width: 0;
  }

  .creator-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 4px;
  }

  /* View Selector */
  .view-selector {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px 16px;
    flex-shrink: 0;
  }

  .view-tabs {
    display: flex;
    gap: 8px;
  }

  .view-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .view-btn.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .view-btn span {
    display: none;
  }

  /* Options Pills Bar */
  .options-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px 12px;
    flex-shrink: 0;
  }

  .eye-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .eye-toggle:hover,
  .eye-toggle.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .options-pills {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 2px 0;
  }

  .options-pills::-webkit-scrollbar {
    display: none;
  }

  .option-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .option-pill:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .option-pill.active {
    background: color-mix(in srgb, var(--pill-color) 20%, transparent);
    border-color: var(--pill-color);
    color: white;
  }

  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pill-label {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Chart Area */
  .chart-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 20px;
    -webkit-overflow-scrolling: touch;
    position: relative;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: rgba(255, 255, 255, 0.3);
  }

  .loading-state :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Stats View (Combined) */
  .stats-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 20px;
  }

  .donut-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .donut-chart {
    width: 200px;
    height: 200px;
  }

  .donut-segment {
    cursor: pointer;
    transition:
      stroke-width 0.2s ease,
      opacity 0.2s ease;
    animation: donutIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: var(--delay);
    stroke-dasharray: 0 1000;
  }

  @keyframes donutIn {
    to {
      stroke-dasharray: 1000 1000;
    }
  }

  .donut-segment.active {
    filter: brightness(1.2);
  }

  .donut-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .center-value {
    font-size: 32px;
    font-weight: 800;
    color: white;
    line-height: 1;
  }

  .center-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Options List */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    animation: fadeSlideIn 0.3s ease forwards;
    animation-delay: var(--item-delay);
    opacity: 0;
    text-align: left;
  }

  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .option-item:hover,
  .option-item.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .option-color {
    width: 4px;
    height: 100%;
    min-height: 40px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .option-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .option-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .option-label {
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .option-pct {
    font-size: 16px;
    font-weight: 800;
    color: white;
  }

  .option-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .option-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .option-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .option-votes {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .friend-avatars {
    display: flex;
    align-items: center;
  }

  .friend-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid #0a0a0c;
    margin-left: -6px;
  }

  .friend-avatar:first-child {
    margin-left: 0;
  }

  .more-friends {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    margin-left: 4px;
  }

  /* Legend (unused, keeping for compatibility) */
  .legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    animation: fadeSlideIn 0.4s ease forwards;
    animation-delay: var(--item-delay);
    opacity: 0;
  }

  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .legend-item:hover,
  .legend-item.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .legend-label {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    text-align: left;
  }

  .legend-value {
    font-size: 14px;
    font-weight: 700;
    color: white;
  }

  /* Bar View */
  .bars-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
  }

  .bar-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    animation: fadeSlideIn 0.4s ease forwards;
    animation-delay: var(--bar-delay);
    opacity: 0;
  }

  .bar-item:hover,
  .bar-item.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bar-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bar-rank {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.3);
    min-width: 24px;
  }

  .bar-label {
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .bar-stats {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .bar-votes {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .bar-pct {
    font-size: 16px;
    font-weight: 800;
    color: white;
  }

  .bar-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    width: 0;
    animation: barGrow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: var(--fill-delay);
  }

  @keyframes barGrow {
    to {
      width: var(--target-width, 100%);
    }
  }

  /* Line View */
  .line-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 20px;
  }

  .line-chart-container {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 16px;
    height: 320px;
    min-height: 280px;
    touch-action: pan-y pinch-zoom;
  }

  .line-chart {
    width: 100%;
    height: 100%;
  }

  .trend-line {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: drawLine 1.5s ease forwards;
  }

  .trend-area {
    opacity: 0;
    animation: fadeInArea 0.8s ease 0.5s forwards;
  }

  @keyframes fadeInArea {
    to {
      opacity: 1;
    }
  }

  @keyframes drawLine {
    to {
      stroke-dashoffset: 0;
    }
  }

  .data-point {
    cursor: pointer;
    transition:
      r 0.2s ease,
      filter 0.2s ease;
  }

  .data-point:hover {
    r: 5;
    filter: drop-shadow(0 0 6px currentColor);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 200px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  /* Time Selector */
  .time-selector {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 16px 20px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
    flex-shrink: 0;
  }

  .time-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .time-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .time-btn.active {
    background: white;
    border-color: white;
    color: #0a0a0c;
  }

  /* Tablet / Desktop styles */
  @media (min-width: 640px) {
    .modal-backdrop {
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .modal-container {
      width: 100%;
      max-width: 600px;
      height: 80vh;
      max-height: 800px;
      margin: 0;
      border-radius: 24px;
      transform: none !important;
    }

    .globe-background {
      border-radius: 24px;
    }

    .view-btn span {
      display: inline;
    }

    .donut-chart {
      width: 280px;
      height: 280px;
    }

    .modal-title {
      font-size: 20px;
      max-width: 400px;
    }
  }

  @media (min-width: 1024px) {
    .modal-backdrop {
      padding: 40px;
    }

    .modal-container {
      max-width: 900px;
      height: 85vh;
      max-height: 900px;
    }

    .donut-chart {
      width: 320px;
      height: 320px;
    }
  }

  .globe-background {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    pointer-events: auto;
  }

  .globe-overlay-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    z-index: 1;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
    pointer-events: none;
  }

  /* Header Friends */
  .header-friends {
    display: flex;
    align-items: center;
    margin-left: 8px;
  }

  .header-friend-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    margin-left: -8px;
    border: 1.5px solid #1e1e1e; /* Match header bg or dark theme */
    object-fit: cover;
  }

  .header-friend-avatar:first-child {
    margin-left: 0;
  }

  .header-more-friends {
    font-size: 11px;
    color: #9ca3af;
    margin-left: 6px;
    font-weight: 500;
  }
</style>
