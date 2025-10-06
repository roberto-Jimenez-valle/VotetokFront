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

export interface Poll {
  id: string;
  question: string;
  type: 'poll' | 'hashtag' | 'trending';
  region: string;
  options: Array<{ key: string; label: string; color: string; votes: number; avatarUrl?: string }>;
  totalVotes: number;
  totalViews: number;
  creator?: { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean };
  publishedAt?: string | Date;
  friendsByOption?: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>>;
}
