
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

// Endpoint para generar seguidores falsos para pruebas
export const GET: RequestHandler = async ({ url }) => {
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return json({ error: 'userId required' }, { status: 400 });
    }

    const targetUserId = parseInt(userId);

    // 1. Obtener 5 usuarios aleatorios que no sean yo
    const randomUsers = await prisma.user.findMany({
        where: {
            id: { not: targetUserId }
        },
        take: 5
    });

    if (randomUsers.length === 0) {
        // Crear usuarios dummy si no existen
        await prisma.user.createMany({
            data: [
                { username: 'alex_marin', email: 'alex@test.com', displayName: 'Alex Marín', avatarUrl: 'bg-orange-500' },
                { username: 'sara_vega', email: 'sara@test.com', displayName: 'Sara Vega', avatarUrl: 'bg-pink-500' },
                { username: 'marcos_ruiz', email: 'marcos@test.com', displayName: 'Marcos Ruiz', avatarUrl: 'bg-emerald-500' },
                { username: 'elena_soler', email: 'elena@test.com', displayName: 'Elena Soler', avatarUrl: 'bg-indigo-500' },
                { username: 'david_ortiz', email: 'david@test.com', displayName: 'David Ortiz', avatarUrl: 'bg-blue-500' },
            ],
            skipDuplicates: true
        });

        // Volver a buscarlos
        const newUsers = await prisma.user.findMany({
            where: { id: { not: targetUserId } },
            take: 5
        });
        randomUsers.push(...newUsers);
    }

    // 2. Crear relaciones de seguimiento
    const follows = [];
    for (const user of randomUsers) {
        try {
            const follow = await prisma.userFollower.create({
                data: {
                    followerId: targetUserId,
                    followingId: user.id
                }
            });
            follows.push(follow);
        } catch (e) {
            // Ignorar duplicados
        }
    }

    return json({
        success: true,
        message: `Added ${follows.length} followers for user ${userId}`,
        follows
    });
};
