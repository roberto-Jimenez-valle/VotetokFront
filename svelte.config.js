import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-node genera una aplicación Node.js independiente
		adapter: adapter({
			out: 'build'
		})
	},
};

export default config;
