import { writable } from 'svelte/store';

// Ejemplo de store global. Puedes agregar más según tus necesidades.
export const globeHeightPercent = writable<number | null>(100);

// Store para la fuente de datos del globo
export const globeDataSource = writable<string>('/api/data/world');

// Store para el usuario actual autenticado
export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  verified: boolean;
  countryIso3?: string;
  subdivisionId?: string;
  role: string;
}

export const currentUser = writable<CurrentUser | null>(null);

// Helper para verificar si hay usuario logueado
export const isAuthenticated = writable<boolean>(false);

// Función para setear el usuario actual
export function setCurrentUser(user: CurrentUser | null) {
  currentUser.set(user);
  isAuthenticated.set(user !== null);
}

// Función para logout
export function logout() {
  currentUser.set(null);
  isAuthenticated.set(false);
}
