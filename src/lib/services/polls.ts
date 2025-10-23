// Servicio para interactuar con la API de encuestas

import { apiCall, apiPost, apiGet } from '$lib/api/client';

export interface PollOption {
  id: number;
  optionKey: string;
  optionLabel: string;
  color: string;
  avatarUrl?: string;
  voteCount: number;
  displayOrder: number;
}

export interface Poll {
  id: number;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  type: string;
  status: string;
  totalVotes: number;
  totalViews: number;
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified: boolean;
  };
  options: PollOption[];
  _count?: {
    votes: number;
    comments: number;
    interactions: number;
  };
}

export interface PollsResponse {
  data: Poll[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VoteData {
  optionId: number;
  latitude: number;
  longitude: number;
  countryIso3: string;
  countryName?: string;
  subdivisionName?: string;
  cityName?: string;
}

export interface VoteResponse {
  success: boolean;
  vote: {
    id: number;
    pollId: number;
    optionId: number;
    latitude: number;
    longitude: number;
    countryIso3: string;
    createdAt: string;
  };
}

export interface GeoVotesParams {
  pollId: number;
  country?: string;
  subdivision?: string;
  city?: string;
}

export interface VoteStats {
  totalVotes: number;
  votesByOption: Record<string, number>;
  votesByCountry: Record<string, number>;
  votesByCity: Record<string, number>;
}

/**
 * Obtener lista de encuestas con filtros y paginación
 */
export async function getPolls(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PollsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  return await apiGet(`/api/polls?${searchParams}`);
}

/**
 * Obtener una encuesta por ID
 */
export async function getPoll(id: number): Promise<Poll> {
  return await apiGet(`/api/polls/${id}`);
}

/**
 * Votar en una encuesta
 */
export async function votePoll(pollId: number, data: VoteData): Promise<VoteResponse> {
  return await apiPost(`/api/polls/${pollId}/vote`, data);
}

/**
 * Obtener estadísticas de una encuesta
 */
export async function getPollStats(pollId: number): Promise<VoteStats> {
  return await apiGet(`/api/polls/${pollId}/stats`);
}

/**
 * Obtener votos geolocalizados
 */
export async function getGeoVotes(params: GeoVotesParams) {
  const searchParams = new URLSearchParams({
    poll: params.pollId.toString(),
  });
  if (params.country) searchParams.set('country', params.country);
  if (params.subdivision) searchParams.set('subdivision', params.subdivision);
  if (params.city) searchParams.set('city', params.city);

  return await apiGet(`/api/votes/geo?${searchParams}`);
}

/**
 * Obtener historial de votos para gráficos
 */
export async function getPollHistory(pollId: number, days: number = 30) {
  return await apiGet(`/api/polls/${pollId}/history?days=${days}`);
}

/**
 * Dar like a una encuesta
 */
export async function likePoll(pollId: number): Promise<{ success: boolean }> {
  return await apiPost(`/api/polls/${pollId}/like`, {});
}

/**
 * Guardar una encuesta
 */
export async function savePoll(pollId: number): Promise<{ success: boolean }> {
  return await apiPost(`/api/polls/${pollId}/save`, {});
}

/**
 * Compartir una encuesta
 */
export async function sharePoll(pollId: number): Promise<{ success: boolean; shareUrl: string }> {
  return await apiPost(`/api/polls/${pollId}/share`, {});
}
