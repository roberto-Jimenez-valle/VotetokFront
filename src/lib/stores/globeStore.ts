import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// ===============================================
// TIPOS E INTERFACES
// ===============================================

export interface GlobeState {
  level: 'world' | 'country' | 'subdivision' | 'city';
  altitude: number;
  center: [number, number];
  selectedCountry: {
    iso: string;
    name: string;
  } | null;
  selectedSubdivision: {
    id: string;
    name: string;
  } | null;
  isNavigating: boolean;
  isMapMoving: boolean;
}

export interface ColorMapState {
  colorMap: Record<string, string>;
  isoDominantKey: Record<string, string>;
  atmosphereColor: string;
  isDarkTheme: boolean;
  fadeOpacity: number;
}

export interface LabelsState {
  showLabels: boolean;
  labelType: 'country' | 'subdivision' | 'detailed' | null;
  activeLabels: Array<{
    id: string;
    text: string;
    position: [number, number];
    size?: number;
    color?: string;
  }>;
}

export interface NavigationHistory {
  level: string;
  name: string;
  id?: string;
  timestamp: number;
}

// ===============================================
// STORES PRINCIPALES
// ===============================================

/**
 * Estado principal del globo 3D
 */
export const globeState: Writable<GlobeState> = writable({
  level: 'world',
  altitude: 2.5,
  center: [0, 0],
  selectedCountry: null,
  selectedSubdivision: null,
  isNavigating: false,
  isMapMoving: false
});

/**
 * Estado de colores y visualización
 */
export const colorState: Writable<ColorMapState> = writable({
  colorMap: {},
  isoDominantKey: {},
  atmosphereColor: '#4a90e2',
  isDarkTheme: true,
  fadeOpacity: 1.0
});

/**
 * Estado de etiquetas
 */
export const labelsState: Writable<LabelsState> = writable({
  showLabels: true,
  labelType: null,
  activeLabels: []
});

/**
 * Historial de navegación
 */
export const navigationHistory: Writable<NavigationHistory[]> = writable([
  { level: 'world', name: 'Mundo', timestamp: Date.now() }
]);

// ===============================================
// STORES DERIVADOS
// ===============================================

/**
 * Indica si estamos en nivel detallado (zoom cercano)
 */
export const isDetailedView: Readable<boolean> = derived(
  globeState,
  $globe => $globe.altitude < 0.5
);

/**
 * Breadcrumb de navegación actual
 */
export const navigationBreadcrumb: Readable<string> = derived(
  navigationHistory,
  $history => $history.map(h => h.name).join(' > ')
);

/**
 * Indica si hay datos de votación cargados
 */
export const hasVoteData: Readable<boolean> = derived(
  colorState,
  $color => Object.keys($color.colorMap).length > 0
);

// ===============================================
// ACCIONES Y HELPERS
// ===============================================

/**
 * Navegar a vista mundial
 */
export function navigateToWorld() {
  globeState.update(state => ({
    ...state,
    level: 'world',
    altitude: 2.5,
    center: [0, 0],
    selectedCountry: null,
    selectedSubdivision: null,
    isNavigating: true
  }));
  
  navigationHistory.set([
    { level: 'world', name: 'Mundo', timestamp: Date.now() }
  ]);
  
  // Reset navegación después de la animación
  setTimeout(() => {
    globeState.update(s => ({ ...s, isNavigating: false }));
  }, 1000);
}

/**
 * Navegar a un país específico
 */
export function navigateToCountry(iso: string, name: string, altitude = 0.8) {
  globeState.update(state => ({
    ...state,
    level: 'country',
    altitude,
    selectedCountry: { iso, name },
    selectedSubdivision: null,
    isNavigating: true
  }));
  
  navigationHistory.update(history => [
    ...history.slice(0, 1), // Mantener "Mundo"
    { level: 'country', name, id: iso, timestamp: Date.now() }
  ]);
  
  setTimeout(() => {
    globeState.update(s => ({ ...s, isNavigating: false }));
  }, 1000);
}

/**
 * Navegar a una subdivisión
 */
