
import type { Post, PostType } from './types';

// Color palette for options
export const OPTION_COLORS = [
    { from: "from-red-600", to: "to-red-900", bar: "bg-red-500", hex: "#ef4444" },
    { from: "from-blue-600", to: "to-blue-900", bar: "bg-blue-500", hex: "#3b82f6" },
    { from: "from-emerald-600", to: "to-emerald-900", bar: "bg-emerald-500", hex: "#10b981" },
    { from: "from-amber-600", to: "to-amber-900", bar: "bg-amber-500", hex: "#f59e0b" },
    { from: "from-purple-600", to: "to-purple-900", bar: "bg-purple-500", hex: "#a855f7" },
    { from: "from-pink-600", to: "to-pink-900", bar: "bg-pink-500", hex: "#ec4899" },
];

export function getTimeAgo(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
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

export interface TransformContext {
    currentUser?: any;
    isProfileContext?: boolean;
    profileUser?: any; // The user whose profile is being viewed (userData)
    parentIsFollowing?: boolean;
    parentIsPending?: boolean;
    activeTab?: string;
}

// Map API poll type to frontend PostType
export function mapPollType(apiType: string): PostType {
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

export function transformApiPollToPost(apiPoll: any, context: TransformContext = {}): Post {
    const {
        currentUser,
        isProfileContext,
        profileUser,
        parentIsFollowing = false,
        parentIsPending = false,
        activeTab
    } = context;

    const totalVotes =
        apiPoll.stats?.totalVotes ||
        apiPoll.options?.reduce(
            (sum: number, opt: any) =>
                sum + (opt.votes || opt.voteCount || opt._count?.votes || 0),
            0,
        ) ||
        0;

    // Check for correctOptionId logic (Quiz)
    let correctOptionId: string | undefined;
    const pollType = mapPollType(apiPoll.type);

    if (pollType === "quiz") {
        if (apiPoll.correctOptionHashId) {
            correctOptionId = apiPoll.correctOptionHashId;
        } else if (apiPoll.correctOptionId) {
            const correctOpt = apiPoll.options?.find(
                (o: any) => o.id === apiPoll.correctOptionId,
            );
            correctOptionId = correctOpt?.hashId || String(apiPoll.correctOptionId);
        }
    }

    // Identify if the poll author IS the profile user (if we are in profile context)
    // The API should now correctly return isFollowing status.
    // We use parentIsFollowing only as a fallback when API doesn't return the value.

    let resolvedIsFollowing = apiPoll.isFollowing ?? false;
    let resolvedIsPending = apiPoll.isPending ?? false;

    // Only use parent values as fallback when API doesn't have them
    if (isProfileContext && profileUser) {
        const isAuthorProfileUser = (apiPoll.userId === profileUser.id || apiPoll.user?.id === profileUser.id);
        if (isAuthorProfileUser) {
            // If API returned undefined, use parent values; otherwise trust the API
            if (apiPoll.isFollowing === undefined) {
                resolvedIsFollowing = parentIsFollowing;
            }
            if (apiPoll.isPending === undefined) {
                resolvedIsPending = parentIsPending;
            }
        }
    }

    // Bookmark fallback logic
    // If activeTab is 'saved', assume bookmarked. Even if API says otherwise (due to query context or missing include)
    const resolvedIsBookmarked = apiPoll.isBookmarked ?? (activeTab === "saved");

    const authorUser = apiPoll.user || (isProfileContext && profileUser && (apiPoll.userId === profileUser.id) ? profileUser : undefined);

    return {
        id: apiPoll.hashId || String(apiPoll.id),
        numericId: apiPoll.id,
        type: pollType || "standard",
        author:
            authorUser?.displayName ||
            authorUser?.username ||
            "Usuario",
        avatar:
            authorUser?.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiPoll.userId}`,
        time: getTimeAgo(apiPoll.createdAt || new Date().toISOString()),
        question: apiPoll.title || "Sin título",
        totalVotes,
        comments: apiPoll.stats?.comments || apiPoll._count?.comments || 0,
        reposts: apiPoll.stats?.interactions || apiPoll._count?.interactions || 0,
        likes: apiPoll._count?.interactions || 0,
        userId: apiPoll.user?.id || apiPoll.userId,
        user: authorUser,
        collabMode: apiPoll.collabMode,
        collaborators: apiPoll.collaborators,
        isFollowing: resolvedIsFollowing,
        isPending: resolvedIsPending,
        isBookmarked: resolvedIsBookmarked,
        isReposted: apiPoll.isReposted,
        hasCommented: apiPoll.hasCommented,
        endsAt: apiPoll.closedAt,
        correctOptionId: correctOptionId || apiPoll.correctOptionHashId,
        options: (apiPoll.options || []).map((opt: any, idx: number) => {
            const colors = OPTION_COLORS[idx % OPTION_COLORS.length];
            const optionImage = opt.imageUrl || opt.image_url || opt.thumbnailUrl;

            let colorFrom = colors.from;
            let colorTo = colors.to;
            let bgBar = colors.bar;
            let colorHex = colors.hex;

            if (opt.color) {
                colorFrom = opt.color;
                colorTo = opt.color;
                bgBar = `bg-[${opt.color}]`;
                colorHex = opt.color;
            }

            return {
                id: opt.hashId || String(opt.id),
                numericId: opt.id,
                title:
                    opt.label ||
                    opt.optionLabel ||
                    opt.text ||
                    opt.optionText ||
                    `Opción ${idx + 1}`,
                votes: opt.votes || opt.voteCount || opt._count?.votes || 0,
                friends: (opt.friendVoters || []).map((v: any) => ({
                    id: String(v.id),
                    avatar: v.avatarUrl || "",
                })),
                type: optionImage ? ("image" as const) : ("text" as const),
                image: optionImage,
                colorFrom,
                colorTo,
                bgBar,
                color: colorHex,
            };
        }),
    };
}
