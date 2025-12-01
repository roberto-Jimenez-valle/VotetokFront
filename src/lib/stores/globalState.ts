/**
 * Global State Management con Svelte 5 Stores
 * Centraliza el estado compartido entre componentes para evitar props drilling
 */

import { writable, derived, type Writable } from 'svelte/store';

// ========================================
// TYPES
// ========================================

export type NavigationLevel = 'world' | 'country' | 'subdivision' | 'city';

export interface NavigationState {
  level: NavigationLevel;
  countryIso: string | null;
  countryName: string | null;
  subdivisionId: string | null;
  subdivisionName: string | null;
  cityId: string | null;
  cityName: string | null;
  path: string[];
}

export interface Poll {
  id: number | string;
  title: string;
  question?: string;
  description?: string;
  category?: string;
  type: 'single' | 'multiple' | 'rating' | 'collaborative';
  imageUrl?: string;
  options: PollOption[];
  user?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  stats?: {
    totalVotes: number;
    interactions: number;
    comments: number;
  };
  createdAt?: string;
  closedAt?: string | null;
  status?: string;
}

export interface PollOption {
  id?: number;
  key: string;
  label: string;
  color: string;
  votes: number;
  pct?: number;
  imageUrl?: string;
}

export interface VoteData {
  pollId: number | string;
  optionKey: string;
  subdivisionId?: number;
  locationSource?: 'gps' | 'ip' | 'default';
}

export interface ThemeState {
  isDark: boolean;
  paletteIndex: number;
  colors: {
    bg: string;
    sphere: string;
    stroke: string;
    noData: string;
    atmosphere: string;
  };
}

// ========================================
// NAVIGATION STATE
// ========================================

function createNavigationStore() {
  const { subscribe, set, update } = writable<NavigationState>({
    level: 'world',
    countryIso: null,
    countryName: null,
    subdivisionId: null,
    subdivisionName: null,
    cityId: null,
    cityName: null,
    path: []
  });

  return {
    subscribe,
    set,
    update,
    navigateToWorld: () => {
      set({
        level: 'world',
        countryIso: null,
        countryName: null,
        subdivisionId: null,
        subdivisionName: null,
        cityId: null,
        cityName: null,
        path: []
      });
    },
    navigateToCountry: (iso: string, name: string) => {
      update(state => ({
        ...state,
        level: 'country',
        countryIso: iso,
        countryName: name,
        subdivisionId: null,
        subdivisionName: null,
        cityId: null,
        cityName: null,
        path: [iso]
      }));
    },
    navigateToSubdivision: (subdivisionId: string, subdivisionName: string) => {
      update(state => ({
        ...state,
        level: 'subdivision',
        subdivisionId,
        subdivisionName,
        cityId: null,
        cityName: null,
        path: [...state.path.slice(0, 1), subdivisionId]
      }));
    }
  };
}

export const navigationState = createNavigationStore();

// Derived stores
export const currentLevel = derived(navigationState, $nav => $nav.level);
export const currentCountry = derived(navigationState, $nav => ({
  iso: $nav.countryIso,
  name: $nav.countryName
}));
export const currentSubdivision = derived(navigationState, $nav => ({
  id: $nav.subdivisionId,
  name: $nav.subdivisionName
}));

// ========================================
// POLL STATE
// ========================================

function createPollStore() {
  const { subscribe, set, update } = writable<Poll | null>(null);

  return {
    subscribe,
    set,
    update,
    open: (poll: Poll) => set(poll),
    close: () => set(null),
    updateVoteCount: (optionKey: string) => {
      update(poll => {
        if (!poll) return poll;
        return {
          ...poll,
          options: poll.options.map(opt =>
            opt.key === optionKey
              ? { ...opt, votes: opt.votes + 1 }
              : opt
          )
        };
      });
    }
  };
}

export const activePoll = createPollStore();
export const isPollActive = derived(activePoll, $poll => !!$poll);

// Poll options (para trending mode vs specific poll)
export const activePollOptions = writable<PollOption[]>([]);

// ========================================
// VOTE DATA STATE
// ========================================

interface AnswersData {
  [subdivisionId: string]: {
    [optionKey: string]: number;
  };
}

export const answersData = writable<AnswersData>({});
export const colorMap = writable<Record<string, string>>({});

