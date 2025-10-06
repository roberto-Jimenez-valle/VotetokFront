// Servicio para interactuar con la API de encuestas

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

  const response = await fetch(`/api/polls?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch polls: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtener una encuesta por ID
 */
export async function getPoll(id: number): Promise<Poll> {
  const response = await fetch(`/api/polls/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch poll: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
}

/**
 * Votar en una encuesta
 */
export async function votePoll(pollId: number, data: VoteData): Promise<VoteResponse> {
  const response = await fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to vote');
  }
  
  return response.json();
}

/**
 * Obtener estadísticas de una encuesta
 */
export async function getPollStats(pollId: number): Promise<VoteStats> {
  const response = await fetch(`/api/polls/${pollId}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch poll stats: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
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

  const response = await fetch(`/api/votes/geo?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch geo votes: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtener historial de votos para gráficos
 */
export async function getPollHistory(pollId: number, days: number = 30) {
  const response = await fetch(`/api/polls/${pollId}/history?days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch poll history: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Dar like a una encuesta
 */
export async function likePoll(pollId: number): Promise<{ success: boolean }> {
  const response = await fetch(`/api/polls/${pollId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error('Failed to like poll');
  }
  
  return response.json();
}

/**
 * Guardar una encuesta
 */
export async function savePoll(pollId: number): Promise<{ success: boolean }> {
  const response = await fetch(`/api/polls/${pollId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error('Failed to save poll');
  }
  
  return response.json();
}

/**
 * Compartir una encuesta
 */
export async function sharePoll(pollId: number): Promise<{ success: boolean; shareUrl: string }> {
  const response = await fetch(`/api/polls/${pollId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error('Failed to share poll');
  }
  
  return response.json();
}
