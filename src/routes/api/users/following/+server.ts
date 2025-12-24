
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
    const userId = url.searchParams.get('userId'); // Opcional: ID de usuario específico
    const limit = Number(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';

    // Si no hay usuario especificado, intentar usar el usuario autenticado (si tienes auth en locals)
    // Pero como aquí parece que usamos stores en el cliente, asumiremos que pasamos el ID o un parámetro "me"
    // Para simplificar, requeriremos userId en la query por ahora

    if (!userId) {
        return json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const following = await prisma.userFollower.findMany({
            where: {
                followerId: parseInt(userId),
                following: {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                }
            },
            take: limit,
            include: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Mapear para devolver lista plana de usuarios
        const users = following.map(f => ({
            id: f.following.id,
            username: f.following.username,
            name: f.following.displayName, // Mapeamos displayName a name para consistencia con el frontend
            avatar: f.following.avatarUrl
        }));

        return json(users);
    } catch (error) {
        console.error('Error fetching following:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
