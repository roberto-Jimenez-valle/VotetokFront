// Types for the Voting Feed system

export type PostType = 'standard' | 'quiz' | 'tierlist' | 'swipe' | 'collab';

export interface Friend {
  id: string;
  avatar: string;
}

export interface VoteOption {
  id: string;
  title: string;
  votes: number;
  friends: Friend[];
  type: 'text' | 'image';
  image?: string;
  colorFrom: string;
  colorTo: string;
  bgBar: string;
}

export interface Post {
  id: string;
  type: PostType;
  author: string;
  avatar: string;
  time: string;
  question: string;
  totalVotes: number;
  comments: number;
  reposts: number;
  likes: number;
  options: VoteOption[];
  correctOptionId?: string; // For quiz type
}

export interface UserVotes {
  [postId: string]: string | string[];
}

export interface RankingDrafts {
  [postId: string]: string[];
}

export interface SwipeIndices {
  [postId: string]: number;
}

export type ViewMode = 'feed' | 'reels';

export interface PostConfig {
  icon: string;
  label: string;
  color: string;
  badge: string;
}

export const POST_CONFIGS: Record<PostType, PostConfig> = {
  standard: {
    icon: 'BarChart2',
    label: 'Votar',
    color: 'text-[#9ec264]',
    badge: 'bg-[#9ec264] text-black shadow-lg shadow-[#9ec264]/20'
  },
  quiz: {
    icon: 'Trophy',
    label: 'Trivial',
    color: 'text-yellow-400',
    badge: 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
  },
  tierlist: {
    icon: 'ListOrdered',
    label: 'Ranking',
    color: 'text-indigo-400',
    badge: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
  },
  swipe: {
    icon: 'ArrowLeftRight',
    label: 'Swipe',
    color: 'text-red-400',
    badge: 'bg-red-600 text-white shadow-lg shadow-red-600/20'
  },
  collab: {
    icon: 'Users',
    label: 'Abierta',
    color: 'text-emerald-400',
    badge: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
  }
};
