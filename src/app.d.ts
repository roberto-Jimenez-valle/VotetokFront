// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: {
				userId: number;
				username: string;
				email?: string;
				role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin';
			};
			user?: {
				userId: number;
				username: string;
				email?: string;
				role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin';
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	namespace svelteHTML {
		// Extend HTML attributes if needed
		// interface HTMLAttributes<T> {
		// 	'on:customEvent'?: (event: CustomEvent<any>) => void;
		// }
	}
}

export {};