export function navigateToSubdivision(
  countryIso: string, 
  countryName: string,
  subdivisionId: string, 
  subdivisionName: string,
  altitude = 0.4
) {
  globeState.update(state => ({
    ...state,
    level: 'subdivision',
    altitude,
    selectedCountry: { iso: countryIso, name: countryName },
    selectedSubdivision: { id: subdivisionId, name: subdivisionName },
    isNavigating: true
  }));
  
  const currentHistory = get(navigationHistory);
  const newHistory = [...currentHistory.slice(0, 1)]; // Mantener "Mundo"
  
  // Agregar país si no está
  if (!currentHistory.find(h => h.id === countryIso)) {
    newHistory.push({ 
      level: 'country', 
      name: countryName, 
      id: countryIso, 
      timestamp: Date.now() 
    });
  }
  
  // Agregar subdivisión
  newHistory.push({ 
    level: 'subdivision', 
    name: subdivisionName, 
    id: subdivisionId, 
    timestamp: Date.now() 
  });
  
  navigationHistory.set(newHistory);
  
  setTimeout(() => {
    globeState.update(s => ({ ...s, isNavigating: false }));
  }, 1000);
}

/**
 * Actualizar colores del mapa
 */
export function updateColorMap(
  newColorMap: Record<string, string>, 
  newDominantKeys: Record<string, string>
) {
  colorState.update(state => ({
    ...state,
    colorMap: newColorMap,
    isoDominantKey: newDominantKeys
  }));
}

/**
 * Cambiar tema (claro/oscuro)
 */
export function toggleTheme() {
  colorState.update(state => ({
    ...state,
    isDarkTheme: !state.isDarkTheme
  }));
}

/**
 * Actualizar etiquetas visibles
 */
export function updateLabels(labels: LabelsState['activeLabels'], type: LabelsState['labelType']) {
  labelsState.update(state => ({
    ...state,
    activeLabels: labels,
    labelType: type
  }));
}

/**
 * Limpiar estado (reset)
 */
export function resetGlobeState() {
  navigateToWorld();
  colorState.set({
    colorMap: {},
    isoDominantKey: {},
    atmosphereColor: '#4a90e2',
    isDarkTheme: true,
    fadeOpacity: 1.0
  });
  labelsState.set({
    showLabels: true,
    labelType: null,
    activeLabels: []
  });
}

// ===============================================
// LOD (Level of Detail) HELPERS
// ===============================================

const COUNTRY_LABELS_ALT = 2.5;
const SUBDIVISION_LABELS_ALT = 0.8;
const DETAILED_LABELS_ALT = 0.3;

/**
 * Determinar qué etiquetas mostrar según la altitud
 */
export function getLabelTypeForAltitude(altitude: number, level: GlobeState['level']) {
  if (level === 'world') {
    return altitude < COUNTRY_LABELS_ALT ? 'country' : null;
  }
  
  if (level === 'country') {
    if (altitude < DETAILED_LABELS_ALT) return 'detailed';
    if (altitude < SUBDIVISION_LABELS_ALT) return 'subdivision';
    return 'country';
  }
  
  if (level === 'subdivision') {
    return altitude < DETAILED_LABELS_ALT ? 'detailed' : 'subdivision';
  }
  
  return null;
}

// ===============================================
// ZOOM ADAPTATIVO
// ===============================================

/**
 * Calcular zoom adaptativo basado en el área del polígono
 */
export function calculateAdaptiveZoom(area: number, isSubdivision = false): number {
  if (isSubdivision) {
    // Lógica para subdivisiones
    if (area > 50) return 0.6;
    if (area > 10) return 0.4;
    if (area > 1) return 0.25;
    if (area > 0.1) return 0.15;
    return 0.08;
  } else {
    // Lógica para países
    if (area > 1000) return 1.2;
    if (area > 500) return 0.8;
    if (area > 100) return 0.5;
    if (area > 10) return 0.3;
    if (area > 1) return 0.2;
    return 0.15;
  }
}

// ===============================================
// SUSCRIPCIONES Y EFECTOS
// ===============================================

/**
 * Suscribirse a cambios de altitud para actualizar etiquetas
 */
globeState.subscribe(state => {
  const labelType = getLabelTypeForAltitude(state.altitude, state.level);
  labelsState.update(labels => ({
    ...labels,
    labelType,
    showLabels: labelType !== null
  }));
});

/**
 * Log de navegación para debug
 */
if (import.meta.env.DEV) {
  navigationHistory.subscribe(history => {
    console.log('[GlobeStore] Navigation:', history.map(h => h.name).join(' > '));
  });
}

export default {
  globeState,
  colorState,
  labelsState,
  navigationHistory,
  // Derivados
  isDetailedView,
  navigationBreadcrumb,
  hasVoteData,
  // Acciones
  navigateToWorld,
  navigateToCountry,
  navigateToSubdivision,
  updateColorMap,
  toggleTheme,
  updateLabels,
  resetGlobeState,
  calculateAdaptiveZoom,
  getLabelTypeForAltitude
};
