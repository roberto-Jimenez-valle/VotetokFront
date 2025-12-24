<script lang="ts">
  import { onMount } from "svelte";
  import { Crown, X, Check, Loader2, Clock } from "lucide-svelte";
  import type {
    Post,
    PostType,
    UserVotes,
    RankingDrafts,
    SwipeIndices,
    ViewMode,
  } from "./types";
  import { generateFriends } from "./helpers";
  import PostCard from "./PostCard.svelte";
  import TopTabs from "$lib/TopTabs.svelte";
  import Countdown from "$lib/ui/Countdown.svelte";
  import NavBottom from "$lib/nav-bottom.svelte";
  import CreatePollModal from "$lib/CreatePollModal.svelte";
  import UserProfileModal from "$lib/UserProfileModal.svelte";
  import Select from "$lib/ui/Select.svelte";
  import Skeleton from "$lib/ui/Skeleton.svelte";
  import { apiCall } from "$lib/api/client";
  import { currentUser } from "$lib/stores/auth";

  // Options for custom Selects
  const timeOptions = [
    { label: "24h", value: "24h" },
    { label: "7 días", value: "7d" },
    { label: "30 días", value: "30d" },
    { label: "3 meses", value: "90d" },
    { label: "1 año", value: "1y" },
  ];

  const limitOptions = [
    { label: "Top 10", value: 10 },
    { label: "Top 20", value: 20 },
    { label: "Top 30", value: 30 },
    { label: "Top 40", value: 40 },
    { label: "Top 50", value: 50 },
  ];

  const endingSoonLimitOptions = [
    { label: "Top 10", value: 10 },
    { label: "Top 20", value: 20 },
    { label: "Top 30", value: 30 },
  ];

  let posts = $state<Post[]>([]);
  let userVotes = $state<UserVotes>({});
  let rankingDrafts = $state<RankingDrafts>({});
  let swipeIndices = $state<SwipeIndices>({});
  let currentView = $state<ViewMode>("feed");

  let expandedPostId = $state<string | null>(null);
  let expandedOptionId = $state<string | null>(null);

  let addingPostId = $state<string | null>(null);

  // Loading and error states
  let isLoading = $state(true);
  let isLoadingMore = $state(false);
  let error = $state<string | null>(null);

  // Pagination
  let page = $state(1);
  let hasMore = $state(true);
  const LIMIT = 10;
  let feedContainer: HTMLElement | null = $state(null);

  // NavBottom states
  let hideNav = $state(false);
  let isCreatePollModalOpen = $state(false);
  let buttonColors = $state<string[]>([]);
  let isDesktop = $state(false);

  // Pull-to-Refresh states
  let pullStartY = $state(0);
  let pullDistance = $state(0);
  let isPulling = $state(false);
  let isRefreshing = $state(false);
  const PULL_THRESHOLD = 70; // Minimum pull distance to trigger refresh
  const MAX_PULL = 180; // Maximum visual pull distance (more drag room)

  function handleTouchStart(e: TouchEvent) {
    // Only enable pull-to-refresh when at top of scroll
    if (feedContainer && feedContainer.scrollTop === 0) {
      pullStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY;

    // Only pull down, not up
    if (diff > 0) {
      // Apply resistance (slow down as you pull more)
      pullDistance = Math.min(diff * 0.5, MAX_PULL);

      // Prevent default scroll when pulling
      if (pullDistance > 10) {
        e.preventDefault();
      }
    }
  }

  async function handleTouchEnd() {
    if (!isPulling) return;
    isPulling = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      isRefreshing = true;
      pullDistance = 50; // Keep some pull distance during refresh

      try {
        // Show skeleton during refresh (removed silent mode)
        await fetchPolls();
        await fetchTrendingPosts();
        loadFriendStories();
      } finally {
        isRefreshing = false;
        // Bounce animation - briefly overshoot before settling
        pullDistance = -20;
        setTimeout(() => {
          pullDistance = 0;
        }, 150);
      }
    } else {
      // Cancel - animate back with slight bounce
      pullDistance = -10;
      setTimeout(() => {
        pullDistance = 0;
      }, 150);
    }
  }

  onMount(() => {
    const checkDesktop = () => {
      isDesktop = window.innerWidth >= 1024;
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    const handlePopState = (e: PopStateEvent) => {
      if (currentView === "reels") {
        currentView = "feed";
        // Prevent default back behavior if we just want to switch views
        // But usually, we want to let it happen if we pushed state
      }
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("resize", checkDesktop);
      window.removeEventListener("popstate", handlePopState);
    };
  });

  // Profile modal states
  let isProfileModalOpen = $state(false);
  let selectedProfileUserId = $state<number | null>(null);

  // TopTabs state
  let activeTab = $state<"Para ti" | "Tendencias" | "Amigos" | "Live">(
    "Para ti",
  );
  let timeFilter = $state<"24h" | "7d" | "30d" | "90d" | "1y" | "5y">("30d");

  // Trending carousel state
  let trendingCarouselPage = $state(0);
  let trendingCarouselRef: HTMLElement | null = $state(null);
  let trendingLimit = $state<10 | 20 | 30 | 40 | 50>(10);
  let trendingPosts = $state<Post[]>([]); // Separate from infinite scroll posts
  let trendingLoading = $state(false);
  const ITEMS_PER_PAGE = 4; // 4 items per carousel page

  // Ending soon state (Live tab)
  let endingSoonPosts = $state<Post[]>([]);
  let endingSoonLoading = $state(false);
  let endingSoonPage = $state(0);
  let endingSoonCarouselRef: HTMLElement | null = $state(null);
  let endingSoonLimit = $state<10 | 20 | 30 | 40 | 50>(10);
  let endingSoonPeriod = $state<"24h" | "7d" | "30d" | "90d" | "1y" | "5y">(
    "30d",
  );

  function handleTrendingScroll(e: Event) {
    const target = e.target as HTMLElement;
    const scrollLeft = target.scrollLeft;
    const pageWidth = target.offsetWidth;
    trendingCarouselPage = Math.round(scrollLeft / pageWidth);
  }

  // Load trending posts (separate from infinite scroll)
  async function fetchTrendingPosts() {
    trendingLoading = true;
    try {
      const url = `/api/polls?limit=${trendingLimit}&page=1&status=active&period=${timeFilter}&sort=votes`;
      const response = await apiCall(url);
      if (response.ok) {
        const data = await response.json();
        const apiPolls = data.data || data || [];
        if (Array.isArray(apiPolls)) {
          trendingPosts = apiPolls.map(transformApiPoll);
        }
      }
    } catch (err) {
      console.error("Error fetching trending:", err);
    } finally {
      trendingLoading = false;
    }
  }

  // Load ending soon posts
  async function fetchEndingSoonPosts() {
    endingSoonLoading = true;
    try {
      const url = `/api/polls?limit=${endingSoonLimit}&page=1&status=active&sort=ending_soon&period=${endingSoonPeriod}`;
      const response = await apiCall(url);
      if (response.ok) {
        const data = await response.json();
        const apiPolls = data.data || data || [];
        if (Array.isArray(apiPolls)) {
          endingSoonPosts = apiPolls.map(transformApiPoll);
        }
      }
    } catch (err) {
      console.error("Error fetching ending soon:", err);
    } finally {
      endingSoonLoading = false;
    }
  }

  // Computed: number of pages in trending carousel
  $effect(() => {
    // Reset to page 0 when limit changes
    trendingCarouselPage = 0;
  });

  // Friends with recent polls (Instagram stories style)
  interface FriendStory {
    id: string;
    name: string;
    avatar: string;
    hasNewPoll: boolean;
    pollCount: number;
  }
  let friendStories = $state<FriendStory[]>([]);
  let selectedFriendId = $state<string | null>(null);

  let sortedFriendStories = $derived.by(() => {
    let stories = [...friendStories];
    const me = $currentUser;

    if (activeTab === "Amigos") {
      stories.sort((a, b) => Number(b.hasNewPoll) - Number(a.hasNewPoll));
    }

    if (me) {
      const myId = String(me.userId ?? me.id);
      const myIndex = stories.findIndex((s) => s.id === myId);

      if (myIndex >= 0) {
        const [myStory] = stories.splice(myIndex, 1);
        // Opcional: Cambiar nombre a "Tú"
        // myStory.name = "Tú";
        stories.unshift(myStory);
      } else {
        stories.unshift({
          id: myId,
          name: "Tú",
          avatar:
            me.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${myId}`,
          hasNewPoll: false,
          pollCount: 0,
        });
      }
    }

    return stories;
  });

  // Load friends with recent activity
  async function loadFriendStories() {
    try {
      // Try with-activity first
      let response = await apiCall("/api/users/with-activity?limit=20");
      if (response.ok) {
        const result = await response.json();
        const users = result.data || result.users || result || [];
        console.log(
          "[VotingFeed] Friend stories from with-activity:",
          users.length,
        );

        if (users.length > 0) {
          friendStories = users.map((user: any) => ({
            id: String(user.id),
            name: user.displayName || user.username || "Usuario",
            avatar:
              user.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            hasNewPoll: user.rellsCount > 0 || user.totalActivity > 0,
            pollCount: user.rellsCount || user.totalActivity || 1,
          }));
          return;
        }
      }

      // Fallback: Get users from trending endpoint
      response = await apiCall("/api/users/trending?limit=20");
      if (response.ok) {
        const result = await response.json();
        const users = result.data || result.users || result || [];
        console.log("[VotingFeed] Friend stories from trending:", users.length);

        if (users.length > 0) {
          friendStories = users.map((user: any) => ({
            id: String(user.id),
            name: user.displayName || user.username || "Usuario",
            avatar:
              user.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            hasNewPoll: true,
            pollCount: user._count?.polls || 1,
          }));
          return;
        }
      }

      // Last fallback: Extract users from loaded posts
      if (posts.length > 0) {
        const uniqueUsers = new Map<string, FriendStory>();
        posts.forEach((post) => {
          if (!uniqueUsers.has(post.author)) {
            uniqueUsers.set(post.author, {
              id: post.id,
              name: post.author,
              avatar: post.avatar,
              hasNewPoll: true,
              pollCount: 1,
            });
          }
        });
        friendStories = Array.from(uniqueUsers.values()).slice(0, 20);
        console.log(
          "[VotingFeed] Friend stories from posts:",
          friendStories.length,
        );
      }
    } catch (err) {
      console.error("Error loading friend stories:", err);
    }
  }

  // Get time period label
  function getTimePeriodLabel(filter: string): string {
    const labels: Record<string, string> = {
      "24h": "Últimas 24 horas",
      "7d": "Última semana",
      "30d": "Último mes",
      "90d": "Últimos 3 meses",
      "1y": "Último año",
      "5y": "Últimos 5 años",
    };
    return labels[filter] || "Último mes";
  }

  // Color palette for options
  const OPTION_COLORS = [
    { from: "from-red-600", to: "to-red-900", bar: "bg-red-500" },
    { from: "from-blue-600", to: "to-blue-900", bar: "bg-blue-500" },
    { from: "from-emerald-600", to: "to-emerald-900", bar: "bg-emerald-500" },
    { from: "from-amber-600", to: "to-amber-900", bar: "bg-amber-500" },
    { from: "from-purple-600", to: "to-purple-900", bar: "bg-purple-500" },
    { from: "from-pink-600", to: "to-pink-900", bar: "bg-pink-500" },
    { from: "from-indigo-600", to: "to-indigo-900", bar: "bg-indigo-500" },
    { from: "from-cyan-600", to: "to-cyan-900", bar: "bg-cyan-500" },
    { from: "from-orange-600", to: "to-orange-900", bar: "bg-orange-500" },
    { from: "from-teal-600", to: "to-teal-900", bar: "bg-teal-500" },
  ];

  // Map API poll type to frontend PostType
  function mapPollType(apiType: string): PostType {
    const typeMap: Record<string, PostType> = {
      standard: "standard",
      poll: "standard",
      quiz: "quiz",
      tierlist: "tierlist",
      ranking: "tierlist",
      swipe: "swipe",
      flash: "swipe",
      collab: "collab",
    };
    return typeMap[apiType?.toLowerCase()] || "standard";
  }

  // Transform API poll to VotingFeed Post format
  function transformApiPoll(apiPoll: any): Post {
    if (apiPoll.closedAt) {
      console.log(
        `[VotingFeed] Poll ${apiPoll.id} has closedAt:`,
        apiPoll.closedAt,
      );
    } else {
      // console.log(`[VotingFeed] Poll ${apiPoll.id} has NO closedAt`);
    }

    const totalVotes =
      apiPoll.options?.reduce(
        (sum: number, opt: any) =>
          sum + (opt.voteCount || opt._count?.votes || 0),
        0,
      ) || 0;

    // Check for images - option imageUrl, poll imageUrl, or thumbnail
    const pollImage =
      apiPoll.imageUrl || apiPoll.thumbnailUrl || apiPoll.image_url;

    // Map poll type
    const pollType = mapPollType(apiPoll.type);

    // Get correct option ID for quiz type (use hashId from API or find it)
    let correctOptionId: string | undefined;
    if (pollType === "quiz") {
      // Prefer correctOptionHashId from API, fallback to finding by correctOptionId
      if (apiPoll.correctOptionHashId) {
        correctOptionId = apiPoll.correctOptionHashId;
      } else if (apiPoll.correctOptionId) {
        const correctOpt = apiPoll.options?.find(
          (o: any) => o.id === apiPoll.correctOptionId,
        );
        correctOptionId = correctOpt?.hashId || String(apiPoll.correctOptionId);
      }
    }

    return {
      id: apiPoll.hashId || String(apiPoll.id),
      type: pollType,
      author: apiPoll.user?.displayName || apiPoll.user?.username || "Anónimo",
      avatar:
        apiPoll.user?.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiPoll.userId}`,
      time: getTimeAgo(apiPoll.createdAt),
      question: apiPoll.title || "Sin título",
      collabMode: apiPoll.collabMode, // Añadido
      collaborators: apiPoll.collaborators, // Añadido
      userId: apiPoll.user?.id || apiPoll.userId, // Añadido para verificar permisos
      isFollowing: apiPoll.isFollowing, // Añadido
      totalVotes,
      comments: apiPoll._count?.comments || 0,
      reposts: apiPoll._count?.interactions || 0,
      likes: apiPoll._count?.interactions || 0,
      correctOptionId,
      endsAt: apiPoll.closedAt, // Map closedAt to endsAt
      options: (apiPoll.options || []).map((opt: any, idx: number) => {
        const colors = OPTION_COLORS[idx % OPTION_COLORS.length];
        // Check for option image - could be imageUrl, image_url, or thumbnailUrl
        const optionImage = opt.imageUrl || opt.image_url || opt.thumbnailUrl;

        return {
          id: opt.hashId || String(opt.id),
          title:
            opt.optionLabel ||
            opt.optionText ||
            opt.text ||
            `Opción ${idx + 1}`,
          votes: opt.voteCount || opt._count?.votes || 0,
          friends: opt.createdBy
            ? [
                {
                  id: String(opt.createdBy.id),
                  avatar: opt.createdBy.avatarUrl || "",
                },
              ]
            : [],
          type: optionImage ? ("image" as const) : ("text" as const),
          image: optionImage || pollImage,
          colorFrom: colors.from,
          colorTo: colors.to,
          bgBar: colors.bar,
        };
      }),
    };
  }

  function getTimeRemaining(endDateString: string): string {
    if (!endDateString) return "";
    const end = new Date(endDateString).getTime();
    const now = new Date().getTime();
    const diff = end - now;

    if (diff <= 0) return "Cerrada";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} días ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${minutes} min`;
  }

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

  async function fetchPolls(loadMore = false, silent = false) {
    if (loadMore) {
      if (isLoadingMore || !hasMore) return;
      isLoadingMore = true;
    } else if (!silent) {
      // Only show loading state if not a silent refresh (like pull-to-refresh)
      isLoading = true;
      page = 1;
      hasMore = true;
    } else {
      page = 1;
      hasMore = true;
    }
    error = null;

    try {
      // Use page for pagination (API uses page, not offset)
      const currentPage = loadMore ? page + 1 : 1;

      // Build URL based on active tab
      let url = `/api/polls?limit=${LIMIT}&page=${currentPage}&status=active`;

      // Add time filter for Tendencias tab
      if (activeTab === "Tendencias") {
        url += `&period=${timeFilter}&sort=votes`;
      }

      const response = await apiCall(url);

      if (response.ok) {
        const data = await response.json();
        const apiPolls = data.data || data || [];

        if (Array.isArray(apiPolls)) {
          const newPosts = apiPolls.map(transformApiPoll);

          if (loadMore) {
            // Deduplicate - filter out polls that already exist
            const existingIds = new Set(posts.map((p) => p.id));
            const uniqueNewPosts = newPosts.filter(
              (p) => !existingIds.has(p.id),
            );

            // If no unique polls, stop loading
            if (uniqueNewPosts.length === 0) {
              hasMore = false;
              console.log(`[VotingFeed] No new unique polls, stopping`);
            } else {
              posts = [...posts, ...uniqueNewPosts];
              page = currentPage;
              hasMore = newPosts.length >= LIMIT;
              console.log(
                `[VotingFeed] Page ${currentPage}: ${uniqueNewPosts.length} new polls added`,
              );
            }
          } else {
            posts = newPosts;
            page = 1;
            hasMore = newPosts.length >= LIMIT;
            console.log(`[VotingFeed] Loaded ${newPosts.length} polls`);
          }
        }
      } else {
        throw new Error("Error al cargar encuestas");
      }
    } catch (e) {
      console.error("[VotingFeed] Error fetching polls:", e);
      if (!loadMore) {
        error = e instanceof Error ? e.message : "Error desconocido";
      }
    } finally {
      if (loadMore) {
        isLoadingMore = false;
      } else {
        isLoading = false;
      }
    }
  }

  // Load user votes
  async function fetchUserVotes() {
    try {
      const response = await apiCall("/api/polls/my-votes");
      if (response.ok) {
        const data = await response.json();
        // Handle different response formats
        let votes = data.data || data.votes || data || [];

        // Ensure it's an array
        if (!Array.isArray(votes)) {
          console.warn(
            "[VotingFeed] Votes response is not an array:",
            typeof votes,
          );
          votes = [];
        }

        // Transform to userVotes format
        const votesMap: UserVotes = {};
        votes.forEach((vote: any) => {
          const pollId = vote.poll?.hashId || String(vote.pollId);
          const optionId = vote.option?.hashId || String(vote.optionId);
          votesMap[pollId] = optionId;
        });
        userVotes = votesMap;
      }
    } catch (e) {
      console.error("[VotingFeed] Error fetching user votes:", e);
    }
  }

  // Scroll handler for infinite scroll
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    if (!target) return;

    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Close expanded view on scroll
    if (expandedPostId) {
      setExpanded(null, null);
    }

    // Load more when 200px from bottom
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchPolls(true);
    }
  }

  onMount(async () => {
    await fetchPolls();
    fetchUserVotes();
    loadFriendStories(); // Runs after posts are loaded for fallback
    fetchTrendingPosts();
  });

  // Track previous values to detect real changes
  let prevTab = "";
  let prevFilter = "";
  let prevLimit = 0;

  // Refetch when tab, time filter, or trending limit changes
  $effect(() => {
    const currentTab = activeTab;
    const currentFilter = timeFilter;
    const currentLimit = trendingLimit;

    const tabChanged = currentTab !== prevTab;
    const filterChanged = currentFilter !== prevFilter;
    const limitChanged = currentLimit !== prevLimit;

    if (tabChanged || filterChanged) {
      prevTab = currentTab;
      prevFilter = currentFilter;
      fetchPolls();
    }

    if (activeTab === "Live" && tabChanged) {
      fetchEndingSoonPosts();
    }

    if (filterChanged || limitChanged) {
      prevFilter = currentFilter;
      prevLimit = currentLimit;
      fetchTrendingPosts();
    }
  });

  // Handlers
  function handleVote(postId: string, value: string | string[]) {
    if (userVotes[postId]) return;

    posts = posts.map((p) => {
      if (p.id !== postId) return p;
      let newTotal = p.totalVotes + 1;
      let newOptions = [...p.options];
      if (!Array.isArray(value)) {
        newOptions = newOptions.map((o) =>
          o.id === value ? { ...o, votes: o.votes + 1 } : o,
        );
      }
      return { ...p, options: newOptions, totalVotes: newTotal };
    });

    userVotes = { ...userVotes, [postId]: value };
    expandedPostId = null;
  }

  function handleToggleRank(postId: string, optionId: string) {
    if (userVotes[postId]) return;

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
    rankingDrafts = {
      ...rankingDrafts,
      [postId]: currentDraft.slice(0, -1),
    };
  }

  function handleSwipe(postId: string, direction: "left" | "right") {
    const idx = swipeIndices[postId] || 0;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (idx < post.options.length - 1) {
      swipeIndices = { ...swipeIndices, [postId]: idx + 1 };
    } else {
      handleVote(postId, "done");
    }
  }

  function handleAddCollab(postId: string, text: string) {
    if (!text.trim()) {
      addingPostId = null;
      return;
    }

    posts = posts.map((p) => {
      if (p.id !== postId) return p;
      const newOpt = {
        id: `custom-${Date.now()}`,
        title: text,
        votes: 1,
        friends: [],
        type: "text" as const,
        colorFrom: "from-slate-600",
        colorTo: "to-slate-900",
        bgBar: "bg-slate-500",
      };
      return { ...p, options: [...p.options, newOpt] };
    });
    addingPostId = null;
  }

  function handleCreatePost(newPost: Post) {
    posts = [newPost, ...posts];
  }

  function setExpanded(postId: string | null, optionId: string | null) {
    expandedPostId = postId;
    expandedOptionId = optionId;
  }

  function setAdding(postId: string | null) {
    addingPostId = postId;
  }

  let reelsContainerRef: HTMLElement | null = $state(null);
  let targetReelPostId: string | null = $state(null);
  let currentReelIndex = $state(0); // Track current reel for lazy loading

  function switchToReels(postId: string) {
    if (!postId) {
      currentView = "feed";
      return;
    }
    targetReelPostId = postId;

    // Find the index and set it before switching view for immediate rendering
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      currentReelIndex = postIndex;
    }

    currentView = "reels";

    // Push state to history for back button support
    if (typeof history !== "undefined") {
      history.pushState({ view: "reels" }, "");
    }

    // Wait for DOM to update, then scroll to the correct position
    setTimeout(() => {
      if (reelsContainerRef && postIndex !== -1) {
        // Use the actual slide height for accurate scrolling
        const slide = reelsContainerRef.querySelector(".reel-slide");
        const slideHeight = slide
          ? slide.clientHeight
          : window.innerHeight - 90;
        reelsContainerRef.scrollTop = postIndex * slideHeight;
      }
      targetReelPostId = null;
    }, 50);
  }

  // NavBottom event handlers
  function handleOpenCreatePoll(event: CustomEvent<{ colors: string[] }>) {
    buttonColors = event.detail.colors;
    isCreatePollModalOpen = true;
  }

  function handleCloseCreatePoll() {
    isCreatePollModalOpen = false;
  }

  function handlePollCreated(event: CustomEvent<any>) {
    const newPoll = event.detail;
    console.log("[VotingFeed] Poll created:", newPoll);

    // Transform and add the new poll to the feed
    if (newPoll) {
      const transformedPoll = transformApiPoll(newPoll);
      posts = [transformedPoll, ...posts];
    }

    isCreatePollModalOpen = false;
  }

  function goHome() {
    currentView = "feed";
    // Scroll to top
    const feedContainer = document.querySelector(".overflow-y-auto");
    if (feedContainer) {
      feedContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Handle tab change
  function handleTabChange(event: CustomEvent<string>) {
    const tab = event.detail as typeof activeTab;
    activeTab = tab;
    console.log("[VotingFeed] Tab changed:", tab);
    // Could filter posts based on tab
  }

  // Handle time filter change
  function handleTimeFilterChange(event: CustomEvent<string>) {
    const filter = event.detail as typeof timeFilter;
    timeFilter = filter;
    console.log("[VotingFeed] Time filter changed:", filter);
    // Refetch polls with new time filter
    fetchPolls();
  }
</script>

<div
  class="h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black text-slate-100 flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30 lg:pl-20"
>
  <!-- Header simple con logo y TopTabs - solo en vista feed -->
  {#if currentView === "feed" && !isCreatePollModalOpen}
    <header class="z-50 bg-black/80 backdrop-blur-md flex-shrink-0">
      <div
        class="feed-container-width mx-auto flex items-center justify-between px-4 h-[4rem]"
      >
        <img src="/logo.png" alt="VouTop" class="h-[2.5rem] w-auto" />
        <TopTabs
          bind:active={activeTab}
          bind:timeFilter
          on:change={handleTabChange}
          on:timeFilterChange={handleTimeFilterChange}
        />
      </div>
    </header>
  {/if}

  <!-- Main Content -->
  <main class="flex-1 overflow-hidden relative">
    {#if isLoading}
      <!-- Skeleton Loading State -->
      <div class="h-full overflow-y-auto pb-24">
        <div class="feed-container-width mx-auto px-4 pt-4 space-y-4">
          <!-- Story avatars skeleton -->
          <div class="flex gap-4 pb-4 overflow-hidden">
            {#each Array(6) as _}
              <div class="flex flex-col items-center gap-1.5 min-w-[72px]">
                <Skeleton circle size="64px" />
                <Skeleton width="48px" height="12px" rounded="4px" />
              </div>
            {/each}
          </div>

          <!-- Poll skeletons -->
          {#each Array(3) as _}
            <Skeleton variant="poll" />
          {/each}
        </div>
      </div>
    {:else if error}
      <div class="h-full flex items-center justify-center">
        <div class="flex flex-col items-center gap-4 text-center px-4">
          <div class="p-4 rounded-full bg-red-500/10 border border-red-500/20">
            <X size={32} class="" />
          </div>
          <p class="tfont-medium">{error}</p>
          <button
            onclick={() => fetchPolls()}
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    {:else if posts.length === 0}
      <div class="h-full flex items-center justify-center">
        <div class="flex flex-col items-center gap-4 text-center px-4">
          <div class="p-4 rounded-full bg-slate-800 border border-white/5">
            <Crown size={32} class="text-slate-500" />
          </div>
          <p class="text-slate-400">No hay encuestas disponibles</p>
          <p class="text-slate-500 text-sm">¡Sé el primero en crear una!</p>
        </div>
      </div>
    {:else if currentView === "feed"}
      <!-- Pull-to-Refresh Indicator - Dark gray animated -->
      {#if pullDistance > 0 || isRefreshing}
        {@const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)}
        {@const isReady = pullDistance >= PULL_THRESHOLD}
        <div
          class="fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none lg:pl-20"
          style="top: calc(4rem + {Math.min(
            pullDistance * 0.6,
            40,
          )}px); opacity: {Math.min(pullDistance / (PULL_THRESHOLD * 0.3), 1)};"
        >
          <!-- Outer pulsing ring -->
          <div
            class="absolute rounded-full transition-all duration-300"
            style="
              width: {40 + progress * 20}px;
              height: {40 + progress * 20}px;
              background: radial-gradient(circle, transparent 60%, rgba(255, 255, 255, {isReady
              ? '0.15'
              : '0.05'}) 100%);
              animation: {isRefreshing
              ? 'pulse-ring 1s ease-in-out infinite'
              : 'none'};
            "
          ></div>

          <!-- Main indicator circle - Dark gray -->
          <div
            class="relative w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200"
            style="
              transform: scale({0.7 + progress * 0.4}) rotate({pullDistance *
              2}deg);
              background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
              border: 2px solid rgba(255, 255, 255, {isReady ? '0.2' : '0.08'});
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            "
          >
            {#if isRefreshing}
              <!-- Spinning loader -->
              <Loader2
                size={20}
                class="animate-spin text-gray-400"
                style="animation-duration: 0.7s;"
              />
            {:else}
              <!-- Arrow that rotates -->
              <svg
                class="w-5 h-5 transition-all duration-300"
                style="transform: rotate({isReady ? 180 : 0}deg) scale({0.8 +
                  progress * 0.3}); color: {isReady
                  ? 'rgba(255, 255, 255, 0.9)'
                  : 'rgba(255, 255, 255, 0.5)'};"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            {/if}
          </div>
        </div>
      {/if}

      <div
        class="h-full overflow-y-auto scroll-smooth pb-24"
        bind:this={feedContainer}
        onscroll={handleScroll}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        style="transform: translateY({pullDistance *
          0.5}px); transition: {isPulling
          ? 'none'
          : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'}; overscroll-behavior: none; touch-action: pan-y;"
      >
        <div class="feed-container-width mx-auto min-h-full bg-black/20 pb-10">
          {#if activeTab === "Para ti" || activeTab === "Amigos"}
            <!-- Instagram Stories Style - Friends with recent polls -->
            <div class="px-4 py-4">
              <div class="overflow-x-auto scrollbar-hide">
                <div class="flex gap-4" style="width: max-content;">
                  {#each sortedFriendStories as friend (friend.id)}
                    <button
                      class="flex flex-col items-center gap-1.5 min-w-[72px]"
                      onclick={() => {
                        selectedFriendId = friend.id;
                        currentView = "reels";
                      }}
                    >
                      <!-- Avatar with VouTop gradient ring -->
                      <div
                        class="w-16 h-16 rounded-full p-[2px]"
                        style="background: {friend.hasNewPoll
                          ? 'linear-gradient(135deg, #9ec264, #7ba347, #9ec264)'
                          : '#475569'}"
                      >
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          class="w-full h-full rounded-full object-cover border-2 border-black"
                        />
                      </div>
                      <!-- Name -->
                      <span class="text-xs text-slate-300 truncate max-w-[68px]"
                        >{friend.name.split(" ")[0]}</span
                      >
                    </button>
                  {/each}

                  {#if sortedFriendStories.length === 0}
                    <!-- Placeholder avatars when loading -->
                    {#each Array(6) as _}
                      <div
                        class="flex flex-col items-center gap-1.5 min-w-[72px]"
                      >
                        <Skeleton circle size="64px" />
                        <Skeleton width="48px" height="12px" rounded="4px" />
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            </div>
          {:else if activeTab === "Tendencias"}
            <!-- Trending List Header -->
            <div class="px-4 py-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-white">Trending Global</h2>
                <p class="text-xs text-slate-400 mt-0.5">
                  {trendingPosts.length} encuestas más votadas
                </p>
              </div>
              <div class="flex items-center gap-2">
                <!-- Time selector -->
                <Select
                  options={timeOptions}
                  bind:value={timeFilter}
                  className="w-24"
                />
                <!-- Limit selector -->
                <Select
                  options={limitOptions}
                  bind:value={trendingLimit}
                  className="w-24"
                />
              </div>
            </div>

            <!-- Trending List - Horizontal Carousel (4 items per page) -->
            <div
              class="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              bind:this={trendingCarouselRef}
              onscroll={handleTrendingScroll}
            >
              <div class="flex" style="width: max-content;">
                {#each Array(Math.ceil(trendingPosts.length / ITEMS_PER_PAGE)) as _, pageIndex}
                  <div
                    class="w-screen max-w-2xl snap-center flex-shrink-0 divide-y divide-white/5"
                  >
                    {#each trendingPosts.slice(pageIndex * ITEMS_PER_PAGE, pageIndex * ITEMS_PER_PAGE + ITEMS_PER_PAGE) as post, idx (post.id)}
                      {@const globalIndex = pageIndex * ITEMS_PER_PAGE + idx}
                      {@const positionChange =
                        Math.floor(Math.random() * 5) - 2}
                      <button
                        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                        onclick={() => {
                          currentView = "reels";
                        }}
                      >
                        <!-- Avatar -->
                        <img
                          src={post.avatar}
                          alt={post.author}
                          class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />

                        <!-- Number + Arrow (vertically stacked) -->
                        <div
                          class="flex flex-col items-center justify-center w-6 flex-shrink-0"
                        >
                          <span class="text-slate-400 font-bold text-sm"
                            >{globalIndex + 1}</span
                          >
                          {#if positionChange > 0}
                            <svg
                              class="w-2 h-2 text-green-500"
                              viewBox="0 0 10 10"
                              fill="currentColor"
                            >
                              <polygon points="5,0 10,10 0,10" />
                            </svg>
                          {:else if positionChange < 0}
                            <svg
                              class="w-2 h-2 text-red-500"
                              viewBox="0 0 10 10"
                              fill="currentColor"
                            >
                              <polygon points="0,0 10,0 5,10" />
                            </svg>
                          {:else}
                            <span class="text-slate-600 text-[8px]">—</span>
                          {/if}
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                          <h3
                            class="text-sm font-medium text-white line-clamp-2"
                          >
                            {post.question}
                          </h3>
                          <div class="flex items-center gap-1.5 mt-1">
                            <span class="text-xs text-slate-400"
                              >{post.author}</span
                            >
                            <!-- Verified badge -->
                            <svg
                              class="w-3.5 h-3.5 flex-shrink-0"
                              style="color: #9ec264"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {#if post.totalVotes > 0}
                              <span class="text-xs text-slate-500">•</span>
                              <span class="text-xs text-slate-500"
                                >{post.totalVotes >= 1000
                                  ? `${(post.totalVotes / 1000).toFixed(1)}k`
                                  : post.totalVotes} votos</span
                              >
                            {/if}
                          </div>
                        </div>

                        <!-- More button -->
                        <div
                          role="button"
                          tabindex="0"
                          class="p-1 text-slate-500 hover:text-white flex-shrink-0 cursor-pointer"
                          onclick={(e) => e.stopPropagation()}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              e.stopPropagation();
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="12" cy="6" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="12" cy="18" r="2"></circle>
                          </svg>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Page indicators -->
            <div class="flex justify-center gap-1.5 py-3">
              {#each Array(Math.ceil(trendingPosts.length / ITEMS_PER_PAGE)) as _, i}
                <button
                  aria-label="Ir a página {i + 1}"
                  class="w-1.5 h-1.5 rounded-full transition-colors {i ===
                  trendingCarouselPage
                    ? 'bg-white'
                    : 'bg-white/30'}"
                  onclick={() => {
                    if (trendingCarouselRef) {
                      trendingCarouselRef.scrollTo({
                        left: i * trendingCarouselRef.offsetWidth,
                        behavior: "smooth",
                      });
                    }
                  }}
                ></button>
              {/each}
            </div>
          {:else if activeTab === "Live"}
            <!-- Ending Soon List Header -->
            <div class="px-4 py-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-white">Finalizan pronto</h2>
                <p class="text-xs text-slate-400 mt-0.5">
                  Última oportunidad para votar
                </p>
              </div>
              <div class="flex items-center gap-2">
                <!-- Limit selector ONLY -->
                <Select
                  options={endingSoonLimitOptions}
                  bind:value={endingSoonLimit}
                  on:change={fetchEndingSoonPosts}
                  className="w-24"
                />
              </div>
            </div>

            <!-- Ending Soon List - Horizontal Carousel (Same layout as Trending) -->
            <div
              class="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              bind:this={endingSoonCarouselRef}
              onscroll={(e) => {
                const target = e.target as HTMLElement;
                const scrollLeft = target.scrollLeft;
                const pageWidth = target.offsetWidth;
                endingSoonPage = Math.round(scrollLeft / pageWidth);
              }}
            >
              <div class="flex" style="width: max-content;">
                {#each Array(Math.ceil(endingSoonPosts.length / ITEMS_PER_PAGE)) as _, pageIndex}
                  <div
                    class="w-screen max-w-2xl snap-center flex-shrink-0 divide-y divide-white/5"
                  >
                    {#each endingSoonPosts.slice(pageIndex * ITEMS_PER_PAGE, pageIndex * ITEMS_PER_PAGE + ITEMS_PER_PAGE) as post, idx (post.id)}
                      {@const globalIndex = pageIndex * ITEMS_PER_PAGE + idx}
                      <button
                        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                        onclick={() => {
                          currentView = "reels";
                        }}
                      >
                        <!-- Avatar -->
                        <img
                          src={post.avatar}
                          alt={post.author}
                          class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />

                        <!-- Number (Ranking style) -->
                        <div
                          class="flex flex-col items-center justify-center w-6 flex-shrink-0"
                        >
                          <span class="text-slate-400 font-bold text-sm"
                            >{globalIndex + 1}</span
                          >
                          <!-- Clock icon for ending soon urgency -->
                          <svg
                            class="w-2 h-2 text-orange-500 mt-0.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                          <h3
                            class="text-sm font-medium text-white line-clamp-2"
                          >
                            {post.question}
                          </h3>
                          <div class="flex items-center gap-1.5 mt-1">
                            <span class="text-xs text-slate-400"
                              >{post.author}</span
                            >
                            <!-- Verified badge -->
                            <svg
                              class="w-3.5 h-3.5 flex-shrink-0"
                              style="color: #9ec264"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <div
                              class="flex items-center gap-1 text-xs text-orange-400 font-medium"
                            >
                              <Clock size={12} />
                              <Countdown
                                date={post.endsAt}
                                fallback="Expira pronto"
                              />
                            </div>
                          </div>
                        </div>

                        <!-- More button -->
                        <div
                          role="button"
                          tabindex="0"
                          class="p-1 text-slate-500 hover:text-white flex-shrink-0 cursor-pointer"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="12" cy="6" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="12" cy="18" r="2"></circle>
                          </svg>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Page indicators -->
            <div class="flex justify-center gap-1.5 py-3">
              {#each Array(Math.ceil(endingSoonPosts.length / ITEMS_PER_PAGE)) as _, i}
                <button
                  aria-label="Ir a página {i + 1}"
                  class="w-1.5 h-1.5 rounded-full transition-colors {i ===
                  endingSoonPage
                    ? 'bg-white'
                    : 'bg-white/30'}"
                  onclick={() => {
                    if (endingSoonCarouselRef) {
                      endingSoonCarouselRef.scrollTo({
                        left: i * endingSoonCarouselRef.offsetWidth,
                        behavior: "smooth",
                      });
                    }
                  }}
                ></button>
              {/each}
            </div>
          {/if}

          <!-- Full Posts -->
          <div class="pt-4">
            {#each posts as post (post.id)}
              <PostCard
                {post}
                {userVotes}
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
              />
              <div class="h-[1px] w-full bg-white/10 my-4"></div>
            {/each}

            <!-- Loading more indicator -->
            {#if isLoadingMore}
              <div class="flex items-center justify-center py-8 gap-3">
                <Loader2 size={24} class="animate-spin text-indigo-500" />
                <p class="text-slate-400 text-sm">Cargando más encuestas...</p>
              </div>
            {:else if !hasMore && posts.length > 0}
              <!-- End of feed -->
              <div
                class="flex flex-col items-center justify-center py-16 text-slate-600 gap-3"
              >
                <div
                  class="p-4 rounded-full bg-slate-900/50 border border-white/5"
                >
                  <Check size={24} class="opacity-40" />
                </div>
                <p
                  class="text-xs font-bold uppercase tracking-widest opacity-60"
                >
                  Estás al día
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else if currentView === "reels"}
      {@const VISIBLE_BUFFER = 2}
      <div
        bind:this={reelsContainerRef}
        class="reels-container"
        onscroll={(e) => {
          const target = e.target as HTMLElement;
          const scrollTop = target.scrollTop;
          const reelHeight = target.clientHeight || window.innerHeight;
          const newIndex = Math.round(scrollTop / reelHeight);

          // Close expanded view on scroll
          if (expandedPostId) {
            setExpanded(null, null);
          }

          // Update current index for lazy rendering
          if (newIndex !== currentReelIndex) {
            currentReelIndex = newIndex;
          }

          // Load more when near the end
          if (newIndex >= posts.length - 3 && hasMore && !isLoadingMore) {
            fetchPolls(true);
          }
        }}
      >
        {#each posts as post, index (post.id)}
          {@const shouldRender =
            Math.abs(index - currentReelIndex) <= VISIBLE_BUFFER}
          <div class="reel-slide" data-index={index}>
            {#if shouldRender}
              <div class="reel-content">
                <PostCard
                  {post}
                  {userVotes}
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
                  viewMode="reels"
                />
              </div>
            {:else}
              <!-- Placeholder for non-visible reels (maintains scroll position) -->
              <div class="reel-placeholder">
                <div class="reel-placeholder-content">
                  <Loader2 size={32} class="animate-spin text-white/30" />
                </div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Loading indicator at end -->
        {#if isLoadingMore}
          <div class="reel-slide">
            <div class="reel-placeholder">
              <Loader2 size={40} class="animate-spin text-white/50" />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <!-- Bottom/Sidebar Navigation -->
  {#if (currentView !== "reels" || isDesktop) && !isCreatePollModalOpen}
    <NavBottom
      bind:hidden={hideNav}
      modalOpen={isCreatePollModalOpen}
      on:openCreatePoll={handleOpenCreatePoll}
      on:closeCreatePoll={handleCloseCreatePoll}
      on:openBottomSheet={goHome}
    />
  {/if}

  <!-- Create Poll Modal -->
  <CreatePollModal
    bind:isOpen={isCreatePollModalOpen}
    on:created={handlePollCreated}
    {buttonColors}
  />

  <!-- User Profile Modal -->
  <UserProfileModal
    bind:isOpen={isProfileModalOpen}
    bind:userId={selectedProfileUserId}
  />
</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Feed Container Width */
  .feed-container-width {
    width: 100%;
    max-width: 100%;
  }

  @media (min-width: 768px) {
    .feed-container-width {
      max-width: 80vw;
    }
  }

  @media (min-width: 1024px) {
    .feed-container-width {
      max-width: min(75vw, 1100px);
    }
  }

  @media (min-width: 1536px) {
    .feed-container-width {
      max-width: min(70vw, 1300px);
    }
  }

  /* Snap scrolling */
  .snap-center {
    scroll-snap-align: center;
  }

  .snap-mandatory {
    scroll-snap-type: y mandatory;
  }

  /* Scrollbar hide */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Horizontal snap */
  .snap-x {
    scroll-snap-type: x mandatory;
  }

  /* Animations */
  :global(.animate-in) {
    animation: animate-in 0.3s ease-out;
  }

  :global(.fade-in) {
    animation: fade-in 0.3s ease-out;
  }

  :global(.zoom-in-95) {
    animation: zoom-in-95 0.3s ease-out;
  }

  :global(.slide-in-from-bottom-4) {
    animation: slide-in-from-bottom 0.3s ease-out;
  }

  :global(.zoom-in-0) {
    animation: zoom-in 0.5s ease-out;
  }

  :global(.slide-in-from-bottom-2) {
    animation: slide-in-from-bottom-small 0.5s ease-out;
  }

  @keyframes animate-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes zoom-in-95 {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }

  @keyframes zoom-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes slide-in-from-bottom {
    from {
      transform: translateY(16px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slide-in-from-bottom-small {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* ========================================
     REELS VIEW - Full height optimized layout
     ======================================== */

  .reels-container {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    background: #000;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: env(safe-area-inset-bottom);
  }

  @media screen and (min-width: 768px) {
    .reels-container {
      background: radial-gradient(circle at center, #1e1b4b 0%, #020617 100%);
    }
  }

  .reels-container::-webkit-scrollbar {
    display: none;
  }

  .reel-slide {
    width: 100%;
    height: 100%;
    flex-shrink: 0;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    background: #000;
    overflow: hidden;
  }

  .reel-content {
    width: 100%;
    height: 100%;
    max-width: 100%;
    padding: 0;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .reel-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
  }

  .reel-placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Tablet adjustments */
  @media (min-width: 640px) {
    .reel-content {
      max-width: 85vw;
      height: 100%;
      margin: auto;
      padding: 0;
      background: #000;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
    }
  }

  /* Desktop adjustments - wider but centered */
  @media (min-width: 768px) {
    .reel-content {
      max-width: 80vw;
      height: 100%;
      max-height: 100vh;
      margin: auto;
      padding: 0;
      overflow: hidden;
      border: none;
    }
  }

  /* Large desktop */
  @media (min-width: 1024px) {
    .reel-content {
      max-width: min(75vw, 1100px);
      height: 100%;
      max-height: 100vh;
      margin: auto;
    }
  }

  /* Ultra wide */
  @media (min-width: 1536px) {
    .reel-content {
      max-width: min(70vw, 1300px);
    }
  }

  /* Disable browser's native pull-to-refresh */
  :global(html),
  :global(body) {
    overscroll-behavior-y: contain;
  }
</style>
