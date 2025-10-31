import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Usar adapter-static en modo SPA (Single Page Application)
		// Esto elimina completamente el sistema SSR y resuelve el error de hidratación
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // SPA mode - todas las rutas van a index.html
			precompress: false,
			strict: false
		})
	}
};

export default config;
