import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

// POST - Seguir a un usuario
export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		const { id } = params;
		const user = locals.user;
		const targetUserId = parseInt(id);

		if (!user?.userId) {
			return json({ error: 'No autenticado' }, { status: 401 });
		}

		if (user.userId === targetUserId) {
			return json({ error: 'No puedes seguirte a ti mismo' }, { status: 400 });
		}

		// Verificar que el usuario a seguir existe
		const userToFollow = await prisma.user.findUnique({
			where: { id: targetUserId }
		});

		if (!userToFollow) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// Verificar si ya lo sigue
		const existingFollow = await prisma.userFollower.findUnique({
			where: {
				followerId_followingId: {
					followerId: user.userId,
					followingId: targetUserId
				}
			}
		});

		if (existingFollow) {
			return json({ error: 'Ya sigues a este usuario' }, { status: 400 });
		}

		// Crear la relación de seguimiento
		await prisma.userFollower.create({
			data: {
				followerId: user.userId,
				followingId: targetUserId
			}
		});

		return json({ success: true, message: 'Usuario seguido' });
	} catch (error) {
		console.error('[Follow] Error:', error);
		return json({ error: 'Error al seguir usuario' }, { status: 500 });
	}
};

// DELETE - Dejar de seguir a un usuario
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const { id } = params;
		const user = locals.user;
		const targetUserId = parseInt(id);

		if (!user?.userId) {
			return json({ error: 'No autenticado' }, { status: 401 });
		}

		// Eliminar la relación de seguimiento
		await prisma.userFollower.delete({
			where: {
				followerId_followingId: {
					followerId: user.userId,
					followingId: targetUserId
				}
			}
		});

		return json({ success: true, message: 'Dejaste de seguir al usuario' });
	} catch (error) {
		console.error('[Unfollow] Error:', error);
		return json({ error: 'Error al dejar de seguir usuario' }, { status: 500 });
	}
};
