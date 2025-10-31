import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { apiCall } from '$lib/api/client';

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

// ===============================================
// TIPOS E INTERFACES
// ===============================================

export interface PollOption {
  id?: number;
  key: string;
  label: string;
  color: string;
  votes: number;
  percentage?: number;
  avatarUrl?: string;
  createdBy?: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
}

export interface Poll {
  id: number;
  title: string;
  description?: string;
  category?: string;
  type: 'poll' | 'multiple' | 'collaborative' | 'hashtag';
  status: 'active' | 'closed';
  imageUrl?: string;
  options: PollOption[];
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  totalVotes: number;
  totalViews: number;
  createdAt: string;
  closedAt?: string;
  userVote?: string;
  stats?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface PollsState {
  activePoll: Poll | null;
  trendingPolls: Poll[];
  userPolls: Poll[];
  forYouPolls: Poll[];
  isLoadingActive: boolean;
  isLoadingTrending: boolean;
  isLoadingUser: boolean;
  error: string | null;
}

export interface VotesState {
  userVotes: Record<string, string>; // pollId -> optionKey
  multipleVotes: Record<string, string[]>; // pollId -> optionKey[] (para múltiple)
  isVoting: boolean;
  voteError: string | null;
}

export interface PollFilters {
  category?: string;
  type?: string;
  status?: string;
  region?: string;
  timeRange?: 'today' | 'week' | 'month' | 'all';
}

// ===============================================
// STORES PRINCIPALES
// ===============================================

/**
 * Estado de encuestas
 */
export const pollsState: Writable<PollsState> = writable({
  activePoll: null,
  trendingPolls: [],
  userPolls: [],
  forYouPolls: [],
  isLoadingActive: false,
  isLoadingTrending: false,
  isLoadingUser: false,
  error: null
});

/**
 * Estado de votos
 */
export const votesState: Writable<VotesState> = writable({
  userVotes: {},
  multipleVotes: {},
  isVoting: false,
  voteError: null
});

/**
 * Filtros activos
 */
export const pollFilters: Writable<PollFilters> = writable({});

/**
 * Cache de encuestas
 */
const pollCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// ===============================================
// STORES DERIVADOS
// ===============================================

/**
 * Encuestas filtradas según filtros activos
 */
export const filteredPolls: Readable<Poll[]> = derived(
  [pollsState, pollFilters],
  ([$polls, $filters]) => {
    let polls = $polls.trendingPolls;
    
    if ($filters.category) {
      polls = polls.filter(p => p.category === $filters.category);
    }
    
    if ($filters.type) {
      polls = polls.filter(p => p.type === $filters.type);
    }
    
    if ($filters.status) {
      polls = polls.filter(p => p.status === $filters.status);
    }
    
    return polls;
  }
);

/**
 * Indica si hay una encuesta activa
 */
export const hasActivePoll: Readable<boolean> = derived(
  pollsState,
  $state => $state.activePoll !== null
);

/**
 * Total de votos de la encuesta activa
 */
export const activePollTotalVotes: Readable<number> = derived(
  pollsState,
  $state => $state.activePoll?.totalVotes || 0
);

/**
 * Opción más votada de la encuesta activa
 */
export const activePollWinningOption: Readable<PollOption | null> = derived(
  pollsState,
  $state => {
    if (!$state.activePoll) return null;
    
    const sorted = [...$state.activePoll.options]
      .sort((a, b) => b.votes - a.votes);
    
    return sorted[0] || null;
  }
);

// ===============================================
// ACCIONES ASÍNCRONAS
// ===============================================

/**
 * Cargar encuestas trending
 */
export async function loadTrendingPolls(force = false) {
  // Verificar caché
  if (!force) {
    const cached = pollCache.get('trending');
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      pollsState.update(s => ({
        ...s,
        trendingPolls: cached.data,
        isLoadingTrending: false
      }));
      return cached.data;
    }
  }
  
  pollsState.update(s => ({ ...s, isLoadingTrending: true, error: null }));
  
  try {
    const response = await apiCall('/api/polls/trending?limit=20');
    
    if (!response.ok) {
      throw new Error(`Error loading trending polls: ${response.status}`);
    }
    
    const result = await response.json();
    const polls = result.data || result;
    
    // Actualizar caché
    pollCache.set('trending', { data: polls, timestamp: Date.now() });
    
    pollsState.update(s => ({
      ...s,
      trendingPolls: polls,
      isLoadingTrending: false
    }));
    
    return polls;
  } catch (error) {
    console.error('[PollStore] Error loading trending:', error);
    pollsState.update(s => ({
      ...s,
      isLoadingTrending: false,
      error: getErrorMessage(error)
    }));
    return [];
  }
}

/**
 * Cargar encuestas "Para ti"
 */
export async function loadForYouPolls(userId?: number) {
  pollsState.update(s => ({ ...s, isLoadingUser: true, error: null }));
  
  try {
    const url = userId 
      ? `/api/polls/for-you?userId=${userId}`
      : '/api/polls/for-you';
      
    const response = await apiCall(url);
    
    if (!response.ok) {
      throw new Error(`Error loading for-you polls: ${response.status}`);
    }
    
    const result = await response.json();
    const polls = result.data || result;
    
    pollsState.update(s => ({
      ...s,
      forYouPolls: polls,
      isLoadingUser: false
    }));
    
    return polls;
  } catch (error) {
    console.error('[PollStore] Error loading for-you:', error);
    pollsState.update(s => ({
      ...s,
      isLoadingUser: false,
      error: getErrorMessage(error)
    }));
    return [];
  }
}

/**
 * Cargar una encuesta específica
 */
