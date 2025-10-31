// Desactivar completamente SSR y prerendering en toda la app
export const ssr = false;
export const prerender = false;
export const csr = true;

// No cargar datos en el servidor
export function load() {
  return {};
}
