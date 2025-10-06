// Servicio para interactuar con la API de usuarios

export interface User {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  verified: boolean;
  createdAt: string;
}

export interface FeaturedUser extends User {
  roleTitle?: string;
  citationsCount: number;
  displaySize: number;
  highlightColor?: string;
  featuredOrder: number;
}

export interface UsersResponse {
  data: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Obtener usuarios destacados
 */
export async function getFeaturedUsers(): Promise<FeaturedUser[]> {
  const response = await fetch('/api/featured');
  if (!response.ok) {
    throw new Error(`Failed to fetch featured users: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
}

/**
 * Obtener un usuario por ID
 */
export async function getUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
}

/**
 * Obtener encuestas de un usuario
 */
export async function getUserPolls(userId: number, page: number = 1, limit: number = 20) {
  const response = await fetch(`/api/users/${userId}/polls?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user polls: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Seguir a un usuario
 */
export async function followUser(userId: number): Promise<{ success: boolean }> {
  const response = await fetch(`/api/users/${userId}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error('Failed to follow user');
  }
  
  return response.json();
}

/**
 * Dejar de seguir a un usuario
 */
export async function unfollowUser(userId: number): Promise<{ success: boolean }> {
  const response = await fetch(`/api/users/${userId}/follow`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to unfollow user');
  }
  
  return response.json();
}

/**
 * Obtener seguidores de un usuario
 */
export async function getUserFollowers(userId: number) {
  const response = await fetch(`/api/users/${userId}/followers`);
  if (!response.ok) {
    throw new Error(`Failed to fetch followers: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtener usuarios que sigue un usuario
 */
export async function getUserFollowing(userId: number) {
  const response = await fetch(`/api/users/${userId}/following`);
  if (!response.ok) {
    throw new Error(`Failed to fetch following: ${response.statusText}`);
  }
  return response.json();
}
