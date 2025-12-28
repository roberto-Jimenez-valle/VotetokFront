import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/checklist
 * Obtiene todos los grupos e ítems del checklist de producción
 */
export const GET: RequestHandler = async () => {
    try {
        const groups = await prisma.checklistGroup.findMany({
            orderBy: { displayOrder: 'asc' },
            include: {
                items: {
                    orderBy: { displayOrder: 'asc' }
                }
            }
        });

        return json({ success: true, data: groups });
    } catch (error) {
        console.error('[API Checklist] Error fetching:', error);
        return json({ success: false, error: 'Error fetching checklist' }, { status: 500 });
    }
};

/**
 * POST /api/checklist
 * Crea un nuevo grupo o ítem
 * Body: { type: 'group' | 'item', data: {...} }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        // Solo admins pueden modificar el checklist
        const user = locals.user;
        if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { type, data } = body;

        if (type === 'group') {
            // Crear nuevo grupo
            const maxOrder = await prisma.checklistGroup.aggregate({
                _max: { displayOrder: true }
            });

            const group = await prisma.checklistGroup.create({
                data: {
                    title: data.title,
                    icon: data.icon || 'Zap',
                    color: data.color || 'text-gray-500',
                    displayOrder: (maxOrder._max.displayOrder || 0) + 1
                }
            });

            return json({ success: true, data: group });
        } else if (type === 'item') {
            // Crear nuevo ítem
            if (!data.groupId) {
                return json({ success: false, error: 'groupId is required' }, { status: 400 });
            }

            const maxOrder = await prisma.checklistItem.aggregate({
                where: { groupId: data.groupId },
                _max: { displayOrder: true }
            });

            const item = await prisma.checklistItem.create({
                data: {
                    groupId: data.groupId,
                    label: data.label,
                    status: data.status || 'missing',
                    detail: data.detail,
                    note: data.note,
                    action: data.action,
                    critical: data.critical || false,
                    displayOrder: (maxOrder._max.displayOrder || 0) + 1
                }
            });

            return json({ success: true, data: item });
        }

        return json({ success: false, error: 'Invalid type' }, { status: 400 });
    } catch (error) {
        console.error('[API Checklist] Error creating:', error);
        return json({ success: false, error: 'Error creating entry' }, { status: 500 });
    }
};
