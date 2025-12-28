import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * PATCH /api/checklist/[id]
 * Actualiza un ítem o grupo del checklist
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        const user = locals.user;
        if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const id = parseInt(params.id!);
        if (isNaN(id)) {
            return json({ success: false, error: 'Invalid ID' }, { status: 400 });
        }

        const body = await request.json();
        const { type, data } = body;

        if (type === 'group') {
            const group = await prisma.checklistGroup.update({
                where: { id },
                data: {
                    ...(data.title && { title: data.title }),
                    ...(data.icon && { icon: data.icon }),
                    ...(data.color && { color: data.color }),
                    ...(typeof data.displayOrder === 'number' && { displayOrder: data.displayOrder })
                }
            });
            return json({ success: true, data: group });
        } else if (type === 'item') {
            const item = await prisma.checklistItem.update({
                where: { id },
                data: {
                    ...(data.label && { label: data.label }),
                    ...(data.status && { status: data.status }),
                    ...(data.detail !== undefined && { detail: data.detail }),
                    ...(data.note !== undefined && { note: data.note }),
                    ...(data.action !== undefined && { action: data.action }),
                    ...(typeof data.critical === 'boolean' && { critical: data.critical }),
                    ...(typeof data.displayOrder === 'number' && { displayOrder: data.displayOrder }),
                    ...(data.groupId && { groupId: data.groupId })
                }
            });
            return json({ success: true, data: item });
        }

        return json({ success: false, error: 'Invalid type' }, { status: 400 });
    } catch (error) {
        console.error('[API Checklist] Error updating:', error);
        return json({ success: false, error: 'Error updating entry' }, { status: 500 });
    }
};

/**
 * DELETE /api/checklist/[id]
 * Elimina un ítem o grupo del checklist
 */
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
    try {
        const user = locals.user;
        if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const id = parseInt(params.id!);
        if (isNaN(id)) {
            return json({ success: false, error: 'Invalid ID' }, { status: 400 });
        }

        const body = await request.json();
        const { type } = body;

        if (type === 'group') {
            await prisma.checklistGroup.delete({ where: { id } });
        } else if (type === 'item') {
            await prisma.checklistItem.delete({ where: { id } });
        } else {
            return json({ success: false, error: 'Invalid type' }, { status: 400 });
        }

        return json({ success: true });
    } catch (error) {
        console.error('[API Checklist] Error deleting:', error);
        return json({ success: false, error: 'Error deleting entry' }, { status: 500 });
    }
};
