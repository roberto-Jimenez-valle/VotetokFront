<script lang="ts">
    import {
        X,
        TrendingUp,
        Clock,
        Award,
        PieChart,
        BarChart3,
        Loader2,
        Calendar,
        ChevronRight,
        Activity,
        Target,
        Zap,
        Globe,
    } from "lucide-svelte";
    import GlobeGL from "$lib/GlobeGL.svelte";
    import { fly, scale, fade } from "svelte/transition";
    import { cubicOut, quintOut } from "svelte/easing";
    import type { Post } from "$lib/voting-feed/types";
    import { apiCall } from "$lib/api/client";
    import { currentUser } from "$lib/stores/auth";

    interface Props {
        isOpen: boolean;
        post: Post | null;
        userVote: string | string[] | null;
        onClose: () => void;
    }

    let { isOpen, post, userVote, onClose }: Props = $props();

    // Stats states
    let chartView = $state<"bars" | "lines" | "pie" | "world">("bars");
    let timeFilter = $state<"H" | "D" | "M" | "Y">("H");
    let isLoadingHistory = $state(false);
    let historyData = $state<any[]>([]);
    let friendsVotes = $state<Record<string, any[]>>({});

    // Interaction
    let hoveredTimeIdx = $state<number | null>(null);
    let activePieIdx = $state<number | null>(null);
    let hoveredBarIdx = $state<number | null>(null);
    let pieSubView = $state<"donut" | "radar" | "polar">("donut");

    // Derived stats from current post data
    const optionStats = $derived.by(() => {
        if (!post) return [];
        const total = (post.totalVotes || 0) > 0 ? post.totalVotes : 1;
        return post.options
            .map((opt) => ({
                ...opt,
                percentage: Math.round((opt.votes / total) * 100),
                isVoted: Array.isArray(userVote)
                    ? userVote.includes(opt.id)
                    : userVote === opt.id,
                votedFriends:
                    friendsVotes[opt.numericId || opt.id] || opt.friends || [],
            }))
            .toSorted((a, b) => b.votes - a.votes);
    });

    const winner = $derived(optionStats[0]);
    const tiedLeaders = $derived.by(() => {
        if (!winner || winner.votes === 0) return [];
        return optionStats.filter((opt) => opt.votes === winner.votes);
    });
    const isTie = $derived(tiedLeaders.length > 1);

    // Fetch real history data
    async function fetchHistory() {
        if (!post) return;
        isLoadingHistory = true;
        try {
            const days =
                timeFilter === "H"
                    ? 1
                    : timeFilter === "D"
                      ? 7
                      : timeFilter === "M"
                        ? 30
                        : 365;
            const res = await apiCall(
                `/api/polls/${post.numericId || post.id}/votes-history?days=${days}`,
            );
            if (res.ok) {
                const json = await res.json();
                historyData = json.data || [];
            }
        } catch (err) {
            console.error("Error fetching history:", err);
        } finally {
            isLoadingHistory = false;
        }
    }

    // Fetch friends votes
    async function fetchFriendsVotes() {
        if (!post || !$currentUser) return;
        try {
            const res = await apiCall(
                `/api/polls/${post.numericId || post.id}/friends-votes?userId=${$currentUser.id || $currentUser.userId}`,
            );
            if (res.ok) {
                const json = await res.json();
                const mapped: Record<string, any[]> = {};
                Object.entries(json.data || {}).forEach(([key, friends]) => {
                    const opt = post.options.find((o) => o.title === key);
                    if (opt) mapped[opt.numericId || opt.id] = friends as any[];
                });
                friendsVotes = mapped;
            }
        } catch (err) {
            console.error("Error fetching friends votes:", err);
        }
    }

    $effect(() => {
        if (isOpen && post) {
            fetchFriendsVotes();
            if (chartView === "lines") fetchHistory();
        }
    });

    $effect(() => {
        if (chartView === "lines") fetchHistory();
    });

    // Chart calculations
    const maxLineVotes = $derived.by(() => {
        if (historyData.length === 0) return 1;
        let max = 0;
        historyData.forEach((d) => {
            d.optionsData.forEach((od: any) => {
                if (od.votes > max) max = od.votes;
            });
        });
        return max > 0 ? max : 1;
    });

    const maxBarVotes = $derived.by(() => {
        const mv = Math.max(...optionStats.map((o) => o.votes), 0);
        return mv > 0 ? mv : 1;
    });

    const timeLabels = $derived.by(() => {
        if (historyData.length === 0)
            return ["...", "...", "...", "...", "...", "..."];
        const step = Math.max(1, Math.floor(historyData.length / 5));
        return historyData
            .filter((_, i) => i % step === 0)
            .slice(0, 6)
            .map((d) => {
                const date = new Date(d.timestamp);
                if (timeFilter === "H") return `${date.getHours()}h`;
                if (timeFilter === "D" || timeFilter === "M")
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
            });
    });

    const optionLines = $derived.by(() => {
        if (!post || historyData.length === 0) return [];

        return post.options.map((opt) => {
            const points = historyData.map((d, i) => {
                const optData = d.optionsData.find(
                    (od: any) =>
                        od.optionKey === opt.title ||
                        od.optionId === opt.numericId,
                );
                const votes = optData ? optData.votes : 0;
                const x = (i / (historyData.length - 1)) * 170 + 15;
                const y = 80 - (votes / maxLineVotes) * 60;
                return { x, y, votes, timestamp: d.timestamp };
            });

            return {
                id: opt.id,
                title: opt.title,
                color: opt.colorFrom || "#6366f1",
                polyline: points.map((p) => `${p.x},${p.y}`).join(" "),
                points,
            };
        });
    });

    function handleTouchMove(e: TouchEvent) {
        if (chartView !== "lines" || historyData.length === 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const progress = Math.max(0, Math.min(1, (x - 20) / (rect.width - 40)));
        hoveredTimeIdx = Math.round(progress * (historyData.length - 1));
    }
</script>

{#if isOpen && post}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-[2000000] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4"
        transition:fade={{ duration: 300 }}
        onclick={(e) => e.target === e.currentTarget && onClose()}
        onkeydown={(e) => e.key === "Escape" && onClose()}
        tabindex="-1"
    >
        <!-- Modal Container -->
        <div
            class="w-full sm:max-w-xl max-h-[96vh] bg-zinc-950 rounded-t-[3rem] sm:rounded-[3.5rem] overflow-hidden border-t sm:border border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.9)] flex flex-col relative"
            transition:fly={{ y: 500, duration: 800, easing: quintOut }}
            onclick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabindex="0"
        >
            <!-- Premium Accents -->
            <div
                class="absolute -top-10 left-10 w-40 h-40 bg-indigo-500/10 blur-[100px] rounded-full"
            ></div>

            <!-- Handle -->
            <div
                class="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-white/20 rounded-full sm:hidden"
            ></div>

            <!-- Header -->
            <div class="px-8 pt-10 pb-4 flex items-center justify-between z-10">
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"
                    >
                        <Activity class="text-white/60" size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white tracking-tight">
                            Estadísticas
                        </h2>
                        <div class="flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500"
                            ></span>
                            <span
                                class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest"
                                >En tiempo real</span
                            >
                        </div>
                    </div>
                </div>
                <button
                    onclick={onClose}
                    class="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/5"
                    aria-label="Cerrar"
                >
                    <X size={20} />
                </button>
            </div>

            <!-- Scrollable Content -->
            <div
                class="flex-1 overflow-y-auto px-8 py-4 space-y-10 scrollbar-hide"
            >
                <!-- Hero Question -->
                <div class="space-y-6">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <div
                                class="w-1 h-3 bg-indigo-500 rounded-full"
                            ></div>
                            <span
                                class="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]"
                                >{post.category || "Tendencias"}</span
                            >
                        </div>
                        <h3
                            class="text-2xl font-semibold text-white leading-tight tracking-tight"
                        >
                            {post.question}
                        </h3>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div
                    class="grid grid-cols-4 bg-zinc-950/50 p-1.5 rounded-[2rem] border border-white/10 relative h-14 shadow-inner"
                >
                    <div
                        class="absolute inset-y-1.5 rounded-[1.8rem] bg-white transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-0 shadow-lg"
                        style="width: calc(25% - 6px); transform: translateX({chartView ===
                        'bars'
                            ? '0%'
                            : chartView === 'lines'
                              ? '100%'
                              : chartView === 'pie'
                                ? '200%'
                                : '300%'});"
                    ></div>
                    {#each [{ id: "bars", icon: BarChart3 }, { id: "lines", icon: TrendingUp }, { id: "pie", icon: PieChart }, { id: "world", icon: Globe }] as tab}
                        <button
                            onclick={() => (chartView = tab.id as any)}
                            class="flex items-center justify-center z-10 transition-all duration-500 {chartView ===
                            tab.id
                                ? 'text-black scale-110'
                                : 'text-zinc-600 hover:text-zinc-400'}"
                        >
                            <tab.icon size={20} strokeWidth={2.5} />
                        </button>
                    {/each}
                </div>

                <!-- Main Graphic Terminal -->
                {#if chartView !== "bars"}
                    <div
                        class="relative bg-zinc-950/40 rounded-[2.5rem] border border-white/5 p-8 min-h-[360px] flex flex-col items-center justify-center backdrop-blur-md"
                    >
                        {#if chartView === "lines"}
                            <div
                                class="w-full h-full flex flex-col pt-2 items-center"
                            >
                                <!-- Time Sliders -->
                                <div
                                    class="flex bg-black/40 p-1.5 rounded-full border border-white/10 mb-8 scale-90"
                                >
                                    {#each ["H", "D", "M", "Y"] as f}
                                        <button
                                            onclick={() =>
                                                (timeFilter = f as any)}
                                            class="px-5 py-2 text-[10px] font-black rounded-full transition-all {timeFilter ===
                                            f
                                                ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                                                : 'text-zinc-600 hover:text-white hover:bg-white/5'}"
                                        >
                                            {f}
                                        </button>
                                    {/each}
                                </div>

                                {#if isLoadingHistory}
                                    <div
                                        class="flex flex-col items-center gap-4 py-12"
                                    >
                                        <Loader2
                                            class="w-8 h-8 text-zinc-600 animate-spin"
                                        />
                                        <span
                                            class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
                                            >Cargando...</span
                                        >
                                    </div>
                                {:else if historyData.length > 0}
                                    <div
                                        class="w-full h-48 relative group"
                                        onmouseleave={() =>
                                            (hoveredTimeIdx = null)}
                                        ontouchmove={handleTouchMove}
                                        ontouchend={() =>
                                            (hoveredTimeIdx = null)}
                                    >
                                        <svg
                                            viewBox="0 0 200 100"
                                            class="w-full h-full overflow-visible"
                                            preserveAspectRatio="none"
                                        >
                                            <!-- Grid Lines -->
                                            {#each [0, 50, 100] as y}
                                                <line
                                                    x1="0"
                                                    y1={y}
                                                    x2="200"
                                                    y2={y}
                                                    stroke="rgba(255,255,255,0.05)"
                                                    stroke-width="0.3"
                                                />
                                            {/each}

                                            {#if hoveredTimeIdx !== null}
                                                {@const x =
                                                    (hoveredTimeIdx /
                                                        (historyData.length -
                                                            1)) *
                                                        170 +
                                                    15}
                                                <line
                                                    x1={x}
                                                    y1="0"
                                                    x2={x}
                                                    y2="100"
                                                    stroke="rgba(255,255,255,0.1)"
                                                    stroke-width="0.5"
                                                />
                                            {/if}

                                            {#each optionLines as line}
                                                <polyline
                                                    fill="none"
                                                    stroke={line.color}
                                                    stroke-width="1"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    points={line.polyline}
                                                    class="transition-opacity duration-300 {hoveredTimeIdx !==
                                                    null
                                                        ? 'opacity-30'
                                                        : 'opacity-80'}"
                                                />

                                                {#if hoveredTimeIdx !== null}
                                                    {@const p =
                                                        line.points[
                                                            hoveredTimeIdx
                                                        ]}
                                                    <circle
                                                        cx={p.x}
                                                        cy={p.y}
                                                        r="1.5"
                                                        fill={line.color}
                                                        stroke="white"
                                                        stroke-width="0.5"
                                                    />
                                                {/if}
                                            {/each}

                                            <!-- Invisible Hit Areas -->
                                            {#each Array(Math.min(historyData.length, 15)) as _, i}
                                                <rect
                                                    x={(i / 14) * 170 + 5}
                                                    y="0"
                                                    width="12"
                                                    height="100"
                                                    fill="transparent"
                                                    onmouseenter={() =>
                                                        (hoveredTimeIdx =
                                                            Math.floor(
                                                                (i *
                                                                    (historyData.length -
                                                                        1)) /
                                                                    14,
                                                            ))}
                                                />
                                            {/each}
                                        </svg>

                                        <!-- X Axis Labels -->
                                        <div
                                            class="flex justify-between px-2 mt-6"
                                        >
                                            {#each timeLabels as label}
                                                <span
                                                    class="text-[8px] font-bold text-zinc-600 uppercase tracking-widest"
                                                    >{label}</span
                                                >
                                            {/each}
                                        </div>

                                        <!-- Floating Tooltip Card -->
                                        {#if hoveredTimeIdx !== null}
                                            <div
                                                class="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl min-w-[140px] z-50 pointer-events-none"
                                                transition:fade={{
                                                    duration: 200,
                                                }}
                                            >
                                                <div
                                                    class="flex items-center gap-2 mb-2"
                                                >
                                                    <Clock
                                                        size={10}
                                                        class="text-zinc-400"
                                                    />
                                                    <span
                                                        class="text-[8px] font-bold text-zinc-400 uppercase tracking-widest"
                                                    >
                                                        {new Date(
                                                            historyData[
                                                                hoveredTimeIdx
                                                            ].timestamp,
                                                        ).toLocaleDateString(
                                                            undefined,
                                                            {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                day: "numeric",
                                                                month: "short",
                                                            },
                                                        )}
                                                    </span>
                                                </div>
                                                <div class="space-y-1">
                                                    {#each [...historyData[hoveredTimeIdx].optionsData]
                                                        .sort((a: any, b: any) => b.votes - a.votes)
                                                        .slice(0, 3) as od}
                                                        <div
                                                            class="flex items-center justify-between gap-4"
                                                        >
                                                            <div
                                                                class="flex items-center gap-1.5 overflow-hidden"
                                                            >
                                                                <div
                                                                    class="w-1 h-1 rounded-full"
                                                                    style="background-color: {od.color ||
                                                                        '#6366f1'}"
                                                                ></div>
                                                                <span
                                                                    class="text-[9px] font-bold truncate text-zinc-900"
                                                                    >{od.optionLabel ||
                                                                        od.optionKey}</span
                                                                >
                                                            </div>
                                                            <span
                                                                class="text-[9px] font-bold text-zinc-900 tabular-nums"
                                                                >{od.votes} v</span
                                                            >
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <div
                                        class="flex flex-col items-center gap-4 py-12 opacity-30"
                                    >
                                        <Calendar
                                            size={48}
                                            strokeWidth={1}
                                            class="text-zinc-600"
                                        />
                                        <span
                                            class="text-[10px] font-black text-zinc-500 uppercase tracking-widest"
                                            >No hay datos históricos</span
                                        >
                                    </div>
                                {/if}
                            </div>
                        {:else if chartView === "pie"}
                            <div class="w-full flex flex-col items-center">
                                <!-- Sub-View Selector -->
                                <div
                                    class="flex bg-black/40 p-1 rounded-full border border-white/10 mb-6 relative"
                                >
                                    <div
                                        class="absolute inset-y-1 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300"
                                        style="left: {pieSubView === 'donut'
                                            ? '4px'
                                            : pieSubView === 'radar'
                                              ? 'calc(33.33% + 2px)'
                                              : 'calc(66.66% + 0px)'}; width: calc(33.33% - 4px);"
                                    ></div>
                                    {#each [{ id: "donut", label: "Donut" }, { id: "radar", label: "Radar" }, { id: "polar", label: "Polar" }] as view}
                                        <button
                                            onclick={() =>
                                                (pieSubView = view.id as any)}
                                            class="relative z-10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 w-20 text-center {pieSubView ===
                                            view.id
                                                ? 'text-white'
                                                : 'text-zinc-500 hover:text-zinc-300'}"
                                        >
                                            {view.label}
                                        </button>
                                    {/each}
                                </div>

                                <div
                                    class="relative w-64 h-64 flex items-center justify-center"
                                >
                                    {#if pieSubView === "donut"}
                                        <!-- Existing Donut Logic -->
                                        <svg
                                            viewBox="0 0 100 100"
                                            class="w-full h-full -rotate-90"
                                        >
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="44"
                                                fill="transparent"
                                                stroke="rgba(255,255,255,0.05)"
                                                stroke-width="8"
                                            />
                                            {#each optionStats as opt, idx}
                                                {@const color =
                                                    opt.colorFrom || "#6366f1"}
                                                {@const prevP = optionStats
                                                    .slice(0, idx)
                                                    .reduce(
                                                        (s, o) =>
                                                            s + o.percentage,
                                                        0,
                                                    )}
                                                {@const circumference =
                                                    2 * Math.PI * 40}
                                                {@const dashLength =
                                                    (opt.percentage / 100) *
                                                    circumference}
                                                {@const dashOffset =
                                                    (prevP / 100) *
                                                    circumference}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="40"
                                                    fill="transparent"
                                                    stroke={color}
                                                    stroke-width={activePieIdx ===
                                                    idx
                                                        ? 10
                                                        : 8}
                                                    stroke-dasharray="{dashLength} {circumference}"
                                                    stroke-dashoffset="-{dashOffset *
                                                        1.01}"
                                                    class="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer opacity-70 hover:opacity-100"
                                                    onmouseenter={() =>
                                                        (activePieIdx = idx)}
                                                    onmouseleave={() =>
                                                        (activePieIdx = null)}
                                                />
                                            {/each}
                                        </svg>
                                        <div
                                            class="absolute flex flex-col items-center justify-center text-center pointer-events-none"
                                        >
                                            {#if activePieIdx !== null}
                                                <div
                                                    transition:scale={{
                                                        duration: 200,
                                                    }}
                                                    class="flex flex-col items-center"
                                                >
                                                    <span
                                                        class="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].title.slice(0, 12)}
                                                    </span>
                                                    <span
                                                        class="text-3xl font-bold text-white tracking-tighter tabular-nums leading-none"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].percentage}%
                                                    </span>
                                                </div>
                                            {:else}
                                                <span
                                                    class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1"
                                                    >Total</span
                                                >
                                                <span
                                                    class="text-4xl font-bold text-white tracking-tighter leading-none tabular-nums"
                                                >
                                                    {post.totalVotes}
                                                </span>
                                            {/if}
                                        </div>
                                    {:else if pieSubView === "radar"}
                                        <!-- Radar Chart -->
                                        {@const numVars =
                                            optionStats.length || 3}
                                        {@const angleStep =
                                            (Math.PI * 2) / numVars}
                                        {@const maxVal = Math.max(
                                            ...optionStats.map((o) => o.votes),
                                            1,
                                        )}
                                        {@const points = optionStats.map(
                                            (opt, i) => {
                                                const angle =
                                                    i * angleStep - Math.PI / 2;
                                                const val =
                                                    (opt.votes / maxVal) * 40; // max radius 40
                                                return {
                                                    x:
                                                        50 +
                                                        Math.cos(angle) * val,
                                                    y:
                                                        50 +
                                                        Math.sin(angle) * val,
                                                    title: opt.title,
                                                    votes: opt.votes,
                                                };
                                            },
                                        )}
                                        {@const polyPoints = points
                                            .map((p) => `${p.x},${p.y}`)
                                            .join(" ")}

                                        <svg
                                            viewBox="0 0 100 100"
                                            class="w-full h-full"
                                        >
                                            <!-- Web/Grid -->
                                            {#each [10, 20, 30, 40] as r}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    {r}
                                                    fill="none"
                                                    stroke="rgba(255,255,255,0.05)"
                                                    stroke-width="0.5"
                                                />
                                            {/each}
                                            {#each optionStats as _, i}
                                                {@const angle =
                                                    i * angleStep - Math.PI / 2}
                                                <line
                                                    x1="50"
                                                    y1="50"
                                                    x2={50 +
                                                        Math.cos(angle) * 40}
                                                    y2={50 +
                                                        Math.sin(angle) * 40}
                                                    stroke="rgba(255,255,255,0.05)"
                                                    stroke-width="0.5"
                                                />
                                            {/each}

                                            <!-- Data Polygon -->
                                            <polygon
                                                points={polyPoints}
                                                fill="rgba(99, 102, 241, 0.2)"
                                                stroke="#6366f1"
                                                stroke-width="1.5"
                                                class="transition-all duration-500"
                                            />

                                            <!-- Dots -->
                                            {#each points as p, i}
                                                <circle
                                                    cx={p.x}
                                                    cy={p.y}
                                                    r={activePieIdx === i
                                                        ? 3
                                                        : 1.5}
                                                    fill={optionStats[i]
                                                        .colorFrom || "#6366f1"}
                                                    stroke="white"
                                                    stroke-width="0.5"
                                                    class="cursor-pointer transition-all duration-300"
                                                    onmouseenter={() =>
                                                        (activePieIdx = i)}
                                                    onmouseleave={() =>
                                                        (activePieIdx = null)}
                                                />
                                            {/each}
                                        </svg>

                                        <!-- Radar Tooltip (Center) -->
                                        <div
                                            class="absolute inset-0 flex items-center justify-center pointer-events-none"
                                        >
                                            {#if activePieIdx !== null}
                                                <div
                                                    transition:scale={{
                                                        duration: 200,
                                                    }}
                                                    class="bg-black/80 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-center"
                                                >
                                                    <div
                                                        class="text-[8px] font-bold text-zinc-400 uppercase tracking-widest"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].title}
                                                    </div>
                                                    <div
                                                        class="text-sm font-bold text-white tabular-nums"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].votes} votos
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                    {:else if pieSubView === "polar"}
                                        <!-- Polar Area Chart -->
                                        {@const numSlices =
                                            optionStats.length || 1}
                                        {@const sliceAngle = 360 / numSlices}
                                        {@const maxPVal = Math.max(
                                            ...optionStats.map((o) => o.votes),
                                            1,
                                        )}

                                        <svg
                                            viewBox="0 0 100 100"
                                            class="w-full h-full -rotate-90"
                                        >
                                            <!-- Grid Circles -->
                                            {#each [10, 20, 30, 40] as r}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    {r}
                                                    fill="none"
                                                    stroke="rgba(255,255,255,0.03)"
                                                    stroke-width="0.5"
                                                />
                                            {/each}

                                            {#each optionStats as opt, i}
                                                {@const startA = i * sliceAngle}
                                                {@const endA =
                                                    (i + 1) * sliceAngle}
                                                {@const radius =
                                                    (opt.votes / maxPVal) * 45}
                                                <!-- max radius 45 -->

                                                <!-- Helper to create arc path -->
                                                {@const x1 =
                                                    50 +
                                                    radius *
                                                        Math.cos(
                                                            (Math.PI * startA) /
                                                                180,
                                                        )}
                                                {@const y1 =
                                                    50 +
                                                    radius *
                                                        Math.sin(
                                                            (Math.PI * startA) /
                                                                180,
                                                        )}
                                                {@const x2 =
                                                    50 +
                                                    radius *
                                                        Math.cos(
                                                            (Math.PI * endA) /
                                                                180,
                                                        )}
                                                {@const y2 =
                                                    50 +
                                                    radius *
                                                        Math.sin(
                                                            (Math.PI * endA) /
                                                                180,
                                                        )}

                                                <path
                                                    d="M 50 50 L {x1} {y1} A {radius} {radius} 0 0 1 {x2} {y2} Z"
                                                    fill={opt.colorFrom ||
                                                        "#6366f1"}
                                                    stroke="rgba(255,255,255,0.1)"
                                                    stroke-width="0.5"
                                                    class="transition-all duration-500 cursor-pointer opacity-70 hover:opacity-90"
                                                    onmouseenter={() =>
                                                        (activePieIdx = i)}
                                                    onmouseleave={() =>
                                                        (activePieIdx = null)}
                                                />
                                            {/each}
                                        </svg>

                                        <!-- Polar Tooltip (Center) -->
                                        <div
                                            class="absolute inset-0 flex items-center justify-center pointer-events-none"
                                        >
                                            {#if activePieIdx !== null}
                                                <div
                                                    transition:scale={{
                                                        duration: 200,
                                                    }}
                                                    class="bg-black/80 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-center z-10"
                                                >
                                                    <div
                                                        class="text-[8px] font-bold text-zinc-400 uppercase tracking-widest"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].title}
                                                    </div>
                                                    <div
                                                        class="text-sm font-bold text-white tabular-nums"
                                                    >
                                                        {optionStats[
                                                            activePieIdx
                                                        ].votes} votos
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {:else if chartView === "world"}
                            <div
                                class="absolute inset-0 rounded-[2.5rem] overflow-hidden"
                            >
                                <GlobeGL embedMode={true} initialPoll={post} />
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Footer List: Better Leaderboard -->
                <div class="space-y-6 pt-4">
                    <div class="flex items-center justify-between px-2">
                        <h4
                            class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
                        >
                            Desglose de Participación
                        </h4>
                        <div class="flex -space-x-1.5">
                            {#each friendsVotes["all"]?.slice(0, 5) || [] as f}
                                <img
                                    src={f.avatarUrl}
                                    alt=""
                                    class="w-5 h-5 rounded-full border-2 border-black"
                                />
                            {/each}
                        </div>
                    </div>

                    <div class="space-y-3">
                        {#each optionStats as opt, idx}
                            <div
                                class="group relative bg-zinc-900/40 border border-white/5 rounded-[2rem] p-5 hover:bg-zinc-900/60 transition-all duration-300 overflow-hidden"
                            >
                                <!-- Progress Bar at Bottom 0 -->
                                <div
                                    class="absolute bottom-0 left-0 right-0 h-1 bg-white/5"
                                >
                                    <div
                                        class="h-full transition-all duration-1000 ease-out"
                                        style="width: {opt.percentage}%; background-color: {opt.colorFrom ||
                                            '#6366f1'}; opacity: 0.6;"
                                    ></div>
                                </div>
                                <div
                                    class="relative flex items-center justify-between"
                                >
                                    <div class="flex items-center gap-4">
                                        <div class="relative">
                                            <div
                                                class="w-12 h-12 rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg"
                                            >
                                                {#if opt.image}
                                                    <img
                                                        src={opt.image}
                                                        alt=""
                                                        class="w-full h-full object-cover"
                                                    />
                                                {:else}
                                                    <div
                                                        class="w-full h-full bg-zinc-800 flex items-center justify-center"
                                                    >
                                                        <Award
                                                            class="text-white/10"
                                                            size={16}
                                                        />
                                                    </div>
                                                {/if}
                                            </div>
                                            {#if idx === 0 && !isTie && post.totalVotes > 0}
                                                <div
                                                    class="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-black z-10 shadow-lg"
                                                ></div>
                                            {/if}
                                        </div>
                                        <div class="space-y-1">
                                            <h5
                                                class="text-sm font-bold text-white tracking-tight leading-none"
                                            >
                                                {opt.title}
                                            </h5>
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                {#if opt.votedFriends.length > 0}
                                                    <div
                                                        class="flex -space-x-1.5"
                                                    >
                                                        {#each opt.votedFriends.slice(0, 3) as f}
                                                            <img
                                                                src={f.avatarUrl ||
                                                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}`}
                                                                alt=""
                                                                class="w-4 h-4 rounded-full border border-black"
                                                            />
                                                        {/each}
                                                    </div>
                                                    <span
                                                        class="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none"
                                                    >
                                                        {opt.votedFriends
                                                            .length} Amigos
                                                    </span>
                                                {:else}
                                                    <span
                                                        class="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none opacity-40"
                                                    >
                                                        Votos remotos
                                                    </span>
                                                {/if}
                                                {#if opt.isVoted}
                                                    <span
                                                        class="h-1 w-1 rounded-full bg-zinc-700"
                                                    ></span>
                                                    <span
                                                        class="text-[8px] font-bold text-indigo-400 uppercase tracking-widest"
                                                        >Tu Elección</span
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <p
                                            class="text-xl font-bold text-white tabular-nums tracking-tighter leading-none mb-1"
                                        >
                                            {opt.percentage}%
                                        </p>
                                        <p
                                            class="text-[9px] font-bold text-zinc-500 uppercase tabular-nums"
                                        >
                                            {opt.votes.toLocaleString()} Votos
                                        </p>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
