import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { createNotification } from '$lib/server/notifications';

// POST - Seguir a un usuario
export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		const { id } = params;
		const user = locals.user;
		const targetUserId = parseInt(id);

		// Verificaciones iniciales
		if (!user?.userId) {
			return json({ error: 'No autenticado' }, { status: 401 });
		}
		if (user.userId === targetUserId) {
			return json({ error: 'No puedes seguirte a ti mismo' }, { status: 400 });
		}

		// Buscar usuario destino y su privacidad
		const userToFollow = await prisma.user.findUnique({
			where: { id: targetUserId },
			select: { id: true, isPrivate: true }
		});

		if (!userToFollow) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// Verificar si ya existe relación (pending o accepted)
		const existingFollow = await prisma.userFollower.findUnique({
			where: {
				followerId_followingId: {
					followerId: user.userId,
					followingId: targetUserId
				}
			}
		});

		if (existingFollow) {
			return json({ error: 'Ya existe una relación con este usuario' }, { status: 400 });
		}

		// Determinar estado según privacidad
		const isPrivate = userToFollow.isPrivate || false;
		const status = isPrivate ? 'pending' : 'accepted';

		// Usar transacción para crear follow y notificación
		await prisma.$transaction(async (tx) => {
			// 1. Crear relación
			await tx.userFollower.create({
				data: {
					followerId: user.userId,
					followingId: targetUserId,
					status
				}
			});

			// 2. Crear notificación
			const actorName = user.username || 'Un usuario';
			const notifType = isPrivate ? 'FOLLOW_REQUEST' : 'NEW_FOLLOWER';
			const message = isPrivate
				? `${actorName} quiere seguirte.`
				: `${actorName} ha empezado a seguirte.`;

			await createNotification({
				userId: targetUserId,
				actorId: user.userId,
				type: notifType,
				message,
				client: tx
			});
		});

		return json({
			success: true,
			status,
			message: status === 'pending' ? 'Solicitud enviada' : 'Usuario seguido'
		});

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