// Store derivado con las claves que tienen datos (para verificar rápidamente si una región tiene datos)
export const regionsWithData = derived(answersData, $data => new Set(Object.keys($data)));

// Caches por nivel
export const worldLevelAnswers = writable<AnswersData>({});
export const countryLevelAnswers = writable<AnswersData>({});
export const subdivisionLevelAnswers = writable<AnswersData>({});

// ========================================
// THEME STATE
// ========================================

export const themeState = writable<ThemeState>({
  isDark: true,
  paletteIndex: 0,
  colors: {
    bg: '#0a0a0a',
    sphere: '#1a1a1a',
    stroke: '#2e2e2e',
    noData: '#141414',
    atmosphere: '#1a1a1a'
  }
});

export const isDarkTheme = derived(themeState, $theme => $theme.isDark);

// ========================================
// UI STATE
// ========================================

export const bottomSheetState = writable<'hidden' | 'peek' | 'collapsed' | 'expanded'>('collapsed');
export const isBottomSheetVisible = derived(bottomSheetState, $state => $state !== 'hidden');

// Modal states
export const createPollModalOpen = writable(false);
export const searchModalOpen = writable(false);
export const notificationsModalOpen = writable(false);
export const profileModalOpen = writable(false);
export const selectedProfileUserId = writable<number | null>(null);

// ========================================
// USER STATE
// ========================================

export interface User {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  verified?: boolean;
  role?: string;
}

export const currentUser = writable<User | null>(null);
export const isAuthenticated = derived(currentUser, $user => !!$user);

// ========================================
// GLOBE STATE
// ========================================

export interface GlobeViewState {
  altitude: number;
  latitude: number;
  longitude: number;
  isZooming: boolean;
}

export const globeView = writable<GlobeViewState>({
  altitude: 2.5,
  latitude: 0,
  longitude: 0,
  isZooming: false
});

export const currentAltitude = derived(globeView, $view => $view.altitude);

// ========================================
// LOADING STATE
// ========================================

export const isLoadingPolls = writable(false);
export const isLoadingVotes = writable(false);
export const isLoadingGeocoding = writable(false);

// Combined loading state
export const isLoading = derived(
  [isLoadingPolls, isLoadingVotes, isLoadingGeocoding],
  ([$polls, $votes, $geo]) => $polls || $votes || $geo
);

// ========================================
// ERROR STATE
// ========================================

export interface AppError {
  message: string;
  code?: string;
  timestamp: number;
}

export const lastError = writable<AppError | null>(null);

export function setError(message: string, code?: string) {
  lastError.set({
    message,
    code,
    timestamp: Date.now()
  });
  
  // Auto-clear después de 5 segundos
  setTimeout(() => {
    lastError.set(null);
  }, 5000);
}

// ========================================
// HELPERS
// ========================================

/**
 * Reset all stores to initial state
 * Útil para testing y logout
 */
export function resetAllStores() {
  navigationState.navigateToWorld();
  activePoll.close();
  activePollOptions.set([]);
  answersData.set({});
  colorMap.set({});
  worldLevelAnswers.set({});
  countryLevelAnswers.set({});
  subdivisionLevelAnswers.set({});
  bottomSheetState.set('collapsed');
  createPollModalOpen.set(false);
  searchModalOpen.set(false);
  notificationsModalOpen.set(false);
  profileModalOpen.set(false);
  selectedProfileUserId.set(null);
  currentUser.set(null);
  isLoadingPolls.set(false);
  isLoadingVotes.set(false);
  isLoadingGeocoding.set(false);
  lastError.set(null);
}

/**
 * Debug helper - log all store values
 */
export function debugStores() {
  console.group('🔍 Global Store State');
  
  navigationState.subscribe(v => console.log('navigationState:', v))();
  activePoll.subscribe(v => console.log('activePoll:', v))();
  activePollOptions.subscribe(v => console.log('activePollOptions:', v))();
  themeState.subscribe(v => console.log('themeState:', v))();
  bottomSheetState.subscribe(v => console.log('bottomSheetState:', v))();
  currentUser.subscribe(v => console.log('currentUser:', v))();
  globeView.subscribe(v => console.log('globeView:', v))();
  
  console.groupEnd();
}
