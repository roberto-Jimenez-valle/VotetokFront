import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ADMIN_EMAIL = 'voutop.oficial@gmail.com';

export const load: PageServerLoad = async ({ locals }) => {
    const user = locals.user;

    // Only allow voutop.oficial to access production checklist
    if (!user || user.email !== ADMIN_EMAIL) {
        throw redirect(302, '/');
    }

    return {
        user
    };
};
