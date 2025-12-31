<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { page as pageStore } from "$app/stores";
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
  import { transformApiPollToPost } from "./pollUtils";
  import PostCard from "./PostCard.svelte";
  import TopTabs from "$lib/TopTabs.svelte";
  import Countdown from "$lib/ui/Countdown.svelte";
  import NavBottom from "$lib/nav-bottom.svelte";
  import CreatePollModal from "$lib/CreatePollModal.svelte";
  import UserProfileModal from "$lib/UserProfileModal.svelte";
  import CommentsModal from "$lib/components/CommentsModal.svelte";
  import ShareModal from "$lib/components/ShareModal.svelte";
  import PostOptionsModal from "$lib/components/PostOptionsModal.svelte";
  import StatsFullscreenModal from "$lib/components/StatsFullscreenModal.svelte";
  import PollStatsModal from "$lib/components/PollStatsModal.svelte";
  import ReportModal from "$lib/components/ReportModal.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
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
  // Track liked options during swipe mode (before final submission)
  let swipeLikes = $state<Record<string, string[]>>({});
  let currentView = $state<ViewMode>("feed");

  // User Reels Mode - tracks when viewing a specific user's content
  let isUserReelsMode = $state(false);
  let feedPostsCache = $state<Post[]>([]);
  let seenInSession = new Set<string>();

  // User Reels Queue (Instagram Stories style) - navigate between users
  let userReelsQueue = $state<string[]>([]); // Queue of user IDs with reels
  let currentUserQueueIndex = $state(0); // Current position in the queue
  let currentUserReelsAuthor = $state(""); // Current user's display name
  let currentUserReelsAvatar = $state(""); // Current user's avatar URL
  let isLoadingNextUser = $state(false); // Prevent multiple loads
  let transitionDirection = $state(1); // 1 for next, -1 for prev

  // Touch tracking for next user navigation
  let touchStartY = 0;
  let touchEndY = 0;

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

  // Confirmation Modal
  let isConfirmOpen = $state(false);
  let confirmConfig = $state({
    title: "",
    message: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    isDangerous: false,
    onConfirm: async () => {},
  });

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
        // Only switch back to feed, but don't affect other modals
        currentView = "feed";

        // Restore the posts from cache if we were in user reels mode
        if (isUserReelsMode && feedPostsCache.length > 0) {
          posts = feedPostsCache;
          isUserReelsMode = false;
        }

        // If we came from profile modal, ensure it stays open
        // The profile modal's own popstate handler will handle the state correctly
      }
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("resize", checkDesktop);
      window.removeEventListener("popstate", handlePopState);
    };
  });

  async function handleUnfollowUser(post: Post) {
    if (!$currentUser || !post.userId) return;

    // Optimistic: update all posts from this user to not following
    const userId = post.userId;
    posts = posts.map((p) => {
      if (p.userId === userId) {
        return { ...p, isFollowing: false, isPending: false };
      }
      return p;
    });

    try {
      const res = await apiCall(`/api/users/${userId}/follow`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Error unfollowing");
      }
    } catch (e) {
      console.error("Error unfollowing:", e);
    }
  }

  function handleNotInterested(post: Post) {
    // Just hide it locally for now
    posts = posts.filter((p) => p.id !== post.id);
  }

  async function registerView(pollId: string) {
    if (!pollId) return;
    try {
      await apiCall(`/api/polls/${pollId}/view`, { method: "POST" });

      // Update friend stories statuses if the author is in the list
      const post = posts.find((p) => p.id === pollId);
      if (post && post.userId) {
        const authorIdStr = String(post.userId);
        if (friendStories.some((f) => f.id === authorIdStr)) {
          loadFriendStories();
        }
      }
    } catch (e) {
      console.error("Error registering view:", e);
    }
  }

  let viewTimer: any;
  $effect(() => {
    if (currentView === "reels" && posts[currentReelIndex]) {
      const post = posts[currentReelIndex];
      clearTimeout(viewTimer);
      viewTimer = setTimeout(() => {
        registerView(post.id);
      }, 1000);
    }
    return () => clearTimeout(viewTimer);
  });
  let isProfileModalOpen = $state(false);
  let selectedProfileUserId = $state<number | null>(null);

  // Comments Modal State
  let isCommentsModalOpen = $state(false);
  let commentsPollId = $state<string | number>("");
  let commentsPollTitle = $state("");

  // Share Modal State
  let isShareModalOpen = $state(false);
  let sharePollHashId = $state("");
  let sharePollTitle = $state("");

  // Post Options Modal State (Global to avoid z-index/stacking context issues)
  let isOptionsModalOpen = $state(false);
  let optionsModalPost = $state<Post | null>(null);

  // Poll Stats Modal State
  let isStatsModalOpen = $state(false);
  let statsModalPost = $state<Post | null>(null);
  let isStatsBottomModalOpen = $state(false);

  // Report Modal State
  let isReportModalOpen = $state(false);
  let reportPollId = $state("");

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
  // Derived Stories: Strictly generate from loaded posts (< 24h old)
  // This guarantees NO GHOSTS (old users) in the bar.
  let friendStories = $derived.by(() => {
    const uniqueUsers = new Map();
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // Ensure posts have timestamp
    posts.forEach((post) => {
      const uId =
        post.userId !== undefined
          ? String(post.userId)
          : post.user?.id
            ? String(post.user.id)
            : null;
      // Time check
      const pTime = post.timestamp || 0;
      const isRecent = now - pTime < ONE_DAY;

      if (isRecent && uId && !uniqueUsers.has(uId)) {
        uniqueUsers.set(uId, {
          id: uId,
          name:
            post.user?.displayName ||
            post.user?.username ||
            post.author ||
            "Usuario",
          avatar: post.user?.avatarUrl || post.avatar,
          hasNewPoll: true,
          pollCount: 1,
        });
      }
    });
    return Array.from(uniqueUsers.values()).slice(0, 20);
  });
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

  // Filter feed posts to exclude RECENT content from users with active stories (deduplication)
  let filteredFeedPosts = $derived.by(() => {
    let displayPosts = posts;

    // 1. Deduplication Filter
    if (currentView === "feed" && friendStories.length > 0) {
      const storyUserIds = new Set(
        sortedFriendStories.map((f) => String(f.id).trim()),
      );

      if (storyUserIds.size > 0) {
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        const filtered = posts.filter((p) => {
          const uId =
            p.userId !== undefined
              ? String(p.userId)
              : p.user?.id
                ? String(p.user.id)
                : "";
          const isStoryUser = storyUserIds.has(uId.trim());

          if (isStoryUser) {
            // Logic: If user is in Story Bar, their Recent posts (<24h) are likely duplications of what's in the Reel.
            // We hide Recent posts, but ALLOW Older posts (>24h) in the feed.
            const isRecent = p.timestamp ? now - p.timestamp < ONE_DAY : true;
            return !isRecent;
          }
          return true;
        });

        // If filter results in empty feed (e.g. only recent posts exist), use original posts (Fallback)
        if (filtered.length > 0 || posts.length === 0) {
          displayPosts = filtered;
        }
      }
    }

    // 2. Sort: Unvoted First
    if (currentView === "feed") {
      // Create a shallow copy to prevent mutation issues and sort
      return [...displayPosts].sort((a, b) => {
        // Check local votes state
        const aVoted = !!userVotes[a.id];
        const bVoted = !!userVotes[b.id];

        // If voting status is different, prioritize unvoted (false < true)
        if (aVoted !== bVoted) {
          return aVoted ? 1 : -1;
        }

        // If status is same, maintain original order (stability)
        return 0;
      });
    }

    return displayPosts;
  });

  // Load friends with recent activity
  const loadFriendStories = async () => {};
  /*
  async function loadFriendStories_DISABLED() {
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
            hasNewPoll: user.hasNewPoll ?? false,
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
            hasNewPoll: false,
            pollCount: user._count?.polls || 1,
          }));
          return;
        }
      }

      // Last fallback: Extract users from loaded posts
      if (posts.length > 0) {
        const uniqueUsers = new Map<string, FriendStory>();
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        posts.forEach((post) => {
          // Fix: Use correct User ID, not Post ID
          const uId =
            post.userId !== undefined
              ? String(post.userId)
              : post.user?.id
                ? String(post.user.id)
                : null;

          // Filter by time: Only add to story bar if post is < 24h old
          // This prevents users with old content from appearing in the stories bar
          const pTime =
            post.timestamp ||
            (post.createdAt ? new Date(post.createdAt).getTime() : 0);
          const isRecent = now - pTime < ONE_DAY;

          if (isRecent && uId && !uniqueUsers.has(uId)) {
            uniqueUsers.set(uId, {
              id: uId,
              name:
                post.user?.displayName ||
                post.user?.username ||
                post.author ||
                "Usuario",
              avatar: post.user?.avatarUrl || post.avatar,
              hasNewPoll: true, // Assume active if in feed & recent
              pollCount: 1,
            });
          }
        });
        friendStories = Array.from(uniqueUsers.values()).slice(0, 20);
        console.log(
          "[VotingFeed] Friend stories from posts (Fallback):",
          friendStories.length,
        );
      }
    } catch (err) {
      console.error("Error loading friend stories:", err);
    }
  }
  */

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
      internalId:
        Math.random().toString(36).substring(2) + Date.now().toString(36),
      numericId: apiPoll.id,
      // Map backend 'ranking' to frontend 'tierlist' to ensure OptionCard renders correctly
      type:
        apiPoll.type === "ranking" ? "tierlist" : (apiPoll.type as PostType),
      author: apiPoll.user?.displayName || apiPoll.user?.username || "Anónimo",
      avatar:
        apiPoll.user?.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiPoll.userId}`,
      time: getTimeAgo(apiPoll.createdAt),
      timestamp: apiPoll.createdAt
        ? new Date(apiPoll.createdAt).getTime()
        : Date.now(),
      question: apiPoll.title || "Sin título",
      collabMode: apiPoll.collabMode, // Añadido
      collaborators: apiPoll.collaborators, // Añadido
      user: apiPoll.user, // Añadido incluyendo hasUnseenReels
      userId: apiPoll.user?.id || apiPoll.userId, // Añadido para verificar permisos
      isFollowing: apiPoll.isFollowing, // Añadido
      isPending: apiPoll.isPending, // Añadido
      isBookmarked: apiPoll.isBookmarked, // Añadido
      isReposted: apiPoll.isReposted, // Añadido
      hasCommented: apiPoll.hasCommented, // Añadido
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

        // Use stored color if available, otherwise fallback to index-based palette
        let colorFrom = colors.from;
        let colorTo = colors.to;
        let bgBar = colors.bar;

        if (opt.color) {
          // If we have a custom color (hex), use it
          // OptionCard expects CSS values or tailwind classes
          // For simplicity, we use the same color for gradient or maybe calculate a darker shade?
          // Using the hex directly works if OptionCard handles it, otherwise we might need to assume it works as a CSS value
          colorFrom = opt.color;
          colorTo = opt.color; // Flat color for now, or could adjust brightness
          bgBar = `bg-[${opt.color}]`; // Tailwind arbitrary value, or just inline style elsewhere
        }

        return {
          id: opt.hashId || String(opt.id),
          internalId:
            Math.random().toString(36).substring(2) + Date.now().toString(36),
          numericId: opt.id,
          title:
            opt.optionLabel ||
            opt.optionText ||
            opt.text ||
            `Opción ${idx + 1}`,
          votes: opt.voteCount || opt._count?.votes || 0,
          friends: (opt.friendVoters || [])
            .map((v: any) => ({
              id: String(v.id),
              avatar: v.avatarUrl || "",
            }))
            .concat(
              opt.createdBy
                ? [
                    {
                      id: String(opt.createdBy.id),
                      avatar: opt.createdBy.avatarUrl || "",
                    },
                  ]
                : [],
            ),
          type: optionImage ? ("image" as const) : ("text" as const),
          image: optionImage || pollImage,
          colorFrom: colorFrom,
          colorTo: colorTo,
          bgBar: bgBar,
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
            // Logic for Infinite Loop: If back at page 1 with posts, we are looping
            const isLooping = currentPage === 1 && posts.length > 0;

            // Deduplicate only if NOT looping (allow duplicates for infinite scroll)
            let postsToAdd = newPosts;
            if (!isLooping) {
              const existingIds = new Set(posts.map((p) => p.id));
              postsToAdd = newPosts.filter((p) => !existingIds.has(p.id));
            }

            if (postsToAdd.length === 0) {
              // If API returned nothing, it means we reached end of DB
              if (apiPolls.length === 0) {
                if (currentPage === 1) {
                  hasMore = false;
                  return;
                }
                console.log("[VotingFeed] End of feed, looping...");
                page = 0; // Reset pagination
                hasMore = true;
                // Recursive fetch to load page 1 immediately
                await fetchPolls(true, true);
              } else {
                hasMore = false;
                console.log(
                  `[VotingFeed] No new unique polls (overlap), stopping`,
                );
              }
            } else {
              posts = [...posts, ...postsToAdd];
              page = currentPage;
              // If we got items, assume there might be more, especially if looping
              hasMore = true;
              console.log(
                `[VotingFeed] Added ${postsToAdd.length} polls (Loop: ${isLooping})`,
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
        // Reverse to process from Oldest to Newest (FIFO) to match optimistic order
        votes.reverse().forEach((vote: any) => {
          const pollId = vote.poll?.hashId || String(vote.pollId);
          const optionId = vote.option?.hashId || String(vote.optionId);

          if (!pollId || !optionId) {
            return;
          }

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
    handleUrlParams(); // Procesar enlaces directos (reportes, compartidos)
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

  // Reaccionar a cambios en la URL (Deep linking)
  $effect(() => {
    // Dependemos del search de la página para disparar la lógica
    const search = $pageStore.url.search;
    if (search.includes("poll=")) {
      handleUrlParams();
    }
  });

  // Handlers
  async function handleVote(postId: string, value: string | string[]) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const isMulti = ["tierlist", "ranking", "multiple", "swipe"].includes(
      post.type,
    );

    // Block standard single-vote polls if already voted
    if (!isMulti && userVotes[postId]) return;

    // 4. Handle Array of Votes (Ranking / Tierlist)
    if (Array.isArray(value)) {
      // Optimistic Update
      const previousVotes = userVotes[postId];
      userVotes = { ...userVotes, [postId]: value };

      try {
        // First, clear existing votes to ensure clean slate (and correct order)
        // Only if we know we have votes locally
        if (previousVotes) {
          try {
            await apiCall(`/api/polls/${postId}/vote`, { method: "DELETE" });
          } catch (delErr: any) {
            // Ignore 404 (Not Found) - means user hasn't voted yet, which is fine
            if (delErr.status !== 404) {
              throw delErr;
            }
          }
        }

        // Obtener geolocalización real
        let latitude = 40.4168; // Fallback Madrid
        let longitude = -3.7038;
        let subdivisionId = null;

        try {
          // 1. GPS
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 3000,
              });
            },
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch (err) {
          // 2. IP Fallback
          try {
            const ipRes = await fetch("https://ipapi.co/json/");
            if (ipRes.ok) {
              const ipData = (await ipRes.ok) ? await ipRes.json() : null;
              if (ipData?.latitude) {
                latitude = ipData.latitude;
                longitude = ipData.longitude;
              }
            }
          } catch (e) {}
        }

        // 3. Geocode
        try {
          const geoRes = await apiCall(
            `/api/geocode?lat=${latitude}&lon=${longitude}`,
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.found) subdivisionId = geoData.subdivisionId;
          }
        } catch (e) {}

        // Then send votes sequentially to preserve order
        // Use for...of to await sequentially
        for (const optionId of value) {
          const numericOptionId = post.options.find(
            (o) => o.id === optionId,
          )?.numericId;
          if (numericOptionId) {
            await apiCall(`/api/polls/${postId}/vote`, {
              method: "POST",
              body: JSON.stringify({
                optionId: numericOptionId,
                latitude,
                longitude,
                subdivisionId,
              }),
            });
          }
        }

        // Refetch to confirm
        fetchUserVotes();
      } catch (err) {
        console.error("Error submitting ranking votes:", err);
        // Revert optimistic update
        userVotes = { ...userVotes, [postId]: previousVotes };
        alert("Error al guardar tu ranking. Inténtalo de nuevo.");
      }
      return;
    }

    // 5. Handle Single Vote (Standard, Swipe, or Toggle in Ranking)
    // 1. Resolve Numeric ID
    let numericOptionId: number | undefined;
    if (value !== "done" && !Array.isArray(value)) {
      numericOptionId = post.options.find((o) => o.id === value)?.numericId;
    }

    if (!numericOptionId && !Array.isArray(value) && value !== "done") {
      console.error("Could not find numeric option ID for vote. Stale state?");
      alert(
        "Error: Datos desactualizados. Por favor recarga la página para habilitar el voto.",
      );
      return;
    }

    // 2. Optimistic Update Logic
    const previousVotes = userVotes[postId];
    let newVotesValue: string | string[] | undefined = value; // Use undefined for deletion

    if (isMulti && !Array.isArray(value)) {
      // Toggle logic for Multi/Tierlist
      const currentVotes = Array.isArray(previousVotes)
        ? previousVotes
        : previousVotes
          ? [previousVotes]
          : [];

      if (currentVotes.includes(value)) {
        // Remove
        const filtered = currentVotes.filter((v) => v !== value);
        newVotesValue =
          filtered.length === 0
            ? undefined
            : filtered.length === 1
              ? filtered[0]
              : filtered;
      } else {
        // Add
        newVotesValue = [...currentVotes, value];
      }
    }

    // Apply to UI (Posts count update)
    // totalVotes should only change when user transitions from not-voted to voted (or reverse)
    const wasVoted = !!previousVotes;
    const willBeVoted =
      newVotesValue !== undefined &&
      !(Array.isArray(newVotesValue) && newVotesValue.length === 0);

    posts = posts.map((p) => {
      if (p.id !== postId) return p;

      let newTotal = p.totalVotes;
      let newOptions = [...p.options];

      // Update individual option counts
      if (!Array.isArray(value)) {
        // Single interaction - update option count
        const isAdding = Array.isArray(newVotesValue)
          ? newVotesValue.includes(value)
          : newVotesValue === value;

        const delta = isAdding ? 1 : -1;
        newOptions = newOptions.map((o) =>
          o.id === value ? { ...o, votes: Math.max(0, o.votes + delta) } : o,
        );
      }

      // Update totalVotes ONLY when transitioning between voted/not-voted states
      // (one user = one total vote, regardless of how many options they selected)
      if (!wasVoted && willBeVoted) {
        // First vote by this user
        newTotal += 1;
      } else if (wasVoted && !willBeVoted) {
        // User is removing their last vote
        newTotal = Math.max(0, newTotal - 1);
      }
      // If user was already voted and still voted, totalVotes doesn't change

      return { ...p, options: newOptions, totalVotes: newTotal };
    });

    // Update global userVotes
    if (
      newVotesValue === undefined ||
      (Array.isArray(newVotesValue) && newVotesValue.length === 0)
    ) {
      const newMap = { ...userVotes };
      delete newMap[postId];
      userVotes = newMap;
    } else {
      userVotes = { ...userVotes, [postId]: newVotesValue };
    }

    expandedPostId = null;

    // 3. API Call
    try {
      if (numericOptionId) {
        // Obtener geolocalización real
        let latitude = 40.4168; // Fallback Madrid
        let longitude = -3.7038;
        let subdivisionId = null;

        try {
          // 1. GPS
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 3000,
              });
            },
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch (err) {
          // 2. IP Fallback
          try {
            const ipRes = await fetch("https://ipapi.co/json/");
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData?.latitude) {
                latitude = ipData.latitude;
                longitude = ipData.longitude;
              }
            }
          } catch (e) {}
        }

        // 3. Geocode
        try {
          const geoRes = await apiCall(
            `/api/geocode?lat=${latitude}&lon=${longitude}`,
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.found) subdivisionId = geoData.subdivisionId;
          }
        } catch (e) {}

        const payload = {
          optionId: numericOptionId,
          latitude,
          longitude,
          subdivisionId,
        };

        console.log("[VotingFeed] Voting with payload:", payload);

        const urlId = post.numericId || postId;
        const response = await apiCall(`/api/polls/${urlId}/vote`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Vote failed");
        }
      }
    } catch (err) {
      console.error("Error submitting vote:", err);
      alert("Error al guardar el voto. Por favor intenta de nuevo.");

      // Revert Optimistic Update
      if (previousVotes === undefined) {
        const newMap = { ...userVotes };
        delete newMap[postId];
        userVotes = newMap;
      } else {
        userVotes = { ...userVotes, [postId]: previousVotes };
      }

      // Note: Reverting post counts perfectly is complex here without saving 'delta'.
      // Assumption: User will reload or accept slight count drift on error until refresh.
    }
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

  async function handleSwipe(postId: string, direction: "left" | "right") {
    const idx = swipeIndices[postId] || 0;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const currentOption = post.options[idx];
    if (!currentOption) return;

    // Track like/dislike locally
    if (direction === "right") {
      // Add to likes
      const currentLikes = swipeLikes[postId] || [];
      swipeLikes = {
        ...swipeLikes,
        [postId]: [...currentLikes, currentOption.id],
      };

      // Optimistic UI update for this option's vote count ONLY (not totalVotes yet)
      posts = posts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          // Don't increment totalVotes here - do it once at the end
          options: p.options.map((o) =>
            o.id === currentOption.id ? { ...o, votes: o.votes + 1 } : o,
          ),
        };
      });
    }
    // If direction is "left", we don't add to likes (dislike = no vote)

    // Move to next option
    const nextIdx = idx + 1;
    swipeIndices = { ...swipeIndices, [postId]: nextIdx };

    // Check if we've swiped through all options
    if (nextIdx >= post.options.length) {
      // Swiping complete - submit all liked votes to backend
      const likedOptions = swipeLikes[postId] || [];

      // Mark as voted with the list of liked options
      if (likedOptions.length > 0) {
        userVotes = { ...userVotes, [postId]: likedOptions };

        // NOW increment totalVotes by 1 (one user = one total vote)
        posts = posts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            totalVotes: p.totalVotes + 1,
          };
        });
      } else {
        // User disliked everything - mark as "done" with empty array
        userVotes = { ...userVotes, [postId]: "done" };
      }

      // Submit votes to backend
      try {
        for (const optionId of likedOptions) {
          const numericOptionId = post.options.find(
            (o) => o.id === optionId,
          )?.numericId;

          if (numericOptionId) {
            // Geolocation for swipe votes
            let latitude = 40.4168;
            let longitude = -3.7038;
            let subdivisionId = null;

            try {
              const pos = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 2000,
                  });
                },
              );
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
            } catch (e) {
              // Fallback basic (similar to others, keeping it concise)
            }

            try {
              const geoRes = await apiCall(
                `/api/geocode?lat=${latitude}&lon=${longitude}`,
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.found) subdivisionId = geoData.subdivisionId;
              }
            } catch (e) {}

            await apiCall(`/api/polls/${postId}/vote`, {
              method: "POST",
              body: JSON.stringify({
                optionId: numericOptionId,
                latitude,
                longitude,
                subdivisionId,
              }),
            });
          }
        }
        console.log(
          `[VotingFeed] Swipe complete for ${postId}. Voted for:`,
          likedOptions,
        );
      } catch (err) {
        console.error("Error submitting swipe votes:", err);
        alert("Error al guardar tus votos. Por favor intenta de nuevo.");
        // Revert on error
        const newVotes = { ...userVotes };
        delete newVotes[postId];
        userVotes = newVotes;
      }

      // Clean up swipeLikes for this post
      const newSwipeLikes = { ...swipeLikes };
      delete newSwipeLikes[postId];
      swipeLikes = newSwipeLikes;
    }
  }

  async function handleAddCollab(
    postId: string,
    text: string,
    image?: string | null,
    color?: string,
  ) {
    if (!text.trim()) {
      addingPostId = null;
      return;
    }

    const tempId = `custom-${Date.now()}`;
    const newOpt = {
      id: tempId,
      title: text,
      votes: 0,
      friends: [],
      type: image ? ("image" as const) : ("text" as const),
      image: image || undefined,
      colorFrom: color || "from-slate-600",
      colorTo: color || "to-slate-900",
      bgBar: "bg-slate-500",
    };

    // Optimistic update
    posts = posts.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, options: [...p.options, newOpt] };
    });
    addingPostId = null;

    try {
      const response = await apiCall(`/api/polls/${postId}/options`, {
        method: "POST",
        body: JSON.stringify({
          label: text,
          imageUrl: image,
          color: color,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const savedOption = result.data;

        // Update with real data
        posts = posts.map((p) => {
          if (p.id !== postId) return p;
          const opts = p.options.map((o) => {
            if (o.id === tempId) {
              return {
                ...o,
                id: savedOption.hashId || String(savedOption.id),
                numericId: savedOption.id,
                image: savedOption.imageUrl || savedOption.image_url || o.image,
                // Ensure backend returned color is used if available
                colorFrom: savedOption.color || o.colorFrom,
                colorTo: savedOption.color || o.colorTo,
              };
            }
            return o;
          });
          return { ...p, options: opts };
        });
      } else {
        console.error("Failed to save option remotely");
        // Optional: Show error or revert
      }
    } catch (err) {
      console.error("Error saving option:", err);
    }
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

  // State for preserving feed scroll position
  let feedScrollPosition = $state(0);

  function switchToReels(postId: string, contextPolls?: Post[]) {
    if (!postId) {
      if (isUserReelsMode) {
        // Restore feed
        if (feedPostsCache.length > 0) {
          posts = feedPostsCache;
        }
        isUserReelsMode = false;
        feedPostsCache = [];
      }
      currentView = "feed";

      // Restore scroll position
      setTimeout(() => {
        if (feedContainer) {
          feedContainer.scrollTop = feedScrollPosition;
        }
      }, 0);

      if (typeof history !== "undefined") {
        // Verify if we should back or just replace logic?
        // If we pushed state, back button naturally handles popstate.
        // But clear logic is good.
      }
      return;
    }

    // Entering Reels Mode
    // Save scroll position before switching (if we are in feed)
    if (currentView === "feed" && feedContainer) {
      feedScrollPosition = feedContainer.scrollTop;
    }

    if (contextPolls && contextPolls.length > 0) {
      if (!isUserReelsMode) {
        // First time entering user mode, cache current feed
        feedPostsCache = [...posts];
      }
      posts = contextPolls;
      isUserReelsMode = true;
    }

    targetReelPostId = postId;

    // Find the index and set it before switching view for immediate rendering
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      currentReelIndex = postIndex;
    }

    currentView = "reels";

    // Push state to history for back button support
    // Include info about the profile modal so we can restore it on back
    if (typeof history !== "undefined") {
      history.pushState(
        {
          view: "reels",
          fromProfile: isProfileModalOpen,
          profileUserId: selectedProfileUserId,
        },
        "",
      );
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

      // Optimistic Update for Story Bar (Green Border)
      const userData = get(currentUser);
      if (userData) {
        const userId = String(userData.userId ?? userData.id);

        // Find existing story
        const existingStory = friendStories.find((s) => s.id === userId);
        let story;

        if (existingStory) {
          // Clone existing story to avoid proxy mutation issues
          story = { ...existingStory };
          // Remove from list (will add back at start)
          friendStories = friendStories.filter((s) => s.id !== userId);
        } else {
          // Create new story entry (Self)
          story = {
            id: userId,
            name: userData.displayName || userData.username || "Tú",
            avatar:
              userData.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
            hasNewPoll: true,
            pollCount: 0,
          };
        }

        // Update status and move to front
        story.hasNewPoll = true;
        story.pollCount = (story.pollCount || 0) + 1;
        friendStories = [story, ...friendStories];
        console.log("[VotingFeed] Optimistic story update (New Poll) for self");
      }
    }

    isCreatePollModalOpen = false;
  }

  async function handleNotificationClick(event: CustomEvent) {
    const { pollId, userId, type, commentId, openReels } = event.detail;

    console.log("[VotingFeed] Handling notification click:", {
      pollId,
      userId,
      type,
      commentId,
      openReels,
    });

    // Caso 0: Click en avatar con reels pendientes o flag explícito
    if (openReels && userId) {
      await handleFriendStoryClick(String(userId));
      return;
    }

    // Caso 1: Navegación a Encuesta / Comentario
    if (pollId) {
      // Intentar encontrar el post existente.
      // Nota: posts usa HashIDs, pero pollId de notificación puede ser numérico.
      // Si no coinciden, fallará aquí y haremos fetch, lo cual es seguro.
      let targetPost = posts.find((p) => p.id === String(pollId));

      if (!targetPost) {
        // Fetch the poll
        isLoading = true;
        try {
          const response = await apiCall(`/api/polls/${pollId}`);
          if (response.ok) {
            const data = await response.json();
            const pollData = data.data || data;

            if (pollData) {
              const transformedPoll = transformApiPoll(pollData);

              // Verificar si ya existe con el ID transformado (HashID)
              const existingIndex = posts.findIndex(
                (p) => p.id === transformedPoll.id,
              );

              if (existingIndex !== -1) {
                // Actualizar existente
                const newPosts = [...posts];
                newPosts[existingIndex] = transformedPoll;
                posts = newPosts;
                targetPost = transformedPoll;
              } else {
                // Agregar al inicio
                posts = [transformedPoll, ...posts];
                targetPost = transformedPoll;
              }
            }
          }
        } catch (e) {
          console.error("Error fetching poll from notification:", e);
        } finally {
          isLoading = false;
        }
      }

      if (targetPost) {
        switchToReels(targetPost.id);

        // Si hay commentId o es tipo comentario/mención, abrir modal
        if (commentId || type === "comment" || type === "mention") {
          setTimeout(() => {
            commentsPollId = targetPost!.id;
            commentsPollTitle = targetPost!.question;
            isCommentsModalOpen = true;
          }, 300); // Pequeño delay para que la transición a reels termine/empiece
        }
      }
      return;
    }

    // Caso 2: Navegación a Perfil de Usuario (Follows)
    if (
      userId &&
      (type === "new_follower" ||
        type === "follow_request" ||
        type === "avatar_click" ||
        !pollId)
    ) {
      selectedProfileUserId = Number(userId);
      isProfileModalOpen = true;
    }
  }

  /**
   * Manejar parámetros de URL al cargar (Deep linking)
   * Ejemplo: /?poll=HASHID&comment=ID
   */
  async function handleUrlParams() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get("poll");
    const commentId = params.get("comment");

    if (pollId) {
      console.log("[VotingFeed] Procesando enlace permanente:", {
        pollId,
        commentId,
      });
      // Reutilizar la lógica de notificaciones
      await handleNotificationClick(
        new CustomEvent("url_navigation", {
          detail: {
            pollId: pollId,
            commentId: commentId,
            type: commentId ? "comment" : "poll",
          },
        }) as any,
      );
    }
  }

  // Handle interactions
  function handleComment(post: Post) {
    commentsPollId = post.id;
    commentsPollTitle = post.question;
    isCommentsModalOpen = true;
  }

  function handleShare(post: Post) {
    sharePollHashId = post.id; // Assuming id is the hashId or we have a hashId field. Post type says id is string.
    sharePollTitle = post.question;
    isShareModalOpen = true;
  }

  function handleOpenOptions(post: Post) {
    optionsModalPost = post;
    isOptionsModalOpen = true;
  }

  function handleStatsClick(post: Post) {
    statsModalPost = post;
    isStatsModalOpen = true;
  }

  async function handleRepost(post: Post) {
    // Find current state from posts array to avoid stale reference
    const currentPost = posts.find((p) => p.id === post.id);
    if (!currentPost || currentPost.isReposted) {
      console.log("[VotingFeed] Already reposted or post not found, skipping");
      return;
    }

    // Optimistic update
    posts = posts.map((p) => {
      if (p.id === post.id) {
        return {
          ...p,
          reposts: (p.reposts || 0) + 1,
          isReposted: true,
        };
      }
      return p;
    });

    try {
      await apiCall(`/api/polls/${post.id}/repost`, {
        method: "POST",
      });

      // Optimistic Update for Story Bar (Green Border)
      const userData = get(currentUser);
      if (userData) {
        const userId = String(userData.userId ?? userData.id);

        // Find existing story
        const existingStory = friendStories.find((s) => s.id === userId);
        let story;

        if (existingStory) {
          // Clone existing story
          story = { ...existingStory };
          // Remove from list
          friendStories = friendStories.filter((s) => s.id !== userId);
        } else {
          // Create new story entry
          story = {
            id: userId,
            name: userData.displayName || userData.username || "Tú",
            avatar:
              userData.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
            hasNewPoll: true,
            pollCount: 0,
          };
        }

        // Update status and move to front
        story.hasNewPoll = true;
        story.pollCount = (story.pollCount || 0) + 1;
        friendStories = [story, ...friendStories];
        console.log("[VotingFeed] Optimistic story update (Repost) for self");
      }
    } catch (e: any) {
      console.error("Error reposting:", e);

      // If error is "already reposted" (400), keep the optimistic state
      if (e.status === 400) {
        console.log("[VotingFeed] Already reposted, keeping optimistic update");
        // Don't revert - the state is already correct on the server
      } else {
        // Revert optimistic update for other errors
        posts = posts.map((p) => {
          if (p.id === post.id) {
            return {
              ...p,
              reposts: Math.max(0, (p.reposts || 0) - 1),
              isReposted: false,
            };
          }
          return p;
        });

        // Show error to user
        if (e.message && e.status !== 400) {
          alert(e.message);
        }
      }
    }
  }

  async function handleAvatarClick(post: Post) {
    if (post.userId) {
      // Si tiene reels sin ver y NO estamos ya en modo reels, vamos a las historias (Instagram style)
      if (post.user?.hasUnseenReels && currentView !== "reels") {
        await handleFriendStoryClick(String(post.userId));
      } else {
        // En cualquier otro caso (sin reels nuevos o si ya estamos viéndolos), vamos al perfil
        selectedProfileUserId = Number(post.userId);
        isProfileModalOpen = true;
      }
    }
  }

  async function handleFriendStoryClick(friendId: string) {
    if (!friendId) return;

    // Optimistic Update: Mark as viewed immediately for instant capability
    friendStories = friendStories.map((f) =>
      f.id === friendId ? { ...f, hasNewPoll: false } : f,
    );

    // Build the queue of users with content (from sorted friend stories)
    // This enables Instagram-style navigation between users
    const queue = sortedFriendStories.map((f) => f.id);
    const queueIndex = queue.indexOf(friendId);

    // Load that user's polls and switch to reels
    isLoading = true;
    try {
      // Use the polls endpoint
      const response = await apiCall(`/api/users/${friendId}/polls`);
      if (response.ok) {
        const data = await response.json();
        const userPolls = (data.data || data.polls || data || []).map(
          transformApiPoll,
        );

        if (userPolls.length > 0) {
          // Cache the current feed before overwriting with user polls
          if (!isUserReelsMode && posts.length > 0) {
            feedPostsCache = [...posts];
            if (feedContainer) {
              feedScrollPosition = feedContainer.scrollTop;
            }
            seenInSession.clear(); // Start fresh tracking for this session
          }

          // Set up the user reels queue
          userReelsQueue = queue;
          currentUserQueueIndex = queueIndex >= 0 ? queueIndex : 0;
          const storyUser = sortedFriendStories.find((f) => f.id === friendId);
          currentUserReelsAuthor = storyUser?.name || "";
          currentUserReelsAvatar = storyUser?.avatar || "";

          isUserReelsMode = true;
          posts = userPolls;
          // Track viewed polls to filter them from home feed later
          userPolls.forEach((p: Post) => seenInSession.add(p.id));
          currentReelIndex = 0; // Reset to first reel
          currentView = "reels";

          // Register views in the database for all Rels (fire and forget)
          // This persists the viewed state so they won't show green border on reload
          userPolls.forEach((poll: Post) => {
            // Register view for ALL content in the story to ensure notification clears
            apiCall(`/api/polls/${poll.id}/view`, { method: "POST" }).catch(
              () => {
                // Silently ignore errors - view tracking is not critical
              },
            );
          });

          // We are now in a "user mode". goHome needs to handle this.
        } else {
          // If no polls, open profile
          selectedProfileUserId = Number(friendId);
          isProfileModalOpen = true;
        }
      }
    } catch (e) {
      console.error("Error loading user reels:", e);
      // Fallback to profile
      selectedProfileUserId = Number(friendId);
      isProfileModalOpen = true;
    } finally {
      isLoading = false;
    }
  }

  // Load the next user's reels in the queue
  // Load the next user's reels in the queue
  async function loadNextUserInQueue() {
    if (!isUserReelsMode || userReelsQueue.length === 0 || isLoadingNextUser)
      return;
    isLoadingNextUser = true;
    transitionDirection = 1; // Transition forward (up/left)

    const nextIndex = currentUserQueueIndex + 1;

    // If we've reached the end of the queue, exit reels mode
    if (nextIndex >= userReelsQueue.length) {
      console.log("[VotingFeed] End of user queue, returning to feed");
      goHome();
      isLoadingNextUser = false;
      return;
    }

    const nextUserId = userReelsQueue[nextIndex];

    // Mark current user as viewed
    friendStories = friendStories.map((f) =>
      f.id === nextUserId ? { ...f, hasNewPoll: false } : f,
    );

    try {
      const response = await apiCall(`/api/users/${nextUserId}/polls`);
      if (response.ok) {
        const data = await response.json();
        const userPolls = (data.data || data.polls || data || []).map(
          transformApiPoll,
        );

        if (userPolls.length > 0) {
          // Update queue position and author
          currentUserQueueIndex = nextIndex;
          const storyUser = sortedFriendStories.find(
            (f) => f.id === nextUserId,
          );
          currentUserReelsAuthor = storyUser?.name || "";
          currentUserReelsAvatar = storyUser?.avatar || "";

          // Replace posts with new user's content
          posts = userPolls;
          userPolls.forEach((p: Post) => seenInSession.add(p.id)); // Track for filtering
          currentReelIndex = 0;

          // Scroll to top
          if (reelsContainerRef) {
            reelsContainerRef.scrollTop = 0;
          }

          // Register views
          userPolls.forEach((poll: Post) => {
            apiCall(`/api/polls/${poll.id}/view`, { method: "POST" }).catch(
              () => {},
            );
          });

          console.log(
            `[VotingFeed] Loaded next user: ${currentUserReelsAuthor} (${userPolls.length} reels)`,
          );
          isLoadingNextUser = false;
        } else {
          // Skip users with no polls and try next
          currentUserQueueIndex = nextIndex;
          isLoadingNextUser = false;
          loadNextUserInQueue();
        }
      }
    } catch (e) {
      console.error("Error loading next user reels:", e);
      // Skip to next user on error
      currentUserQueueIndex = nextIndex;
      isLoadingNextUser = false;
      loadNextUserInQueue();
    }
  }

  // Load the previous user's reels (Swipe Down at start)
  async function loadPreviousUserInQueue() {
    if (!isUserReelsMode || userReelsQueue.length === 0 || isLoadingNextUser)
      return;

    const prevIndex = currentUserQueueIndex - 1;

    // If it's the first user, maybe return to feed?
    if (prevIndex < 0) {
      console.log("[VotingFeed] Start of queue, returning to feed");
      goHome();
      return;
    }

    isLoadingNextUser = true; // Block other loads
    transitionDirection = -1; // Transition backward (down/right)

    const prevUserId = userReelsQueue[prevIndex];

    try {
      const response = await apiCall(`/api/users/${prevUserId}/polls`);
      if (response.ok) {
        const data = await response.json();
        const userPolls = (data.data || data.polls || data || []).map(
          transformApiPoll,
        );

        if (userPolls.length > 0) {
          currentUserQueueIndex = prevIndex;
          const storyUser = sortedFriendStories.find(
            (f) => f.id === prevUserId,
          );
          currentUserReelsAuthor = storyUser?.name || "";
          currentUserReelsAvatar = storyUser?.avatar || "";

          // Replace posts with new user's content
          posts = userPolls;
          userPolls.forEach((p: Post) => seenInSession.add(p.id)); // Track for filtering

          // Start at the LAST reel when coming from "below" (previous user)
          currentReelIndex = posts.length - 1;

          // Scroll to bottom immediately (after tick to ensure DOM is ready)
          if (reelsContainerRef) {
            const reelHeight =
              reelsContainerRef.clientHeight || window.innerHeight;
            // Calculate max scroll but ensure we don't exceed it initially to allow snap to work
            setTimeout(() => {
              if (reelsContainerRef) {
                reelsContainerRef.scrollTop = currentReelIndex * reelHeight;
              }
            }, 0);
          }
        } else {
          // Skip empty users backwards
          currentUserQueueIndex = prevIndex;
          isLoadingNextUser = false;
          loadPreviousUserInQueue(); // Recursively try previous
          return;
        }
      }
    } catch (e) {
      console.error("Error loading prev user:", e);
      currentUserQueueIndex = prevIndex;
      isLoadingNextUser = false;
      loadPreviousUserInQueue();
      return;
    }

    isLoadingNextUser = false;
  }

  // Ref Updated goHome
  function goHome() {
    currentView = "feed";

    // If we were in user reels mode, restore the cached feed
    if (isUserReelsMode && feedPostsCache.length > 0) {
      // Filter out polls seen in reels session to keep feed fresh
      posts = feedPostsCache.filter((p) => !seenInSession.has(p.id));

      // If user watched everything in their feed, fetch more
      if (posts.length < 3) {
        fetchPolls(true); // Fetch more (append) or just fetchPolls() for fresh?
        // If we append, we keep the few remaining. If posts is empty, fetchPolls handles it.
        if (posts.length === 0) fetchPolls();
      }
      feedPostsCache = [];
      isUserReelsMode = false;
    } else {
      // Reload main feed to ensure we aren't stuck on user polls
      fetchPolls();
    }

    // Scroll restoration
    tick().then(() => {
      // Prefer binded element, fallback to querySelector
      const container =
        feedContainer || document.querySelector(".overflow-y-auto");

      if (container) {
        if (feedScrollPosition > 0) {
          container.scrollTop = feedScrollPosition;
          feedScrollPosition = 0;
        } else {
          // Default to top if no saved position
          container.scrollTop = 0;
        }
      }
    });
  }

  // Delete Handler (Admin or Author)
  async function handleDeletePost(post: Post, isAdminForce = false) {
    // Close modal first
    isOptionsModalOpen = false;

    confirmConfig = {
      title: isAdminForce ? "⚠️ Borrar Encuesta (Admin)" : "Eliminar Encuesta",
      message: isAdminForce
        ? "Esta acción borrará la encuesta permanentemente. ¿Continuar?"
        : "¿Estás seguro de que deseas eliminar esta encuesta?",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      isDangerous: true,
      onConfirm: async () => {
        isConfirmOpen = false;
        console.log(
          "[VotingFeed] Deleting post:",
          post.id,
          "AdminForce:",
          isAdminForce,
        );
        try {
          const response = await apiCall(`/api/polls/${post.id}`, {
            method: "DELETE",
          });

          if (response.ok) {
            console.log("[VotingFeed] Post deleted successfully");
            posts = posts.filter((p) => p.id !== post.id);
            trendingPosts = trendingPosts.filter((p) => p.id !== post.id);

            if (currentView === "reels") goHome();
          } else {
            const data = await response.json();
            console.error("[VotingFeed] Delete failed:", data);
            alert(data.message || "Error al eliminar la encuesta.");
          }
        } catch (e) {
          console.error("[VotingFeed] Network error during delete:", e);
          alert("Error de conexión al intentar eliminar.");
        }
      },
    };
    isConfirmOpen = true;
  }

  async function handleAdminReset(post: Post) {
    isOptionsModalOpen = false;

    confirmConfig = {
      title: "⚠️ Resetear Votos (Admin)",
      message:
        "Esto borrará TODOS los votos de esta encuesta. Es irreversible. ¿Continuar?",
      confirmText: "Resetear Votos",
      cancelText: "Cancelar",
      isDangerous: true,
      onConfirm: async () => {
        isConfirmOpen = false;
        try {
          const response = await apiCall(`/api/polls/${post.id}/reset-votes`, {
            method: "DELETE",
          });
          if (response.ok) {
            // Update local state
            posts = posts.map((p) => {
              if (p.id === post.id) {
                return {
                  ...p,
                  totalVotes: 0,
                  options: p.options.map((o) => ({ ...o, votes: 0 })),
                };
              }
              return p;
            });

            // Clear user vote locally
            const newVotes = { ...userVotes };
            delete newVotes[post.id];
            userVotes = newVotes;

            alert("Votos reseteados exitosamente.");
          } else {
            const data = await response.json();
            alert(data.message || "Error al resetear.");
          }
        } catch (e) {
          console.error(e);
          alert("Error de red.");
        }
      },
    };
    isConfirmOpen = true;
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
  // Custom transition to keep element in background with depth effect
  function stayBackground(node: Element, { duration }: { duration: number }) {
    return {
      duration,
      css: (t: number) => {
        return `
          transform: scale(${0.92 + 0.08 * t});
          opacity: ${0.5 + 0.5 * t};
          filter: brightness(${0.5 + 0.5 * t});
          z-index: 0;
        `;
      },
    };
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
      <!-- Skeleton Loading State - adapts to current view -->
      {#if currentView === "reels"}
        <!-- Full-screen Reel skeleton -->
        <Skeleton variant="reel" />
      {:else}
        <!-- Feed skeleton -->
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
      {/if}
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
            <div class="px-2 py-2">
              <div class="overflow-x-auto scrollbar-hide">
                <div class="flex gap-4" style="width: max-content;">
                  {#each sortedFriendStories as friend (friend.id)}
                    <button
                      class="flex flex-col items-center gap-1.5 min-w-[72px]"
                      onclick={() => handleFriendStoryClick(friend.id)}
                    >
                      <!-- Avatar with VouTop gradient ring -->
                      <div
                        class="w-16 h-16 rounded-full p-[2px] transition-all"
                        style="background: {friend.hasNewPoll
                          ? 'linear-gradient(135deg, #9ec264, #7ba347, #9ec264)'
                          : 'transparent'}"
                      >
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          class="w-full h-full rounded-full object-cover border-2 {friend.hasNewPoll
                            ? 'border-black'
                            : 'border-slate-700'}"
                        />
                      </div>
                      <!-- Name -->
                      <span class="text-xs text-slate-300 truncate max-w-[68px]"
                        >{friend.name.split(" ")[0]}</span
                      >
                    </button>
                  {/each}

                  {#if sortedFriendStories.length === 0 && isLoading}
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
            {#each filteredFeedPosts as post (post.internalId || post.id)}
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
                onComment={handleComment}
                onShare={handleShare}
                onRepost={handleRepost}
                onAvatarClick={handleAvatarClick}
                onOpenOptions={handleOpenOptions}
                onStatsClick={handleStatsClick}
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
      {@const currentPost = posts[currentReelIndex]}

      <!-- Full Page Transition Wrapper -->
      {#key currentUserQueueIndex}
        <div
          class="absolute inset-0 w-full h-full overflow-hidden bg-black"
          in:fly={{
            y: transitionDirection * 100 + "%",
            duration: 600,
            easing: cubicOut,
            opacity: 1,
          }}
          out:stayBackground={{
            duration: 600,
          }}
        >
          <!-- Reels Progress Overlay -->
          <div class="reels-overlay-minimal">
            <!-- Avatar on the left -->
            {#if isUserReelsMode && currentUserReelsAvatar}
              <img
                src={currentUserReelsAvatar}
                alt="User"
                class="reels-avatar-mini left-avatar"
              />
            {/if}

            {#if isUserReelsMode}
              <!-- Progress bars -->
              <div class="reels-progress-bars-minimal">
                {#each posts as _, i}
                  <div class="progress-bar-mini">
                    <div
                      class="progress-bar-fill-mini"
                      class:active={i === currentReelIndex}
                      class:completed={i < currentReelIndex}
                    ></div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Position counter on the right -->
            {#if isUserReelsMode}
              <div class="reels-info-mini">
                <span class="reels-position-mini">
                  {currentReelIndex + 1}/{posts.length}
                </span>
              </div>
            {/if}
          </div>

          <div
            bind:this={reelsContainerRef}
            class="reels-container"
            ontouchstart={(e) => {
              touchStartY = e.changedTouches[0].screenY;
            }}
            ontouchend={(e) => {
              touchEndY = e.changedTouches[0].screenY;
              const diff = touchStartY - touchEndY;

              if (isUserReelsMode) {
                // Swipe Up (Next User)
                if (currentReelIndex === posts.length - 1 && diff > 50) {
                  loadNextUserInQueue();
                }
                // Swipe Down (Previous User) - only if at top
                else if (currentReelIndex === 0 && diff < -50) {
                  loadPreviousUserInQueue();
                }
              }
            }}
            onwheel={(e) => {
              if (!isUserReelsMode || isLoadingNextUser) return;

              const target = e.currentTarget as HTMLElement;
              // Check if scrolled to bottom (allow 2px margin of error)
              const isAtBottom =
                Math.abs(
                  target.scrollHeight - target.scrollTop - target.clientHeight,
                ) < 2;
              const isAtTop = target.scrollTop <= 0;

              // Debounce threshold for wheel delta to prevent accidental triggers
              const threshold = 30;

              if (isAtBottom && e.deltaY > threshold) {
                loadNextUserInQueue();
              } else if (isAtTop && e.deltaY < -threshold) {
                loadPreviousUserInQueue();
              }
            }}
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

              // Load more when near the end (only for general feed mode)
              if (
                !isUserReelsMode &&
                newIndex >= posts.length - 3 &&
                hasMore &&
                !isLoadingMore
              ) {
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
                      onComment={handleComment}
                      onShare={handleShare}
                      onRepost={handleRepost}
                      onAvatarClick={handleAvatarClick}
                      onOpenOptions={handleOpenOptions}
                      onStatsClick={handleStatsClick}
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
        </div>
      {/key}
    {/if}
  </main>

  <!-- Bottom/Sidebar Navigation -->
  {#if (currentView !== "reels" || isDesktop) && !isCreatePollModalOpen && !isStatsModalOpen}
    <NavBottom
      bind:hidden={hideNav}
      modalOpen={isCreatePollModalOpen}
      on:openCreatePoll={handleOpenCreatePoll}
      on:closeCreatePoll={handleCloseCreatePoll}
      on:openBottomSheet={goHome}
      on:notificationClick={handleNotificationClick}
      on:openPollInGlobe={(e) => switchToReels(e.detail.poll.id)}
      on:statsClick={(e) => handleStatsClick(e.detail.post)}
      on:comment={(e) => handleComment(e.detail.post)}
      on:share={(e) => handleShare(e.detail.post)}
      on:repost={(e) => handleRepost(e.detail.post)}
      on:openOptions={(e) => handleOpenOptions(e.detail.post)}
      on:followChange={(e) => {
        const { userId, isFollowing, isPending } = e.detail;
        if (!userId) return;
        posts = posts.map((p) => {
          if (p.userId === userId || p.user?.id === userId) {
            return { ...p, isFollowing, isPending };
          }
          return p;
        });
      }}
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
    onPollClick={(detail) => {
      console.log(
        "[VotingFeed] Received pollClick from profile:",
        detail.pollId,
      );
      const { pollId, polls } = detail;
      switchToReels(pollId, polls);
    }}
    onStatsClick={(detail) => {
      console.log(
        "[VotingFeed] Received statsClick from profile:",
        detail.post?.id,
      );
      handleStatsClick(detail.post);
    }}
    onComment={(detail) => {
      console.log(
        "[VotingFeed] Received comment from profile:",
        detail.post?.id,
      );
      handleComment(detail.post);
    }}
    onShare={(detail) => {
      console.log("[VotingFeed] Received share from profile:", detail.post?.id);
      handleShare(detail.post);
    }}
    onRepost={(detail) => {
      console.log(
        "[VotingFeed] Received repost from profile:",
        detail.post?.id,
      );
      handleRepost(detail.post);
    }}
    onUserClick={(detail) => {
      console.log(
        "[VotingFeed] Received userClick from profile:",
        detail.userId,
      );
      selectedProfileUserId = detail.userId;
    }}
    onFollowChange={(detail) => {
      console.log(
        "[VotingFeed] Received followChange from profile:",
        detail.userId,
      );
      const { userId, isFollowing, isPending } = detail;
      if (!userId) return;
      posts = posts.map((p) => {
        if (p.userId === userId || p.user?.id === userId) {
          return { ...p, isFollowing, isPending };
        }
        return p;
      });
      // Also update cache if exists
      if (feedPostsCache.length > 0) {
        feedPostsCache = feedPostsCache.map((p) => {
          if (p.userId === userId || p.user?.id === userId) {
            return { ...p, isFollowing, isPending };
          }
          return p;
        });
      }
    }}
    onOpenOptions={(detail) => {
      console.log(
        "[VotingFeed] Received openOptions from profile:",
        detail.post?.id,
      );
      handleOpenOptions(detail.post);
    }}
  />

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

  <!-- Post Options Modal -->
  {#if optionsModalPost}
    <PostOptionsModal
      isOpen={isOptionsModalOpen}
      post={optionsModalPost}
      onClose={() => (isOptionsModalOpen = false)}
      onReport={() => {
        if (optionsModalPost) {
          reportPollId = optionsModalPost.id;
          isReportModalOpen = true;
        }
      }}
      onDelete={() => {
        console.log("[VotingFeed] onDelete prop triggered");
        if (optionsModalPost) handleDeletePost(optionsModalPost, false);
      }}
      onAdminDelete={() => {
        console.log("[VotingFeed] onAdminDelete prop triggered");
        if (optionsModalPost) handleDeletePost(optionsModalPost, true);
      }}
      onAdminReset={() => {
        console.log("[VotingFeed] onAdminReset prop triggered");
        if (optionsModalPost) handleAdminReset(optionsModalPost);
      }}
      onUnfollow={() => {
        if (optionsModalPost) {
          // We can reuse the same logic we use in PostCard or a dedicated function
          // For now, let's call a new handler handleUnfollowUser
          handleUnfollowUser(optionsModalPost);
        }
      }}
      onNotInterested={() => {
        if (optionsModalPost) {
          // Maybe hide the post locally?
          posts = posts.filter((p) => p.id !== optionsModalPost?.id);
        }
      }}
    />
  {/if}

  <ConfirmModal
    isOpen={isConfirmOpen}
    title={confirmConfig.title}
    message={confirmConfig.message}
    confirmText={confirmConfig.confirmText}
    cancelText={confirmConfig.cancelText}
    isDangerous={confirmConfig.isDangerous}
    onConfirm={confirmConfig.onConfirm}
    onCancel={() => (isConfirmOpen = false)}
  />

  <ReportModal
    isOpen={isReportModalOpen}
    postId={reportPollId}
    onClose={() => (isReportModalOpen = false)}
  />

  <StatsFullscreenModal
    bind:isOpen={isStatsModalOpen}
    pollId={statsModalPost?.hashId || statsModalPost?.id || ""}
    pollTitle={statsModalPost?.question || "Estadísticas"}
    pollCreator={statsModalPost?.user ||
    statsModalPost?.avatar ||
    statsModalPost?.author
      ? {
          id: statsModalPost.user?.id
            ? typeof statsModalPost.user.id === "string"
              ? parseInt(statsModalPost.user.id, 10)
              : statsModalPost.user.id
            : statsModalPost.userId || 0,
          username:
            statsModalPost.user?.username || statsModalPost.author || "unknown",
          displayName:
            statsModalPost.user?.displayName || statsModalPost.author,
          avatarUrl: statsModalPost.user?.avatarUrl || statsModalPost.avatar,
        }
      : undefined}
    options={statsModalPost?.options?.map((opt: any) => {
      const label =
        opt.title ||
        opt.label ||
        opt.optionLabel ||
        opt.optionText ||
        opt.text ||
        `Opción ${opt.key || opt.optionKey || opt.id}`;
      // Map friends to friendVotes format (Friend has 'avatar', FriendVote expects 'avatarUrl')
      const friendVotes = (
        opt.friends ||
        opt.friendVotes ||
        opt.friendVoters ||
        []
      ).map((f: any) => ({
        id: typeof f.id === "string" ? parseInt(f.id, 10) || 0 : f.id || 0,
        username: f.username || f.name || "user",
        displayName: f.displayName || f.name,
        avatarUrl: f.avatarUrl || f.avatar || "",
      }));
      return {
        key: opt.key || opt.optionKey || opt.id,
        label: label,
        color: opt.color || opt.colorFrom || "#888888",
        votes: opt.voteCount || opt.votes || 0,
        friendVotes: friendVotes,
      };
    }) || []}
    onClose={() => {
      isStatsModalOpen = false;
      statsModalPost = null;
    }}
    onOpenInGlobe={() => {
      // Abrir StatsBottomModal con datos globales
      isStatsBottomModalOpen = true;
    }}
  />

  <!-- Modal del Globo 3D -->
  <PollStatsModal
    isOpen={isStatsBottomModalOpen}
    post={statsModalPost}
    userVote={statsModalPost ? userVotes[statsModalPost.id] || null : null}
    onClose={() => {
      isStatsBottomModalOpen = false;
    }}
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
    padding-bottom: 0;
    overflow-x: hidden;
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

  /* ========================================
     REELS PROGRESS INDICATOR - MINIMAL
     ======================================== */

  .reels-overlay-minimal {
    position: absolute;
    top: env(safe-area-inset-top, 0);
    left: 0;
    right: 0;
    width: 100%;
    z-index: 50;
    padding: 8px 8px 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  /* Minimal progress bars */
  .reels-progress-bars-minimal {
    display: flex;
    gap: 2px;
    flex: 1;
  }

  .progress-bar-mini {
    flex: 1;
    height: 2px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 1px;
    overflow: hidden;
  }

  .progress-bar-fill-mini {
    height: 100%;
    width: 0%;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 1px;
    transition: width 0.2s ease;
  }

  .progress-bar-fill-mini.completed {
    width: 100%;
    background: rgba(255, 255, 255, 0.9);
  }

  .progress-bar-fill-mini.active {
    width: 100%;
    background: white;
  }

  /* Minimal counter */
  /* Minimal info container */
  .reels-info-mini {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .reels-info-solo {
    position: absolute;
    right: 8px;
    top: 4px; /* Move slightly up when solo to align nicely */
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    border-radius: 12px;
    font-size: 10px;
  }

  .reels-avatar-mini {
    width: 20px; /* Slightly larger for better visibility */
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.5);
    margin-right: 4px; /* Space between avatar and progress bars */
    flex-shrink: 0;
  }

  .reels-separator-mini {
    font-size: 8px;
    opacity: 0.5;
  }

  .reels-position-mini {
    font-variant-numeric: tabular-nums;
  }
</style>
