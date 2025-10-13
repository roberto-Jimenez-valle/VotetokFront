export interface GlobeMaterial {
  color: { set: (c: string) => void };
  transparent: boolean;
  opacity: number;
}

export interface GlobeAPI {
  setTilesEnabled?: (enabled: boolean) => void;
  // setter
  pointOfView: (pov: { lat: number; lng: number; altitude: number }, ms?: number) => void;
  // getter
  pointOfView(): { lat: number; lng: number; altitude: number } | undefined;
  setPolygonsData: (data: any[]) => void;
  polygonCapColor: (fn: (feat: any) => string) => void;
  polygonStrokeColor: (fn: () => string) => void;
  polygonSideColor: (fn: () => string) => void;
  refreshPolyColors?: () => void;
  backgroundColor: (c: string) => void;
  globeMaterial: () => GlobeMaterial;
  htmlElementsData?: (data: any[]) => void;
}

export type PollType = 'single' | 'multiple' | 'rating' | 'reactions' | 'collaborative' | 'poll' | 'hashtag' | 'trending';

export interface Poll {
  id: string;
  question: string;
  type: PollType;
  region: string;
  options: Array<{ key: string; label: string; color: string; votes: number; avatarUrl?: string; id?: number; optionKey?: string; optionLabel?: string }>;
  totalVotes: number;
  totalViews: number;
  creator?: { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean };
  publishedAt?: string | Date;
  createdAt?: string | Date;
  closedAt?: string | Date | null;
  status?: 'active' | 'closed' | 'draft';
  friendsByOption?: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>>;
  settings?: {
    ratingIcon?: string;
    ratingCount?: number;
    collaborativePermission?: 'anyone' | 'friends' | 'specific';
    specificFriend?: string;
  };
}
