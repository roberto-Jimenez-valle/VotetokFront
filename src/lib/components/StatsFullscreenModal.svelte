<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut, elasticOut } from "svelte/easing";
  import {
    X,
    TrendingUp,
    BarChart3,
    PieChart,
    Globe,
    ChevronDown,
    Loader2,
    Eye,
    EyeOff,
    LineChart,
    CircleDot,
    Hexagon,
    Target,
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
    { id: "1y", label: "1Y", hours: 8760 },
    { id: "all", label: "Todo", hours: 87600 },
  ];
  let selectedRange = $state("7d");
  let pieSubView = $state<"donut" | "radar" | "polar" | "bar">("donut");

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

  // Track last initialized poll to reset visibility when poll changes
  let lastInitializedPollId = $state<string | number | null>(null);

  // Initialize visible options when modal opens or poll changes
  $effect(() => {
    if (isOpen && options.length > 0) {
      // If first open OR poll changed, reset visible options to show all
      if (visibleOptions.size === 0 || lastInitializedPollId !== pollId) {
        console.log(
          "[StatsModal] Initializing visible options for poll:",
          pollId,
        );
        visibleOptions = new Set(
          options.map((o) => o.key || o.optionKey || ""),
        );
        lastInitializedPollId = pollId;
      }
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
    // Creating a new array to avoid mutating the original options
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

  // Calculate hidden option keys for GlobeGL (options NOT in visibleOptions)
  const hiddenOptionKeys = $derived.by(() => {
    if (visibleOptions.size === 0) return []; // All visible

    const allKeys = options.map((o) => o.key || o.optionKey || "");
    return allKeys.filter((key) => !visibleOptions.has(key));
  });

  // Filtered post for GlobeGL - only includes visible options
  // This triggers a proper re-render when options are toggled
  const filteredPost = $derived({
    id: pollId,
    title: pollTitle,
    question: pollTitle,
    totalVotes,
    options: options
      .filter((o) => {
        if (visibleOptions.size === 0) return true;
        const key = o.key || o.optionKey || "";
        return visibleOptions.has(key);
      })
      .map((o) => ({
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

  function handleClose(fromHistory = false) {
    isOpen = false;
    lastLoadedPollId = null;
    lastLoadedRange = null;
    lastInitializedPollId = null; // Reset initialization tracking
    visibleOptions = new Set(); // Clear visible options
    activeView = "stats"; // Reset view to default

    if (!fromHistory) {
      if (window.location.hash === "#stats-view") {
        try {
          history.back();
        } catch (e) {
          // Ignore
        }
      }
    }

    onClose?.();
  }

  // Handle Back Button / History Integration
  $effect(() => {
    if (!isOpen) return;

    // Push new state when modal opens
    // We use a hash to ensure mobile browsers treat this as a navigation event robustly
    const state = { modal: "stats_fullscreen", pollId };
    const hash = "#stats-view";

    // Only push if we aren't already there (avoids loops if effect re-runs)
    if (window.location.hash !== hash) {
      try {
        history.pushState(
          state,
          "",
          window.location.pathname + window.location.search + hash,
        );
      } catch (e) {
        console.warn("Could not push history state", e);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // Always close when navigating history (back button) while modal is open
      handleClose(true);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Cleanup: if we are closing (effect cleanup) and the hash is still there, remove it
      // This happens when we close via X button (handleClose calls history.back(), but just in case)
      if (window.location.hash === hash && isOpen) {
        // If isOpen is true during cleanup, it means unmount or something else.
        // We generally rely on handleClose to manage history.back()
      }
    };
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleTouchStart(e: TouchEvent) {
    if (activeView === "globe") return;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e: TouchEvent) {
    if (activeView === "globe") return;
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0) {
      modalTranslateY = Math.min(diff * 0.5, 150);
    }
  }

  function handleTouchEnd() {
    if (activeView === "globe") return;
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

  // ==================== ENHANCED LINE CHART ====================
  // Scrubbing state
  let scrubIndex = $state<number | null>(null);
  let lineChartContainerEl = $state<HTMLDivElement | null>(null);

  // Line chart viewbox constants
  const LINE_VIEWBOX_WIDTH = 1000;
  const LINE_VIEWBOX_HEIGHT = 300;
  const LINE_PADDING_X = 40;
  const LINE_PADDING_Y = 30;

  // Active index for display (scrubbed or last)
  const activeLineIndex = $derived.by(() => {
    const pointsLength = smoothLinePaths[0]?.points?.length || 0;
    if (scrubIndex !== null) return Math.min(scrubIndex, pointsLength - 1);
    return Math.max(0, pointsLength - 1);
  });

  // Get votes at active index for each option - using the rendered points
  const votesAtActiveIndex = $derived.by(() => {
    if (!smoothLinePaths.length) return options.map((o) => o.votes || 0);

    return smoothLinePaths.map((lp) => {
      const point = lp.points[activeLineIndex];
      return point?.votes || 0;
    });
  });

  const totalVotesAtActiveIndex = $derived(
    votesAtActiveIndex.reduce((sum, v) => sum + v, 0),
  );

  // Time label at active index
  function getTimeLabel(timestamp: number): string {
    const d = new Date(timestamp);
    if (selectedRange === "24h") {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (selectedRange === "7d" || selectedRange === "30d") {
      return d.toLocaleDateString([], { day: "numeric", month: "short" });
    }
    return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  }

  const currentTimeLabel = $derived.by(() => {
    if (!smoothLinePaths.length || !smoothLinePaths[0].points.length)
      return "Ahora";
    const point = smoothLinePaths[0].points[activeLineIndex];
    if (!point?.timestamp) return "Ahora";
    return getTimeLabel(point.timestamp);
  });

  // Smooth curve control point calculation
  function getControlPoint(
    current: { x: number; y: number },
    previous: { x: number; y: number } | null,
    next: { x: number; y: number } | null,
    reverse = false,
    smoothing = 0.15,
  ) {
    const p = previous || current;
    const n = next || current;
    const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0);
    const length =
      Math.sqrt(Math.pow(n.x - p.x, 2) + Math.pow(n.y - p.y, 2)) * smoothing;
    return {
      x: current.x + Math.cos(angle) * length,
      y: current.y + Math.sin(angle) * length,
    };
  }

  // Computed smooth line paths
  const smoothLinePaths = $derived.by(() => {
    if (historicalData.length < 2) return [];

    // Filter out leading periods with zero votes (before poll started)
    // Only apply this filter for longer time ranges where it makes sense
    let dataToUse = historicalData;

    // Find the first index where there's at least one vote
    let firstNonZeroIndex = 0;
    for (let i = 0; i < historicalData.length; i++) {
      const totalVotesAtPoint =
        historicalData[i].optionsData?.reduce(
          (sum, o) => sum + (o.votes || 0),
          0,
        ) || 0;
      if (totalVotesAtPoint > 0) {
        firstNonZeroIndex = i;
        break;
      }
    }

    // Only filter if we still have at least 2 points after filtering
    const filteredData = historicalData.slice(firstNonZeroIndex);
    if (filteredData.length >= 2) {
      dataToUse = filteredData;
    }

    // Use all options if visibleOptions is empty (not initialized yet)
    const visibleOpts =
      visibleOptions.size > 0
        ? options.filter((o) => visibleOptions.has(o.key || o.optionKey || ""))
        : options;

    // Find global max across all data
    const allVals: number[] = [];
    for (const d of dataToUse) {
      for (const o of d.optionsData || []) {
        allVals.push(o.votes);
      }
    }
    const globalMin = 0;
    const globalMax = Math.max(...allVals, 1);
    const range = globalMax - globalMin || 1;

    return visibleOpts.map((opt, optIndex) => {
      const points = dataToUse.map((d, i) => {
        // Try multiple ways to find the matching option data
        let found = d.optionsData?.find(
          (o) =>
            o.optionKey === opt.key ||
            o.optionKey === opt.optionKey ||
            o.optionKey === opt.id ||
            String(o.optionKey) === String(opt.key) ||
            String(o.optionKey) === String(opt.optionKey),
        );

        // Fallback: use index-based matching if keys don't match
        if (!found && d.optionsData?.[optIndex]) {
          found = d.optionsData[optIndex];
        }

        const votes = found?.votes || 0;
        const x =
          LINE_PADDING_X +
          (i / (dataToUse.length - 1)) *
            (LINE_VIEWBOX_WIDTH - LINE_PADDING_X * 2);
        const y =
          LINE_VIEWBOX_HEIGHT -
          LINE_PADDING_Y -
          ((votes - globalMin) / range) *
            (LINE_VIEWBOX_HEIGHT - LINE_PADDING_Y * 2);
        return { x, y, votes, timestamp: d.timestamp };
      });

      // Build smooth bezier path
      const pathD = points.reduce((acc, point, i, arr) => {
        if (i === 0) return `M ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        const cp1 = getControlPoint(arr[i - 1], arr[i - 2] || null, point);
        const cp2 = getControlPoint(
          point,
          arr[i - 1],
          arr[i + 1] || null,
          true,
        );
        return `${acc} C ${cp1.x.toFixed(2)},${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)},${cp2.y.toFixed(2)} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      }, "");

      return {
        option: opt,
        path: pathD,
        points,
      };
    });
  });

  // Scrubbing handlers
  function handleLineScrub(clientX: number) {
    if (!lineChartContainerEl) return;

    // Use the actual rendered points length, not raw historicalData
    const pointsLength = smoothLinePaths[0]?.points?.length || 0;
    if (pointsLength < 2) return;

    const rect = lineChartContainerEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    if (width === 0) return;

    const svgX = (x / width) * LINE_VIEWBOX_WIDTH;
    const rawProgress =
      (svgX - LINE_PADDING_X) / (LINE_VIEWBOX_WIDTH - 2 * LINE_PADDING_X);
    const progress = Math.max(0, Math.min(1, rawProgress));
    const index = Math.round(progress * (pointsLength - 1));

    if (index >= 0 && index < pointsLength) {
      scrubIndex = index;
    }
  }

  function handleLineMouseMove(e: MouseEvent) {
    handleLineScrub(e.clientX);
  }

  function handleLineTouchMove(e: TouchEvent) {
    // Note: preventDefault removed to avoid passive event listener error
    // touch-action: none on the container handles scroll prevention
    handleLineScrub(e.touches[0].clientX);
  }

  function handleLineTouchStart(e: TouchEvent) {
    handleLineScrub(e.touches[0].clientX);
  }

  function handleLineLeave() {
    scrubIndex = null;
  }

  // Reset scrub on view change
  $effect(() => {
    activeView;
    scrubIndex = null;
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
        <div class="globe-background">
          {#key hiddenOptionKeys.join(",")}
            <GlobeGL embedMode={true} initialPoll={filteredPost} />
          {/key}
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
        <button
          class="close-btn"
          onclick={() => handleClose()}
          aria-label="Cerrar"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </header>

      <!-- Chart Type Selector + Globe Button -->
      <nav class="view-selector relative z-10">
        <div class="view-tabs">
          <button
            class="view-btn {activeView === 'stats' ? 'active' : ''}"
            onclick={() => (activeView = "stats")}
            title="Estadísticas"
          >
            <PieChart size={18} />
          </button>

          {#if activeView === "stats"}
            <div class="view-divider"></div>

            <button
              class="view-btn sub-btn {pieSubView === 'donut' ? 'active' : ''}"
              onclick={() => (pieSubView = "donut")}
              title="Gráfico Donut"
            >
              <CircleDot size={16} />
            </button>
            <button
              class="view-btn sub-btn {pieSubView === 'radar' ? 'active' : ''}"
              onclick={() => (pieSubView = "radar")}
              title="Gráfico Radar"
            >
              <Hexagon size={16} />
            </button>
            <button
              class="view-btn sub-btn {pieSubView === 'polar' ? 'active' : ''}"
              onclick={() => (pieSubView = "polar")}
              title="Gráfico Polar"
            >
              <Target size={16} />
            </button>
            <button
              class="view-btn sub-btn {pieSubView === 'bar' ? 'active' : ''}"
              onclick={() => (pieSubView = "bar")}
              title="Gráfico de Barras"
            >
              <BarChart3 size={16} />
            </button>

            <div class="view-divider"></div>
          {/if}

          <button
            class="view-btn {activeView === 'trend' ? 'active' : ''}"
            onclick={() => (activeView = "trend")}
            title="Tendencias"
          >
            <TrendingUp size={18} />
          </button>
          <button
            class="view-btn {activeView === 'globe' ? 'active' : ''}"
            onclick={() => (activeView = "globe")}
            title="Ver en el globo"
          >
            <Globe size={18} />
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
              : activeView === 'trend'
                ? 'height: 50vh; min-height: 300px; max-height: 500px; margin-bottom: 16px; flex-shrink: 0;'
                : 'height: 320px; min-height: 320px; margin-bottom: 24px; flex-shrink: 0;'}"
            in:fade={{ duration: 200 }}
          >
            <!-- Stats View: Donut / Radar / Polar -->
            {#if activeView === "stats"}
              <div
                class="stats-view-container"
                style="height: 100%; display: flex; flex-direction: column; align-items: center;"
              >
                <!-- Sub-View Selector -->

                {#if pieSubView === "donut"}
                  <div
                    class="donut-container"
                    style="height: 100%; padding: 0; width: 100%;"
                  >
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
                            role="button"
                            tabindex="0"
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
                            style="--delay: {i * 50}ms; cursor: pointer;"
                            onclick={(e) => {
                              e.stopPropagation();
                              selectedOption =
                                selectedOption === segment.option.key
                                  ? null
                                  : segment.option.key;
                            }}
                            onkeydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectedOption =
                                  selectedOption === segment.option.key
                                    ? null
                                    : segment.option.key;
                              }
                            }}
                            onmouseenter={() =>
                              (hoveredOption = segment.option.key)}
                            onmouseleave={() => (hoveredOption = null)}
                          />
                        {/if}
                      {/each}
                    </svg>
                    <div class="donut-center">
                      {#if selectedOption}
                        {@const opt = options.find(
                          (o) => o.key === selectedOption,
                        )}
                        <span class="center-value" style="color: {opt?.color}"
                          >{getPercentage(opt?.votes || 0).toFixed(1)}%</span
                        >
                        <span class="center-label">{opt?.label}</span>
                      {:else}
                        <span class="center-value"
                          >{formatNumber(totalVotes)}</span
                        >
                        <span class="center-label">Total</span>
                      {/if}
                    </div>
                  </div>
                {:else if pieSubView === "radar"}
                  <!-- Radar Chart -->
                  {@const numVars = donutSegments.length || 3}
                  {@const angleStep = (Math.PI * 2) / numVars}
                  {@const maxVal = Math.max(
                    ...donutSegments.map((s) => s.option.votes || 0),
                    1,
                  )}
                  {@const points = donutSegments.map((s, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const val = ((s.option.votes || 0) / maxVal) * 80; // max radius 80 (viewbox 200x200)
                    return {
                      x: 100 + Math.cos(angle) * val,
                      y: 100 + Math.sin(angle) * val,
                      title: s.option.label,
                      votes: s.option.votes,
                    };
                  })}
                  {@const polyPoints = points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}

                  <div
                    class="radar-container"
                    style="height: 100%; width: 100%; display: flex; align-items: center; justify-content: center;"
                  >
                    <svg
                      viewBox="0 0 200 200"
                      style="width: auto; height: 100%; max-height: 280px;"
                    >
                      <!-- Web/Grid -->
                      {#each [20, 40, 60, 80] as r}
                        <circle
                          cx="100"
                          cy="100"
                          {r}
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          stroke-width="1"
                        />
                      {/each}
                      {#each donutSegments as _, i}
                        {@const angle = i * angleStep - Math.PI / 2}
                        <line
                          x1="100"
                          y1="100"
                          x2={100 + Math.cos(angle) * 80}
                          y2={100 + Math.sin(angle) * 80}
                          stroke="rgba(255,255,255,0.05)"
                          stroke-width="1"
                        />
                      {/each}

                      <!-- Data Polygon -->
                      <polygon
                        points={polyPoints}
                        fill="rgba(99, 102, 241, 0.2)"
                        stroke="#6366f1"
                        stroke-width="2"
                        class="transition-all duration-500"
                      />

                      <!-- Dots -->
                      {#each points as p, i}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={selectedOption === donutSegments[i].option.key
                            ? 5
                            : 3}
                          fill={donutSegments[i].option.color}
                          stroke="white"
                          stroke-width="1"
                          style="cursor: pointer; transition: all 0.3s;"
                          onmouseenter={() =>
                            (hoveredOption = donutSegments[i].option.key)}
                          onmouseleave={() => (hoveredOption = null)}
                          onclick={(e) => {
                            e.stopPropagation();
                            selectedOption =
                              selectedOption === donutSegments[i].option.key
                                ? null
                                : donutSegments[i].option.key;
                          }}
                        />
                      {/each}
                    </svg>
                  </div>
                {:else if pieSubView === "polar"}
                  <!-- Polar Area Chart -->
                  {@const numSlices = donutSegments.length || 1}
                  {@const sliceAngle = 360 / numSlices}
                  {@const maxPVal = Math.max(
                    ...donutSegments.map((s) => s.option.votes || 0),
                    1,
                  )}

                  <div
                    class="polar-container"
                    style="height: 100%; width: 100%; display: flex; align-items: center; justify-content: center;"
                  >
                    <svg
                      viewBox="0 0 200 200"
                      style="width: auto; height: 100%; max-height: 280px; transform: rotate(-90deg);"
                    >
                      <!-- Grid Circles -->
                      {#each [20, 40, 60, 80] as r}
                        <circle
                          cx="100"
                          cy="100"
                          {r}
                          fill="none"
                          stroke="rgba(255,255,255,0.03)"
                          stroke-width="1"
                        />
                      {/each}

                      {#each donutSegments as seg, i}
                        {@const startA = i * sliceAngle}
                        {@const endA = (i + 1) * sliceAngle}
                        {@const radius =
                          ((seg.option.votes || 0) / maxPVal) * 90}

                        {@const x1 =
                          100 + radius * Math.cos((Math.PI * startA) / 180)}
                        {@const y1 =
                          100 + radius * Math.sin((Math.PI * startA) / 180)}
                        {@const x2 =
                          100 + radius * Math.cos((Math.PI * endA) / 180)}
                        {@const y2 =
                          100 + radius * Math.sin((Math.PI * endA) / 180)}

                        <path
                          d="M 100 100 L {x1} {y1} A {radius} {radius} 0 0 1 {x2} {y2} Z"
                          fill={seg.option.color}
                          stroke="rgba(255,255,255,0.1)"
                          stroke-width="1"
                          style="transition: all 0.5s; cursor: pointer; opacity: {selectedOption ===
                          seg.option.key
                            ? 1
                            : 0.8};"
                          onmouseenter={() => (hoveredOption = seg.option.key)}
                          onmouseleave={() => (hoveredOption = null)}
                        />
                      {/each}
                    </svg>
                  </div>
                {:else if pieSubView === "bar"}
                  <!-- Bar Chart -->
                  {@const maxBarVal = Math.max(
                    ...donutSegments.map((s) => s.option.votes || 0),
                    1,
                  )}
                  {@const barWidth = 160 / (donutSegments.length || 1)}
                  {@const gap = barWidth * 0.2}
                  {@const effectiveWidth = barWidth - gap}

                  <div
                    class="bar-container"
                    style="height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;"
                  >
                    <svg
                      viewBox="0 0 200 200"
                      style="width: auto; height: 100%; max-height: 280px;"
                    >
                      <!-- Grid Lines -->
                      {#each [0, 50, 100, 150, 200] as y}
                        <line
                          x1="0"
                          y1={y}
                          x2="200"
                          y2={y}
                          stroke="rgba(255,255,255,0.05)"
                          stroke-width="1"
                          stroke-dasharray="4 4"
                        />
                      {/each}

                      {#each donutSegments as seg, i}
                        {@const height =
                          ((seg.option.votes || 0) / maxBarVal) * 180}
                        {@const x = 20 + i * barWidth}
                        {@const y = 200 - height}

                        <rect
                          {x}
                          {y}
                          width={effectiveWidth}
                          {height}
                          fill={seg.option.color}
                          rx="4"
                          style="transition: all 0.5s; cursor: pointer; opacity: {selectedOption ===
                          seg.option.key
                            ? 1
                            : 0.8};"
                          onmouseenter={() => (hoveredOption = seg.option.key)}
                          onmouseleave={() => (hoveredOption = null)}
                          onclick={(e) => {
                            e.stopPropagation();
                            selectedOption =
                              selectedOption === seg.option.key
                                ? null
                                : seg.option.key;
                          }}
                        />

                        <!-- Value Label -->
                        <text
                          x={x + effectiveWidth / 2}
                          y={y - 8}
                          text-anchor="middle"
                          font-size="10"
                          font-weight="bold"
                          fill="white"
                          opacity="0.8"
                        >
                          {seg.percentage.toFixed(0)}%
                        </text>
                      {/each}
                    </svg>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Trend View: Enhanced Line Chart with Scrubbing -->
            {#if activeView === "trend"}
              {#if historicalData.length > 1}
                <!-- Scrub Info Header -->
                <div class="scrub-info">
                  <div class="scrub-votes">
                    <span class="scrub-votes-number"
                      >{formatNumber(totalVotesAtActiveIndex)}</span
                    >
                    <span class="scrub-votes-label">votos</span>
                  </div>
                  <span class="scrub-time">{currentTimeLabel}</span>
                </div>

                <!-- Chart Container -->
                <div
                  class="line-chart-container enhanced"
                  bind:this={lineChartContainerEl}
                  onmousemove={handleLineMouseMove}
                  onmouseleave={handleLineLeave}
                  ontouchmove={handleLineTouchMove}
                  ontouchstart={handleLineTouchStart}
                  ontouchend={handleLineLeave}
                  role="img"
                  aria-label="Gráfico de tendencias interactivo"
                  style="touch-action: none; cursor: crosshair;"
                >
                  <!-- Hover value labels on the right -->
                  {#if scrubIndex !== null}
                    {#each smoothLinePaths as lp, i}
                      {@const point = lp.points[activeLineIndex]}
                      {#if point}
                        {@const yPct = (point.y / LINE_VIEWBOX_HEIGHT) * 100}
                        <div class="hover-value-label" style="top: {yPct}%">
                          <div
                            class="hover-dot"
                            style="background-color: {lp.option.color}"
                          ></div>
                          <span class="hover-votes"
                            >{formatNumber(point.votes)}</span
                          >
                        </div>
                      {/if}
                    {/each}
                  {/if}

                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 {LINE_VIEWBOX_WIDTH} {LINE_VIEWBOX_HEIGHT}"
                    preserveAspectRatio="none"
                    class="line-chart-svg"
                  >
                    <!-- Clip path for active portion -->
                    <defs>
                      <clipPath id="active-clip-multi">
                        <rect
                          x="0"
                          y="0"
                          width={scrubIndex !== null && smoothLinePaths[0]
                            ? (smoothLinePaths[0].points[activeLineIndex]?.x ??
                              LINE_VIEWBOX_WIDTH)
                            : LINE_VIEWBOX_WIDTH}
                          height={LINE_VIEWBOX_HEIGHT}
                        />
                      </clipPath>
                    </defs>

                    {#each smoothLinePaths as lp, i}
                      <!-- Faded full line (background at 15% opacity) -->
                      <path
                        d={lp.path}
                        fill="none"
                        stroke={lp.option.color}
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.15"
                        vector-effect="non-scaling-stroke"
                      />

                      <!-- Active clipped line (full opacity) -->
                      <path
                        d={lp.path}
                        fill="none"
                        stroke={lp.option.color}
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        clip-path="url(#active-clip-multi)"
                        vector-effect="non-scaling-stroke"
                      />

                      <!-- Data point indicator -->
                      {#if scrubIndex !== null}
                        {@const pt = lp.points[activeLineIndex]}
                        {#if pt}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="5"
                            fill={lp.option.color}
                            stroke="black"
                            stroke-width="2"
                          />
                        {/if}
                      {:else if lp.points.length > 0}
                        {@const lastPt = lp.points[lp.points.length - 1]}
                        <circle
                          cx={lastPt.x}
                          cy={lastPt.y}
                          r="4"
                          fill={lp.option.color}
                        />
                      {/if}
                    {/each}
                  </svg>

                  <!-- Time reference labels -->
                  {#if smoothLinePaths[0] && smoothLinePaths[0].points.length > 0}
                    {@const pts = smoothLinePaths[0].points}
                    {@const len = pts.length}
                    {@const getTs = (index: number) =>
                      pts[Math.min(index, len - 1)]?.timestamp}
                    {@const formatTime = (ts: number | undefined) => {
                      if (!ts) return "";
                      const d = new Date(ts);
                      if (selectedRange === "24h") {
                        return d.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      }
                      return d.toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                      });
                    }}
                    <div class="time-labels">
                      <span class="time-label">{formatTime(getTs(0))}</span>
                      <span class="time-label"
                        >{formatTime(getTs(Math.floor(len * 0.25)))}</span
                      >
                      <span class="time-label"
                        >{formatTime(getTs(Math.floor(len * 0.5)))}</span
                      >
                      <span class="time-label"
                        >{formatTime(getTs(Math.floor(len * 0.75)))}</span
                      >
                      <span class="time-label"
                        >{formatTime(getTs(len - 1))}</span
                      >
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="empty-state" style="height: 100%;">
                  <TrendingUp size={48} strokeWidth={1} />
                  <p>No hay suficientes datos para mostrar tendencias</p>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Options List / Legend (Visible ONLY in Stats view) -->
          {#if activeView === "stats"}
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
    z-index: 2147483647;
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
    font-size: 1rem;
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

  /* Sub-View Selector (Inside Stats) */
  .subvisual-selector {
    display: flex;
    position: relative;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 20px;
    padding: 4px;
    margin-bottom: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .selector-bg {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    pointer-events: none;
  }

  .selector-indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    width: calc(33.33% - 4px);
    background: #6366f1;
    border-radius: 16px;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
    z-index: 1;
  }

  .selector-btn {
    position: relative;
    z-index: 2;
    padding: 6px 16px;
    width: 80px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s;
    text-align: center;
  }

  .selector-btn.active {
    color: white;
  }

  .selector-btn:hover:not(.active) {
    color: rgba(255, 255, 255, 0.8);
  }

  .view-tabs {
    display: flex;
    gap: 6px;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .view-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
  }

  .view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px; /* Square/Icon only by default */
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .view-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .view-btn sub-btn {
    width: 32px;
    height: 32px;
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

  .line-chart-container.enhanced {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    padding: 0;
    background: transparent;
    border: none;
    user-select: none;
  }

  .line-chart-svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .trend-line-animated {
    stroke-dasharray: 3000;
    stroke-dashoffset: 3000;
    animation: drawLineSlow 1.5s ease forwards;
  }

  @keyframes drawLineSlow {
    to {
      stroke-dashoffset: 0;
    }
  }

  .end-point {
    animation: pulsePoint 2s ease-in-out infinite;
  }

  @keyframes pulsePoint {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  /* Time reference labels */
  .time-labels {
    display: flex;
    justify-content: space-between;
    padding: 8px 8px 0;
    pointer-events: none;
  }

  .time-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 500;
  }

  /* Hover value labels */
  .hover-value-label {
    position: absolute;
    right: 0;
    padding-right: 8px;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 4px;
    transform: translateY(-50%);
    z-index: 20;
  }

  .hover-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .hover-votes {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(0, 0, 0, 0.8);
    padding: 2px 6px;
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }

  /* Scrub info header */
  .scrub-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
  }

  .scrub-votes {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .scrub-votes-number {
    font-size: 2rem;
    font-weight: 800;
    color: white;
    line-height: 1;
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
  }

  .scrub-votes-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .scrub-time {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.08);
    padding: 4px 10px;
    border-radius: 12px;
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

  .donut-segment:focus {
    outline: none;
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
