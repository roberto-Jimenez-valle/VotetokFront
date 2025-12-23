import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { requireAuth } from '$lib/server/middleware/auth';

const MAX_DRAFTS_PER_USER = 5;

// GET - Obtener todos los borradores del usuario
export const GET: RequestHandler = async (event) => {
    try {
        const user = await requireAuth(event);

        const drafts = await prisma.pollDraft.findMany({
            where: { userId: user.userId },
            orderBy: { updatedAt: 'desc' },
            take: MAX_DRAFTS_PER_USER,
        });

        // Transformar para el frontend
        const transformedDrafts = drafts.map((draft) => ({
            id: draft.id,
            ...draft.draftData as object,
            savedAt: draft.updatedAt.toISOString(),
        }));

        return json({
            success: true,
            data: transformedDrafts,
        });
    } catch (err: any) {
        console.error('[API drafts GET] Error:', err);
        if (err.status) throw err;
        throw error(500, { message: 'Error al obtener borradores', code: 'INTERNAL_ERROR' });
    }
};

// POST - Crear o actualizar un borrador
export const POST: RequestHandler = async (event) => {
    try {
        const user = await requireAuth(event);
        const data = await event.request.json();

        const { id, ...draftData } = data;

        let draft;

        if (id && typeof id === 'number') {
            // Actualizar borrador existente
            const existing = await prisma.pollDraft.findFirst({
                where: { id, userId: user.userId },
            });

            if (!existing) {
                throw error(404, { message: 'Borrador no encontrado', code: 'NOT_FOUND' });
            }

            draft = await prisma.pollDraft.update({
                where: { id },
                data: { draftData },
            });
        } else {
            // Crear nuevo borrador
            // Primero, contar cuántos borradores tiene el usuario
            const count = await prisma.pollDraft.count({
                where: { userId: user.userId },
            });

            // Si ya tiene el máximo, eliminar el más antiguo
            if (count >= MAX_DRAFTS_PER_USER) {
                const oldest = await prisma.pollDraft.findFirst({
                    where: { userId: user.userId },
                    orderBy: { updatedAt: 'asc' },
                });

                if (oldest) {
                    await prisma.pollDraft.delete({ where: { id: oldest.id } });
                }
            }

            draft = await prisma.pollDraft.create({
                data: {
                    userId: user.userId,
                    draftData,
                },
            });
        }

        return json({
            success: true,
            data: {
                id: draft.id,
                ...draft.draftData as object,
                savedAt: draft.updatedAt.toISOString(),
            },
        });
    } catch (err: any) {
        console.error('[API drafts POST] Error:', err);
        if (err.status) throw err;
        throw error(500, { message: 'Error al guardar borrador', code: 'INTERNAL_ERROR' });
    }
};

// DELETE - Eliminar un borrador
export const DELETE: RequestHandler = async (event) => {
    try {
        const user = await requireAuth(event);
        const url = new URL(event.request.url);
        const id = parseInt(url.searchParams.get('id') || '0');

        if (!id) {
            throw error(400, { message: 'ID de borrador requerido', code: 'MISSING_ID' });
        }

        const existing = await prisma.pollDraft.findFirst({
            where: { id, userId: user.userId },
        });

        if (!existing) {
            throw error(404, { message: 'Borrador no encontrado', code: 'NOT_FOUND' });
        }

        await prisma.pollDraft.delete({ where: { id } });

        return json({
            success: true,
            message: 'Borrador eliminado',
        });
    } catch (err: any) {
        console.error('[API drafts DELETE] Error:', err);
        if (err.status) throw err;
        throw error(500, { message: 'Error al eliminar borrador', code: 'INTERNAL_ERROR' });
    }
};
