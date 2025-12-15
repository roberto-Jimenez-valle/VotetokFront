import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
  // Permitir embeds en cualquier sitio (X-Frame-Options)
  setHeaders({
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': "frame-ancestors *"
  });
  
  return {};
};
