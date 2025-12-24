// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user?: {
				userId: number;
				username: string;
				email?: string;
				role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin';
			};
			session?: {
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
}

export { };
