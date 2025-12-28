import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const ADMIN_EMAIL = 'voutop.oficial@gmail.com';

export const load: LayoutServerLoad = async ({ locals }) => {
    const user = locals.user;

    // Only allow voutop.oficial to access admin pages
    if (!user || user.email !== ADMIN_EMAIL) {
        throw redirect(302, '/');
    }

    return {
        user
    };
};
