import { writable } from 'svelte/store';

// Tipo para los datos del globo
export interface GlobeData {
  currentLevel: string;
  currentAdm0: string;
  worldData: any;
  colors: any;
  selectedVotes?: number | null;
}

// Estado inicial
const initialState: GlobeData = {
  currentLevel: 'world',
  currentAdm0: 'WORLD',
  worldData: null,
  colors: null
};

// Crear un store para la instancia del globo
function createGlobeStore() {
  const { subscribe, set, update } = writable<GlobeData>(initialState);

  return {
    subscribe,
    
    // Actualizar todos los datos del globo
    setData: (data: Partial<GlobeData>) => update(state => ({ ...state, ...data })),
    
    // Actualizar solo el nivel actual
    setLevel: (level: string) => update(state => ({ ...state, currentLevel: level })),
    
    // Actualizar solo el país actual
    setAdm0: (adm0: string) => update(state => ({ ...state, currentAdm0: adm0 })),
    
    // Actualizar los datos del mundo
    setWorldData: (data: any) => update(state => ({ ...state, worldData: data })),
    
    // Actualizar los colores
    setColors: (colors: any) => update(state => ({ ...state, colors: colors })),
    
    // Resetear al estado inicial
    reset: () => set(initialState)
  };
}

// Exportar la instancia del store
export const globeStore = createGlobeStore();
