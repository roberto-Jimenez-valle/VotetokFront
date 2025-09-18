import { writable } from 'svelte/store';

// Ejemplo de store global. Puedes agregar más según tus necesidades.
export const globeHeightPercent = writable<number | null>(100);

// Store para la fuente de datos del globo
export const globeDataSource = writable<string>('/api/data/world');

// Puedes añadir aquí más stores, por ejemplo:
// export const usuarioActual = writable<Usuario | null>(null);
// export const temaOscuro = writable(false);
