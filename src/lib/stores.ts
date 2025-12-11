import { writable } from 'svelte/store';

// Ejemplo de store global. Puedes agregar más según tus necesidades.
export const globeHeightPercent = writable<number | null>(100);

// Store para la fuente de datos del globo
export const globeDataSource = writable<string>('/api/data/world');

// ============================================
// RE-EXPORTAR DESDE EL STORE UNIFICADO DE AUTH
// ============================================
// IMPORTANTE: No usar stores duplicados para autenticación
// Todo debe venir de $lib/stores/auth para evitar inconsistencias
export { 
  currentUser, 
  isAuthenticated, 
  setCurrentUser, 
  logout,
  setAuth,
  authToken,
  updateUser,
  getCurrentUserId,
  isUserLoggedIn,
  initAuth
} from '$lib/stores/auth';

// Re-exportar el tipo User como CurrentUser para compatibilidad
export type { User as CurrentUser } from '$lib/stores/auth';
