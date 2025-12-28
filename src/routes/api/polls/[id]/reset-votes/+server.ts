import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!params.id) throw error(400, "ID Required");

    const pollId = parsePollIdInternal(params.id || '');
    if (!pollId) {
        throw error(400, 'Invalid poll ID');
    }

    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    // Verify Super Admin
    if (user.email !== 'voutop.oficial@gmail.com') {
        throw error(403, 'Forbidden: Only Super Admin can reset votes');
    }

    try {
        // Delete all votes for this poll
        const result = await prisma.vote.deleteMany({
            where: { pollId: pollId }
        });

        return json({
            success: true,
            message: `Se eliminaron ${result.count} votos.`
        });
    } catch (e: any) {
        console.error("Error resetting votes:", e);
        throw error(500, "Database error");
    }
};
