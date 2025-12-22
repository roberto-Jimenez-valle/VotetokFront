// Helper functions for the Voting Feed system

import type { Friend, VoteOption } from './types';

const COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 
  'fuchsia', 'pink', 'rose'
];

export function generateFriends(seed: string, count: number): Friend[] {
  return Array.from({ length: count }, (_, j) => ({
    id: `friend-${seed}-${j}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}-${j}`
  }));
}

export function generateOptions(
  count: number, 
  prefix: string, 
  titleBase: string, 
  type: 'text' | 'image' = 'text'
): VoteOption[] {
  return Array.from({ length: count }, (_, i) => {
    const color = COLORS[i % COLORS.length];
    return {
      id: `${prefix}-${i}`,
      title: `${titleBase} #${i + 1}`,
      votes: Math.floor(Math.random() * 500),
      friends: Math.random() > 0.8 ? generateFriends(`${prefix}-f${i}`, 1) : [],
      type,
      image: type === 'image' ? `https://picsum.photos/seed/${prefix}-${i}/400/600` : undefined,
      colorFrom: `from-${color}-600`,
      colorTo: 'to-slate-900',
      bgBar: `bg-${color}-500`
    };
  });
}

export function calculatePercent(votes: number, totalVotes: number): number {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}
