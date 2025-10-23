// Servicio para interactuar con la API de usuarios
import { apiGet, apiPost, apiDelete } from '$lib/api/client';

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
  const data = await apiGet('/api/featured');
  return data.data;
}

/**
 * Obtener un usuario por ID
 */
export async function getUser(id: number): Promise<User> {
  const data = await apiGet(`/api/users/${id}`);
  return data.data;
}

/**
 * Obtener encuestas de un usuario
 */
export async function getUserPolls(userId: number, page: number = 1, limit: number = 20) {
  return apiGet(`/api/users/${userId}/polls?page=${page}&limit=${limit}`);
}

/**
 * Seguir a un usuario
 */
export async function followUser(userId: number): Promise<{ success: boolean }> {
  return apiPost(`/api/users/${userId}/follow`, {});
}

/**
 * Dejar de seguir a un usuario
 */
export async function unfollowUser(userId: number): Promise<{ success: boolean }> {
  return apiDelete(`/api/users/${userId}/follow`);
}

/**
 * Obtener seguidores de un usuario
 */
export async function getUserFollowers(userId: number) {
  return apiGet(`/api/users/${userId}/followers`);
}

/**
 * Obtener usuarios que sigue un usuario
 */
export async function getUserFollowing(userId: number) {
  return apiGet(`/api/users/${userId}/following`);
}
