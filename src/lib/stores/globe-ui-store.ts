import { writable } from 'svelte/store';

export interface GlobeUiState {
  visible: boolean;
  height: string;
  width: string;
  bottom: number;
  zIndex: number;
  top: number;
  left: number;
  position?: 'absolute' | 'fixed' | 'relative';
  // Puedes agregar más propiedades según lo necesites
}

export const globeUiStore = writable<GlobeUiState>({
  visible: true, // por defecto visible en el feed
  height: '250px',
  width: '250px',
  bottom: 0,
  zIndex: 10,
  position: 'relative',
  top: undefined,
  left: undefined,
});