export async function loadPoll(pollId: number, force = false) {
  const cacheKey = `poll_${pollId}`;
  
  // Verificar caché
  if (!force) {
    const cached = pollCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      pollsState.update(s => ({
        ...s,
        activePoll: cached.data,
        isLoadingActive: false
      }));
      return cached.data;
    }
  }
  
  pollsState.update(s => ({ ...s, isLoadingActive: true, error: null }));
  
  try {
    const response = await apiCall(`/api/polls/${pollId}`);
    
    if (!response.ok) {
      throw new Error(`Error loading poll ${pollId}: ${response.status}`);
    }
    
    const result = await response.json();
    const poll = result.data || result;
    
    // Actualizar caché
    pollCache.set(cacheKey, { data: poll, timestamp: Date.now() });
    
    pollsState.update(s => ({
      ...s,
      activePoll: poll,
      isLoadingActive: false
    }));
    
    return poll;
  } catch (error) {
    console.error('[PollStore] Error loading poll:', error);
    pollsState.update(s => ({
      ...s,
      isLoadingActive: false,
      error: getErrorMessage(error)
    }));
    return null;
  }
}

/**
 * Votar en una encuesta
 */
export async function voteOnPoll(
  pollId: number, 
  optionKey: string, 
  location?: { latitude: number; longitude: number }
) {
  votesState.update(s => ({ ...s, isVoting: true, voteError: null }));
  
  try {
    const body = {
      pollId,
      optionKey,
      ...(location && { 
        latitude: location.latitude,
        longitude: location.longitude 
      })
    };
    
    const response = await apiCall(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Error voting: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Actualizar estado de votos
    votesState.update(s => ({
      ...s,
      userVotes: { ...s.userVotes, [pollId]: optionKey },
      isVoting: false
    }));
    
    // Actualizar encuesta activa con nuevos conteos
    if (result.updatedPoll) {
      pollsState.update(s => ({
        ...s,
        activePoll: result.updatedPoll
      }));
      
      // Invalidar caché
      pollCache.delete(`poll_${pollId}`);
    }
    
    return result;
  } catch (error) {
    console.error('[PollStore] Error voting:', error);
    votesState.update(s => ({
      ...s,
      isVoting: false,
      voteError: getErrorMessage(error)
    }));
    return null;
  }
}

/**
 * Cerrar encuesta activa
 */
export function closeActivePoll() {
  pollsState.update(s => ({
    ...s,
    activePoll: null
  }));
}

/**
 * Establecer encuesta activa
 */
export function setActivePoll(poll: Poll) {
  pollsState.update(s => ({
    ...s,
    activePoll: poll
  }));
}

/**
 * Actualizar filtros
 */
export function updateFilters(filters: Partial<PollFilters>) {
  pollFilters.update(current => ({
    ...current,
    ...filters
  }));
}

/**
 * Limpiar filtros
 */
export function clearFilters() {
  pollFilters.set({});
}

/**
 * Limpiar caché
 */
export function clearPollCache() {
  pollCache.clear();
}

/**
 * Obtener estadísticas de votación por región
 */
export async function getVotesByRegion(pollId: number, level: 'country' | 'subdivision') {
  try {
    const endpoint = level === 'country' 
      ? `/api/polls/${pollId}/votes-by-country`
      : `/api/polls/${pollId}/votes-by-subdivisions`;
      
    const response = await apiCall(endpoint);
    
    if (!response.ok) {
      throw new Error(`Error loading votes by ${level}: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('[PollStore] Error loading regional votes:', error);
    return null;
  }
}

// ===============================================
// HELPERS Y UTILIDADES
// ===============================================

/**
 * Calcular porcentajes de opciones
 */
export function calculatePercentages(poll: Poll): Poll {
  const total = poll.totalVotes || 0;
  
  if (total === 0) {
    poll.options.forEach(opt => opt.percentage = 0);
  } else {
    poll.options.forEach(opt => {
      opt.percentage = Math.round((opt.votes / total) * 100);
    });
  }
  
  return poll;
}

/**
 * Ordenar opciones por votos
 */
export function sortOptionsByVotes(options: PollOption[]): PollOption[] {
  return [...options].sort((a, b) => b.votes - a.votes);
}

/**
 * Verificar si el usuario ha votado
 */
export function hasUserVoted(pollId: number): boolean {
  const votes = get(votesState);
  return pollId.toString() in votes.userVotes;
}

/**
 * Obtener voto del usuario para una encuesta
 */
export function getUserVote(pollId: number): string | null {
  const votes = get(votesState);
  return votes.userVotes[pollId.toString()] || null;
}

// ===============================================
// EFECTOS Y SUSCRIPCIONES
// ===============================================

// Auto-calcular porcentajes cuando cambia la encuesta activa
pollsState.subscribe(state => {
  if (state.activePoll) {
    calculatePercentages(state.activePoll);
  }
});

// Log para debug en desarrollo
if (import.meta.env.DEV) {
  pollsState.subscribe(state => {
    if (state.activePoll) {
      console.log('[PollStore] Active poll:', state.activePoll.id, state.activePoll.title);
    }
  });
  
  votesState.subscribe(state => {
    console.log('[PollStore] User votes:', Object.keys(state.userVotes).length);
  });
}

export default {
  // Stores
  pollsState,
  votesState,
  pollFilters,
  // Derivados
  filteredPolls,
  hasActivePoll,
  activePollTotalVotes,
  activePollWinningOption,
  // Acciones
  loadTrendingPolls,
  loadForYouPolls,
  loadPoll,
  voteOnPoll,
  closeActivePoll,
  setActivePoll,
  updateFilters,
  clearFilters,
  clearPollCache,
  getVotesByRegion,
  // Helpers
  calculatePercentages,
  sortOptionsByVotes,
  hasUserVoted,
  getUserVote
};
