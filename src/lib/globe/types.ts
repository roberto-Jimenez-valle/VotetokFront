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
