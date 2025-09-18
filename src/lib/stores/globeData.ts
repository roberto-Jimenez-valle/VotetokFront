import { readable, writable, get } from 'svelte/store';

// Tipos mínimos para mantener flexibilidad
export type WorldMap = any;      // TopoJSON/GeoJSON
export type WorldData = any;     // { ANSWERS: Record<string,Record<string,number>>, colors: Record<string,string> }
export type VotesData = any;     // { votes: Array<{ lat:number, lng:number, ... }> }
export type World3Data = any;    // Variante WORLD3.json
export type ClustersData = any;  // { ... }

const worldMapStore = writable<WorldMap | null>(null);
const worldDataStore = writable<WorldData | null>(null);
const votesStore = writable<VotesData | null>(null);
const loadingStore = writable<boolean>(false);
const errorStore = writable<string | null>(null);
const world3Store = writable<World3Data | null>(null);
const clustersStore = writable<ClustersData | null>(null);
const currentClustersIdStore = writable<string | null>(null);

let inFlight: Promise<void> | null = null;

export async function loadGlobeData(force = false): Promise<void> {
  if (!force && (get(worldMapStore) && get(worldDataStore))) return; // ya cargado
  if (!force && inFlight) return inFlight; // ya en progreso
  inFlight = (async () => {
    loadingStore.set(true);
    errorStore.set(null);
    try {
      const [resGeo, resData, resVotes] = await Promise.all([
        fetch('/api/maps/world'),
        fetch('/api/data/world'),
        fetch('/api/data/votes').catch(() => null as any)
      ]);

      if (!resGeo?.ok) throw new Error('No se pudo cargar el mapa');
      if (!resData?.ok) throw new Error('No se pudo cargar los datos del mundo');

      const [geo, dataJson] = await Promise.all([resGeo.json(), resData.json()]);
      worldMapStore.set(geo);
      worldDataStore.set(dataJson);

      if (resVotes && resVotes.ok) {
        try {
          const vjson = await resVotes.json();
          votesStore.set(vjson);
        } catch {
          votesStore.set({ votes: [] });
        }
      } else {
        votesStore.set({ votes: [] });
      }
    } catch (e: any) {
      errorStore.set(e?.message || 'Error cargando datos del globo');
      throw e;
    } finally {
      loadingStore.set(false);
      inFlight = null;
    }
  })();
  return inFlight;
}

export const worldMap$ = readable<WorldMap | null>(null, (set) => {
  const unsub = worldMapStore.subscribe(set);
  return () => unsub();
});
export const worldData$ = readable<WorldData | null>(null, (set) => {
  const unsub = worldDataStore.subscribe(set);
  return () => unsub();
});
export const votes$ = readable<VotesData | null>(null, (set) => {
  const unsub = votesStore.subscribe(set);
  return () => unsub();
});
export const globeLoading$ = readable<boolean>(false, (set) => {
  const unsub = loadingStore.subscribe(set);
  return () => unsub();
});
export const globeError$ = readable<string | null>(null, (set) => {
  const unsub = errorStore.subscribe(set);
  return () => unsub();
});

// WORLD3 helpers
let inFlightWorld3: Promise<void> | null = null;
export async function loadWorld3(force = false): Promise<void> {
  if (!force && get(world3Store)) return;
  if (!force && inFlightWorld3) return inFlightWorld3;
  inFlightWorld3 = (async () => {
    try {
      const res = await fetch('/api/data/world3');
      if (!res.ok) throw new Error('No se pudo cargar WORLD3');
      const data = await res.json();
      world3Store.set(data);
    } catch (e) {
      // Mantener silencioso para datasets opcionales
      world3Store.set(null);
    } finally {
      inFlightWorld3 = null;
    }
  })();
  return inFlightWorld3;
}
export const world3$ = readable<World3Data | null>(null, (set) => {
  const unsub = world3Store.subscribe(set);
  return () => unsub();
});

// Clusters helpers con caché por id
const clustersCache = new Map<string, ClustersData>();
const clustersInFlight = new Map<string, Promise<void>>();
export async function loadClusters(id: string | number, force = false): Promise<ClustersData | null> {
  const key = String(id);
  if (!force && clustersCache.has(key)) {
    const data = clustersCache.get(key)!;
    clustersStore.set(data);
    currentClustersIdStore.set(key);
    return data;
  }
  if (!force && clustersInFlight.has(key)) {
    await clustersInFlight.get(key);
    return clustersCache.get(key) ?? null;
  }
  const p = (async () => {
    try {
      const res = await fetch(`/api/data/clusters/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('No se pudo cargar clusters');
      const data = await res.json();
      clustersCache.set(key, data);
      clustersStore.set(data);
      currentClustersIdStore.set(key);
    } catch (e) {
      clustersStore.set(null);
    } finally {
      clustersInFlight.delete(key);
    }
  })();
  clustersInFlight.set(key, p);
  await p;
  return clustersCache.get(key) ?? null;
}
export const clusters$ = readable<ClustersData | null>(null, (set) => {
  const unsub = clustersStore.subscribe(set);
  return () => unsub();
});
export const currentClustersId$ = readable<string | null>(null, (set) => {
  const unsub = currentClustersIdStore.subscribe(set);
  return () => unsub();
});
