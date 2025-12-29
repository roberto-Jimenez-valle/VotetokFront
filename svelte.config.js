import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto solo requiere configuración mínima
		adapter: adapter()
	},
};

export default config;
